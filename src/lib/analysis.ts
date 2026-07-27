// Pure analysis functions powering the four frameworks. Run server-side in the
// API routes over the cached dataset.

import { Dataset, Txn, Rental, TxnFilter } from "./types";
import { median, mean, quantile } from "./format";

// ---- Filtering --------------------------------------------------------------

export function applyFilters(txns: Txn[], f: TxnFilter): Txn[] {
  return txns.filter((t) => {
    if (f.district && t.district !== f.district) return false;
    if (f.project && t.project !== f.project) return false;
    if (f.propertyType && t.propertyType !== f.propertyType) return false;
    if (f.saleType && t.saleType !== f.saleType) return false;
    if (f.marketSegment && t.marketSegment !== f.marketSegment) return false;
    if (f.tenureType && t.tenureType !== f.tenureType) return false;
    if (f.minArea != null && t.areaSqft < f.minArea) return false;
    if (f.maxArea != null && t.areaSqft > f.maxArea) return false;
    if (f.minPrice != null && t.price < f.minPrice) return false;
    if (f.maxPrice != null && t.price > f.maxPrice) return false;
    if (f.from && t.month < f.from) return false;
    if (f.to && t.month > f.to) return false;
    return true;
  });
}

// ---- Metadata (drives the filter UI) ----------------------------------------

export interface Meta {
  source: string;
  fetchedAt: string;
  txnCount: number;
  rentalCount: number;
  months: { min: string; max: string } | null;
  rentalQuarters: string[];
  districts: string[];
  propertyTypes: string[];
  saleTypes: string[];
  marketSegments: string[];
  tenureTypes: string[];
  projects: { name: string; district: string; count: number }[];
  error?: string;
}

export function buildMeta(ds: Dataset): Meta {
  const projectMap = new Map<string, { district: string; count: number }>();
  for (const t of ds.txns) {
    const cur = projectMap.get(t.project);
    if (cur) cur.count++;
    else projectMap.set(t.project, { district: t.district, count: 1 });
  }
  const uniqSorted = (vals: string[]) => Array.from(new Set(vals)).filter(Boolean).sort();
  return {
    source: ds.source,
    fetchedAt: ds.fetchedAt,
    txnCount: ds.txns.length,
    rentalCount: ds.rentals.length,
    months: ds.transactionMonths,
    rentalQuarters: ds.rentalQuarters,
    districts: uniqSorted(ds.txns.map((t) => t.district)),
    propertyTypes: uniqSorted(ds.txns.map((t) => t.propertyType)),
    saleTypes: uniqSorted(ds.txns.map((t) => t.saleType)),
    marketSegments: uniqSorted(ds.txns.map((t) => String(t.marketSegment))),
    tenureTypes: uniqSorted(ds.txns.map((t) => t.tenureType)),
    projects: Array.from(projectMap.entries())
      .map(([name, v]) => ({ name, district: v.district, count: v.count }))
      .sort((a, b) => b.count - a.count),
    error: (ds as Dataset & { error?: string }).error,
  };
}

// ---- Framework 1: Price / PSF trends ----------------------------------------

export interface TrendPoint {
  period: string;
  volume: number;
  medianPsf: number | null;
  avgPsf: number | null;
  medianPrice: number | null;
  p25Psf: number | null;
  p75Psf: number | null;
}

export function psfTrends(
  txns: Txn[],
  groupBy: "quarter" | "year" | "month" = "quarter"
): TrendPoint[] {
  const key = (t: Txn) => (groupBy === "year" ? String(t.year) : groupBy === "month" ? t.month : t.quarter);
  const buckets = new Map<string, Txn[]>();
  for (const t of txns) {
    const k = key(t);
    (buckets.get(k) || buckets.set(k, []).get(k)!).push(t);
  }
  return Array.from(buckets.entries())
    .map(([period, list]) => {
      const psfs = list.map((t) => t.psf);
      const prices = list.map((t) => t.price);
      return {
        period,
        volume: list.length,
        medianPsf: round(median(psfs)),
        avgPsf: round(mean(psfs)),
        medianPrice: round(median(prices)),
        p25Psf: round(quantile(psfs, 0.25)),
        p75Psf: round(quantile(psfs, 0.75)),
      };
    })
    .sort((a, b) => a.period.localeCompare(b.period));
}

// ---- "Am I overpaying?" — valuation percentile check ------------------------
// Places a proposed price's PSF within the distribution of recent, similar-size
// comparable caveats. Caller pre-filters by project/district/tenure/type.

export interface ValuationResult {
  enteredPsf: number | null;
  count: number;
  percentile: number | null; // 0-100, share of comps below the entered PSF
  median: number | null;
  p25: number | null;
  p75: number | null;
  min: number | null;
  max: number | null;
  verdict: "well below" | "below" | "around" | "above" | "well above" | null;
  monthsWindow: number;
  sizeLow: number;
  sizeHigh: number;
}

export function valuationCheck(
  txns: Txn[],
  opts: { sqft: number; price: number; sizeTolerance?: number; months?: number; maxMonth?: string }
): ValuationResult {
  const tol = opts.sizeTolerance ?? 0.15;
  const months = opts.months ?? 24;
  const sizeLow = opts.sqft * (1 - tol);
  const sizeHigh = opts.sqft * (1 + tol);

  // Recency window from the dataset's latest month.
  let cutoff = "0000-00";
  if (opts.maxMonth) {
    const [y, m] = opts.maxMonth.split("-").map(Number);
    const total = y * 12 + (m - 1) - (months - 1);
    cutoff = `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
  }

  const comps = txns.filter(
    (t) => t.areaSqft >= sizeLow && t.areaSqft <= sizeHigh && (!opts.maxMonth || t.month >= cutoff)
  );
  const psfs = comps.map((t) => t.psf);
  const enteredPsf = opts.sqft > 0 ? opts.price / opts.sqft : null;

  if (!psfs.length || enteredPsf == null) {
    return {
      enteredPsf,
      count: 0,
      percentile: null,
      median: null,
      p25: null,
      p75: null,
      min: null,
      max: null,
      verdict: null,
      monthsWindow: months,
      sizeLow: Math.round(sizeLow),
      sizeHigh: Math.round(sizeHigh),
    };
  }

  const below = psfs.filter((p) => p < enteredPsf).length;
  const percentile = Math.round((below / psfs.length) * 100);
  const verdict =
    percentile <= 15 ? "well below" : percentile <= 40 ? "below" : percentile <= 60 ? "around" : percentile <= 85 ? "above" : "well above";

  return {
    enteredPsf: round(enteredPsf),
    count: psfs.length,
    percentile,
    median: round(median(psfs)),
    p25: round(quantile(psfs, 0.25)),
    p75: round(quantile(psfs, 0.75)),
    min: round(Math.min(...psfs)),
    max: round(Math.max(...psfs)),
    verdict,
    monthsWindow: months,
    sizeLow: Math.round(sizeLow),
    sizeHigh: Math.round(sizeHigh),
  };
}

// ---- New-launch vs resale premium -------------------------------------------
// Compares New Sale vs Resale median PSF within the SAME filtered bucket (so the
// caller controls attribute-matching: district, size band, tenure, type).

export interface PremiumPoint {
  period: string;
  newPsf: number | null;
  resalePsf: number | null;
  premiumPct: number | null; // (new - resale) / resale
  newVol: number;
  resaleVol: number;
}

export interface PremiumResult {
  points: PremiumPoint[];
  currentPremiumPct: number | null; // most recent period with both
  avgPremiumPct: number | null; // mean across periods with both
  latestNewPsf: number | null;
  latestResalePsf: number | null;
}

export function newVsResale(txns: Txn[], groupBy: "quarter" | "year" = "year"): PremiumResult {
  const key = (t: Txn) => (groupBy === "year" ? String(t.year) : t.quarter);
  const periods = new Map<string, { neu: number[]; resale: number[] }>();
  for (const t of txns) {
    const k = key(t);
    if (!periods.has(k)) periods.set(k, { neu: [], resale: [] });
    const bucket = periods.get(k)!;
    if (t.saleType === "New Sale") bucket.neu.push(t.psf);
    else if (t.saleType === "Resale") bucket.resale.push(t.psf);
  }
  const points: PremiumPoint[] = Array.from(periods.entries())
    .map(([period, b]) => {
      const newPsf = round(median(b.neu));
      const resalePsf = round(median(b.resale));
      const premiumPct = newPsf && resalePsf ? round(((newPsf - resalePsf) / resalePsf) * 100, 1) : null;
      return { period, newPsf, resalePsf, premiumPct, newVol: b.neu.length, resaleVol: b.resale.length };
    })
    .sort((a, b) => a.period.localeCompare(b.period));

  const withBoth = points.filter((p) => p.premiumPct != null);
  const latest = withBoth[withBoth.length - 1];
  const avg = withBoth.length ? round(mean(withBoth.map((p) => p.premiumPct!)), 1) : null;
  return {
    points,
    currentPremiumPct: latest?.premiumPct ?? null,
    avgPremiumPct: avg,
    latestNewPsf: latest?.newPsf ?? null,
    latestResalePsf: latest?.resalePsf ?? null,
  };
}

// ---- Framework 2: Comparables / project drill-down --------------------------

export interface ComparablesResult {
  total: number;
  page: number;
  pageSize: number;
  summary: { medianPsf: number | null; medianPrice: number | null; avgArea: number | null };
  rows: Txn[];
}

export function comparables(
  txns: Txn[],
  sort: keyof Txn = "date",
  dir: "asc" | "desc" = "desc",
  page = 1,
  pageSize = 50
): ComparablesResult {
  const sorted = [...txns].sort((a, b) => {
    const av = a[sort] as number | string;
    const bv = b[sort] as number | string;
    if (av < bv) return dir === "asc" ? -1 : 1;
    if (av > bv) return dir === "asc" ? 1 : -1;
    return 0;
  });
  const start = (page - 1) * pageSize;
  return {
    total: txns.length,
    page,
    pageSize,
    summary: {
      medianPsf: round(median(txns.map((t) => t.psf))),
      medianPrice: round(median(txns.map((t) => t.price))),
      avgArea: round(mean(txns.map((t) => t.areaSqft))),
    },
    rows: sorted.slice(start, start + pageSize),
  };
}

// ---- Framework 3: Rental yield ----------------------------------------------
// Yield is an ESTIMATE: median annualised rent for a segment over median price
// for the comparable segment. Rent and sale caveats are not the same unit, so
// this is a market-level gross yield, not a unit-level figure.

export type BedBand = "Studio/1BR" | "2BR" | "3BR" | "4BR+";

export function areaToBedBand(sqm: number): BedBand {
  if (sqm <= 50) return "Studio/1BR";
  if (sqm <= 80) return "2BR";
  if (sqm <= 115) return "3BR";
  return "4BR+";
}

export function bedroomsToBand(bed: number | null, areaSqftMid: number | null): BedBand {
  if (bed != null && bed > 0) {
    if (bed === 1) return "Studio/1BR";
    if (bed === 2) return "2BR";
    if (bed === 3) return "3BR";
    return "4BR+";
  }
  if (areaSqftMid != null) return areaToBedBand(areaSqftMid / 10.7639);
  return "2BR";
}

export interface YieldRow {
  key: string;
  district: string;
  project?: string;
  bedBand: BedBand;
  medianMonthlyRent: number | null;
  medianPrice: number | null;
  grossYieldPct: number | null;
  rentSamples: number;
  saleSamples: number;
}

export function rentalYield(
  ds: Dataset,
  filter: TxnFilter,
  level: "district" | "project" = "district"
): YieldRow[] {
  const txns = applyFilters(ds.txns, filter);
  // Only use reasonably recent sales so price base tracks current rents.
  const recentCut = ds.rentalQuarters.length ? ds.rentalQuarters[0].slice(0, 4) : "2000";
  const rentals = ds.rentals.filter((r) => {
    if (filter.district && r.district !== filter.district) return false;
    if (filter.project && r.project !== filter.project) return false;
    if (filter.propertyType && r.propertyType !== filter.propertyType) return false;
    return true;
  });

  const groupKey = (district: string, project: string | undefined, band: BedBand) =>
    level === "project" ? `${district}|${project}|${band}` : `${district}|${band}`;

  const rentGroups = new Map<string, number[]>();
  for (const r of rentals) {
    const band = bedroomsToBand(r.bedrooms, r.areaSqftMid);
    const k = groupKey(r.district, r.project, band);
    (rentGroups.get(k) || rentGroups.set(k, []).get(k)!).push(r.rent);
  }

  const saleGroups = new Map<string, number[]>();
  for (const t of txns) {
    if (t.year < parseInt(recentCut, 10) - 1) continue; // last ~2 years of sales
    const band = areaToBedBand(t.areaSqm);
    const k = groupKey(t.district, t.project, band);
    (saleGroups.get(k) || saleGroups.set(k, []).get(k)!).push(t.price);
  }

  const rows: YieldRow[] = [];
  for (const [k, rentList] of rentGroups.entries()) {
    const saleList = saleGroups.get(k);
    if (!saleList || saleList.length < 2 || rentList.length < 2) continue;
    const [district, maybeProject, band] = level === "project" ? k.split("|") : [k.split("|")[0], undefined, k.split("|")[1]];
    const medRent = median(rentList);
    const medPrice = median(saleList);
    const yieldPct = medRent && medPrice ? ((medRent * 12) / medPrice) * 100 : null;
    rows.push({
      key: k,
      district,
      project: maybeProject,
      bedBand: band as BedBand,
      medianMonthlyRent: round(medRent),
      medianPrice: round(medPrice),
      grossYieldPct: round(yieldPct, 2),
      rentSamples: rentList.length,
      saleSamples: saleList.length,
    });
  }
  return rows.sort((a, b) => (b.grossYieldPct ?? 0) - (a.grossYieldPct ?? 0));
}

// ---- Framework 4: Asset progression / appreciation --------------------------
// URA caveats have no unit ID, so true buy→sell matching is not possible. This
// measures project-level appreciation: median PSF per year and the compound
// growth between the first and latest full year with data.

export interface AppreciationRow {
  project: string;
  district: string;
  tenureType: string;
  firstYear: number;
  lastYear: number;
  firstPsf: number | null;
  lastPsf: number | null;
  totalGrowthPct: number | null;
  cagrPct: number | null;
  totalVolume: number;
  yearly: { year: number; medianPsf: number | null; volume: number }[];
}

export function appreciation(ds: Dataset, filter: TxnFilter): AppreciationRow[] {
  const txns = applyFilters(ds.txns, filter);
  const byProject = new Map<string, Txn[]>();
  for (const t of txns) {
    (byProject.get(t.project) || byProject.set(t.project, []).get(t.project)!).push(t);
  }
  const rows: AppreciationRow[] = [];
  for (const [project, list] of byProject.entries()) {
    if (list.length < 8) continue; // need enough depth to be meaningful
    const byYear = new Map<number, number[]>();
    for (const t of list) {
      (byYear.get(t.year) || byYear.set(t.year, []).get(t.year)!).push(t.psf);
    }
    const yearly = Array.from(byYear.entries())
      .map(([year, psfs]) => ({ year, medianPsf: round(median(psfs)), volume: psfs.length }))
      .filter((y) => y.volume >= 2)
      .sort((a, b) => a.year - b.year);
    if (yearly.length < 2) continue;
    const first = yearly[0];
    const last = yearly[yearly.length - 1];
    const years = last.year - first.year;
    const totalGrowth =
      first.medianPsf && last.medianPsf ? ((last.medianPsf - first.medianPsf) / first.medianPsf) * 100 : null;
    const cagrPct =
      first.medianPsf && last.medianPsf && years > 0
        ? (Math.pow(last.medianPsf / first.medianPsf, 1 / years) - 1) * 100
        : null;
    rows.push({
      project,
      district: list[0].district,
      tenureType: list[0].tenureType,
      firstYear: first.year,
      lastYear: last.year,
      firstPsf: first.medianPsf,
      lastPsf: last.medianPsf,
      totalGrowthPct: round(totalGrowth, 1),
      cagrPct: round(cagrPct, 1),
      totalVolume: list.length,
      yearly,
    });
  }
  return rows.sort((a, b) => (b.cagrPct ?? -99) - (a.cagrPct ?? -99));
}

function round(n: number | null | undefined, dp = 0): number | null {
  if (n == null || Number.isNaN(n)) return null;
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}
