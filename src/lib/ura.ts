// Server-only URA data service client.
//
// Auth flow: POST the AccessKey to the token endpoint once per day to receive a
// daily Token, then call the invoke endpoint with both AccessKey and Token.
// Private residential transactions come in 4 batches (postal districts split by
// region). Rental contracts are pulled per reference quarter (yyqq).
//
// URA rejects requests without a browser-like User-Agent, so we always send one.

import "server-only";
import {
  Dataset,
  Txn,
  Rental,
  UraRawTransactionGroup,
  UraRawRentalGroup,
  MarketSegment,
  SaleType,
} from "./types";
import { parseMMYY, rangeMidpoint, sqmToSqft } from "./format";

const TOKEN_URL =
  process.env.URA_TOKEN_URL ||
  "https://eservice.ura.gov.sg/uraDataService/insertNewToken/v1";
const INVOKE_URL =
  process.env.URA_INVOKE_URL ||
  "https://eservice.ura.gov.sg/uraDataService/invokeUraDS/v1";
const TXN_SERVICE = process.env.URA_TXN_SERVICE || "PMI_Resi_Transaction";
const RENTAL_SERVICE = process.env.URA_RENTAL_SERVICE || "PMI_Resi_Rental";
const USER_AGENT =
  "Mozilla/5.0 (compatible; SG-Property-App/1.0; +https://localhost)";

const SALE_TYPE_MAP: Record<string, SaleType> = {
  "1": "New Sale",
  "2": "Sub Sale",
  "3": "Resale",
};

function classifyTenure(raw: string): {
  tenureType: "Freehold" | "Leasehold";
  leaseYears: number | null;
  leaseStartYear: number | null;
} {
  const t = (raw || "").toLowerCase();
  if (t.includes("freehold")) {
    return { tenureType: "Freehold", leaseYears: null, leaseStartYear: null };
  }
  const yearsMatch = t.match(/(\d{2,4})\s*yr/);
  const startMatch = t.match(/from\s*(\d{4})/);
  return {
    tenureType: "Leasehold",
    leaseYears: yearsMatch ? parseInt(yearsMatch[1], 10) : null,
    leaseStartYear: startMatch ? parseInt(startMatch[1], 10) : null,
  };
}

export async function getToken(accessKey: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "GET",
    headers: { AccessKey: accessKey, "User-Agent": USER_AGENT },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`URA token request failed: ${res.status}`);
  const json = await res.json();
  if (json.Status !== "Success" || !json.Result) {
    throw new Error(`URA token error: ${json.Message || "unknown"}`);
  }
  return json.Result as string;
}

async function invoke(
  accessKey: string,
  token: string,
  service: string,
  params: Record<string, string>
): Promise<unknown[]> {
  const qs = new URLSearchParams({ service, ...params }).toString();
  const res = await fetch(`${INVOKE_URL}?${qs}`, {
    method: "GET",
    headers: {
      AccessKey: accessKey,
      Token: token,
      "User-Agent": USER_AGENT,
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`URA invoke failed (${service}): ${res.status}`);
  const json = await res.json();
  if (json.Status && json.Status !== "Success") {
    throw new Error(`URA invoke error (${service}): ${json.Message}`);
  }
  return (json.Result as unknown[]) || [];
}

export function normalizeTransactions(groups: UraRawTransactionGroup[]): Txn[] {
  const out: Txn[] = [];
  let seq = 0;
  for (const g of groups) {
    for (const t of g.transaction || []) {
      const areaSqm = parseFloat(t.area);
      const price = parseFloat(t.price);
      const nett = t.nettPrice ? parseFloat(t.nettPrice) : null;
      const effectivePrice = nett && nett > 0 ? nett : price;
      const d = parseMMYY(t.contractDate);
      if (!areaSqm || !effectivePrice || !d) continue;
      const areaSqft = sqmToSqft(areaSqm);
      const tenure = classifyTenure(t.tenure);
      out.push({
        id: `t${seq++}`,
        project: g.project,
        street: g.street,
        marketSegment: (g.marketSegment as MarketSegment) || "",
        district: String(t.district).padStart(2, "0"),
        propertyType: t.propertyType,
        saleType: SALE_TYPE_MAP[t.typeOfSale] || "Resale",
        tenure: t.tenure,
        tenureType: tenure.tenureType,
        leaseYears: tenure.leaseYears,
        leaseStartYear: tenure.leaseStartYear,
        floorRange: t.floorRange || null,
        areaSqm,
        areaSqft,
        price,
        nettPrice: nett,
        psf: effectivePrice / areaSqft,
        psm: effectivePrice / areaSqm,
        contractDate: t.contractDate,
        date: d.iso,
        year: d.year,
        quarter: d.quarter,
        month: d.month,
      });
    }
  }
  return out;
}

export function normalizeRentals(groups: UraRawRentalGroup[]): Rental[] {
  const out: Rental[] = [];
  let seq = 0;
  for (const g of groups) {
    for (const r of g.rental || []) {
      const rent = parseFloat(r.rent);
      const d = parseMMYY(r.leaseDate);
      if (!rent || !d) continue;
      out.push({
        id: `r${seq++}`,
        project: g.project,
        street: g.street,
        district: String(r.district).padStart(2, "0"),
        propertyType: r.propertyType,
        bedrooms: r.noOfBedRoom ? parseInt(r.noOfBedRoom, 10) || null : null,
        areaSqftMid: rangeMidpoint(r.areaSqft),
        rent,
        leaseDate: r.leaseDate,
        date: d.iso,
        year: d.year,
        quarter: d.quarter,
      });
    }
  }
  return out;
}

// Reference quarters (yyqq) for the last `n` quarters up to a given year/quarter.
function recentRefPeriods(n: number, curYear: number, curQuarter: number): string[] {
  const periods: string[] = [];
  let y = curYear;
  let q = curQuarter;
  for (let i = 0; i < n; i++) {
    periods.push(`${String(y % 100).padStart(2, "0")}q${q}`);
    q--;
    if (q < 1) {
      q = 4;
      y--;
    }
  }
  return periods;
}

export async function fetchDataset(
  accessKey: string,
  opts: { rentalQuarters?: number; now?: Date } = {}
): Promise<Dataset> {
  const token = await getToken(accessKey);

  // Transactions: 4 batches.
  const txnGroups: UraRawTransactionGroup[] = [];
  for (const batch of ["1", "2", "3", "4"]) {
    const res = (await invoke(accessKey, token, TXN_SERVICE, { batch })) as UraRawTransactionGroup[];
    txnGroups.push(...res);
  }
  const txns = normalizeTransactions(txnGroups);

  // Rentals: last N quarters.
  const now = opts.now || new Date();
  const curQuarter = Math.floor(now.getMonth() / 3) + 1;
  const periods = recentRefPeriods(opts.rentalQuarters ?? 6, now.getFullYear(), curQuarter);
  const rentalGroups: UraRawRentalGroup[] = [];
  for (const refPeriod of periods) {
    try {
      const res = (await invoke(accessKey, token, RENTAL_SERVICE, { refPeriod })) as UraRawRentalGroup[];
      rentalGroups.push(...res);
    } catch {
      // A missing/future quarter should not abort the whole pull.
    }
  }
  const rentals = normalizeRentals(rentalGroups);

  const months = txns.map((t) => t.month).sort();
  const rentalQ = Array.from(new Set(rentals.map((r) => r.quarter))).sort();

  return {
    txns,
    rentals,
    source: "URA",
    fetchedAt: new Date().toISOString(),
    transactionMonths: months.length ? { min: months[0], max: months[months.length - 1] } : null,
    rentalQuarters: rentalQ,
  };
}
