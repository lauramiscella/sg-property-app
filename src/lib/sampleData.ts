// Deterministic sample dataset so the app is fully functional before a URA
// access key is added. Numbers are plausible but SYNTHETIC — the UI badges this
// clearly as SAMPLE DATA. Once URA_ACCESS_KEY is set, real data replaces this.

import "server-only";
import { Dataset, Txn, Rental, SaleType } from "./types";
import { parseMMYY, sqmToSqft } from "./format";

// Small seeded PRNG (mulberry32) for reproducible output.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface ProjectSpec {
  project: string;
  street: string;
  district: string;
  segment: "CCR" | "RCR" | "OCR";
  type: string;
  tenure: string;
  base2020Psf: number; // median PSF in 2020
  annualGrowth: number; // fractional
  sizesSqm: number[]; // typical unit sizes
  volume: number; // rough transactions/year
}

const PROJECTS: ProjectSpec[] = [
  // District 15 — the home turf, well represented.
  { project: "The Continuum", street: "Thiam Siew Avenue", district: "15", segment: "RCR", type: "Condominium", tenure: "Freehold", base2020Psf: 1750, annualGrowth: 0.075, sizesSqm: [45, 65, 90, 120], volume: 40 },
  { project: "Amber Sea", street: "Amber Gardens", district: "15", segment: "RCR", type: "Condominium", tenure: "Freehold", base2020Psf: 1900, annualGrowth: 0.07, sizesSqm: [50, 70, 100], volume: 26 },
  { project: "Meyer Mansion", street: "Meyer Road", district: "15", segment: "RCR", type: "Condominium", tenure: "Freehold", base2020Psf: 2100, annualGrowth: 0.06, sizesSqm: [55, 75, 110], volume: 22 },
  { project: "Tembusu Grand", street: "Jalan Tembusu", district: "15", segment: "RCR", type: "Condominium", tenure: "99 yrs lease commencing from 2022", base2020Psf: 1650, annualGrowth: 0.08, sizesSqm: [46, 63, 92, 130], volume: 44 },
  { project: "The Sea View", street: "Amber Road", district: "15", segment: "RCR", type: "Condominium", tenure: "Freehold", base2020Psf: 1500, annualGrowth: 0.055, sizesSqm: [90, 120, 165], volume: 30 },
  { project: "Casa Meyfort", street: "Meyer Road", district: "15", segment: "RCR", type: "Condominium", tenure: "Freehold", base2020Psf: 1780, annualGrowth: 0.065, sizesSqm: [50, 72, 105], volume: 24 },
  // District 9/10/11 — core central.
  { project: "Midtown Modern", street: "Tan Quee Lan Street", district: "7", segment: "CCR", type: "Condominium", tenure: "99 yrs lease commencing from 2021", base2020Psf: 2600, annualGrowth: 0.045, sizesSqm: [40, 60, 95], volume: 28 },
  { project: "Leedon Green", street: "Leedon Heights", district: "10", segment: "CCR", type: "Condominium", tenure: "Freehold", base2020Psf: 2750, annualGrowth: 0.04, sizesSqm: [55, 85, 130], volume: 24 },
  { project: "The Avenir", street: "River Valley Close", district: "9", segment: "CCR", type: "Condominium", tenure: "Freehold", base2020Psf: 2900, annualGrowth: 0.05, sizesSqm: [50, 80, 120], volume: 20 },
  { project: "Hyll on Holland", street: "Holland Road", district: "10", segment: "CCR", type: "Condominium", tenure: "Freehold", base2020Psf: 2500, annualGrowth: 0.045, sizesSqm: [45, 70, 110], volume: 18 },
  // OCR mass-market.
  { project: "Normanton Park", street: "Normanton Park", district: "5", segment: "RCR", type: "Condominium", tenure: "99 yrs lease commencing from 2020", base2020Psf: 1650, annualGrowth: 0.07, sizesSqm: [45, 65, 90, 120], volume: 60 },
  { project: "The Florence Residences", street: "Hougang Avenue 2", district: "19", segment: "OCR", type: "Condominium", tenure: "99 yrs lease commencing from 2019", base2020Psf: 1450, annualGrowth: 0.075, sizesSqm: [46, 63, 90, 115], volume: 50 },
  { project: "Parc Clematis", street: "Jalan Lempeng", district: "5", segment: "OCR", type: "Condominium", tenure: "99 yrs lease commencing from 2019", base2020Psf: 1550, annualGrowth: 0.07, sizesSqm: [45, 65, 95, 125], volume: 55 },
  { project: "Treasure at Tampines", street: "Tampines Lane", district: "18", segment: "OCR", type: "Condominium", tenure: "99 yrs lease commencing from 2019", base2020Psf: 1350, annualGrowth: 0.08, sizesSqm: [45, 63, 90, 110], volume: 65 },
  { project: "Affinity at Serangoon", street: "Serangoon North Avenue 1", district: "19", segment: "OCR", type: "Condominium", tenure: "99 yrs lease commencing from 2018", base2020Psf: 1400, annualGrowth: 0.075, sizesSqm: [46, 60, 85, 110], volume: 45 },
  { project: "Riverfront Residences", street: "Hougang Avenue 7", district: "19", segment: "OCR", type: "Condominium", tenure: "99 yrs lease commencing from 2018", base2020Psf: 1380, annualGrowth: 0.078, sizesSqm: [45, 60, 85, 120], volume: 48 },
  // A few landed + apartment types for variety.
  { project: "Jansen Mansions", street: "Jansen Road", district: "19", segment: "OCR", type: "Terrace", tenure: "Freehold", base2020Psf: 1250, annualGrowth: 0.06, sizesSqm: [200, 260, 320], volume: 8 },
  { project: "Katong Park Towers", street: "Arthur Road", district: "15", segment: "RCR", type: "Apartment", tenure: "Freehold", base2020Psf: 1600, annualGrowth: 0.06, sizesSqm: [70, 100, 140], volume: 12 },
];

const SALE_TYPES: SaleType[] = ["New Sale", "Resale", "Sub Sale"];

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function gaussian(rng: () => number): number {
  // Box–Muller.
  const u = 1 - rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function buildSampleDataset(now = new Date()): Dataset {
  const rng = mulberry32(20260721);
  const txns: Txn[] = [];
  const rentals: Rental[] = [];
  let tSeq = 0;
  let rSeq = 0;

  const endYear = now.getFullYear();
  const endMonth = now.getMonth() + 1; // 1-12

  for (const p of PROJECTS) {
    for (let year = 2020; year <= endYear; year++) {
      const perYear = Math.max(4, Math.round(p.volume * (0.85 + rng() * 0.3)));
      for (let k = 0; k < perYear; k++) {
        const month = 1 + Math.floor(rng() * 12);
        if (year === endYear && month > endMonth) continue;
        const yearsFrom2020 = year - 2020 + (month - 1) / 12;
        const trendPsf = p.base2020Psf * Math.pow(1 + p.annualGrowth, yearsFrom2020);
        const noise = 1 + gaussian(rng) * 0.06; // ±6% unit variation
        const floorPremium = 1 + (rng() - 0.5) * 0.08; // floor/stack effect
        const psf = trendPsf * noise * floorPremium;
        const areaSqm = pick(rng, p.sizesSqm) * (0.97 + rng() * 0.06);
        const areaSqft = sqmToSqft(areaSqm);
        const price = Math.round((psf * areaSqft) / 1000) * 1000;
        const d = parseMMYY(`${String(month).padStart(2, "0")}${String(year % 100).padStart(2, "0")}`)!;
        const saleType =
          year <= 2021 ? (rng() < 0.7 ? "New Sale" : "Resale") : (rng() < 0.55 ? "Resale" : pick(rng, SALE_TYPES));
        const floorLow = 1 + Math.floor(rng() * 20);
        txns.push({
          id: `s${tSeq++}`,
          project: p.project,
          street: p.street,
          marketSegment: p.segment,
          district: p.district.padStart(2, "0"),
          propertyType: p.type,
          saleType,
          tenure: p.tenure,
          tenureType: p.tenure.toLowerCase().includes("freehold") ? "Freehold" : "Leasehold",
          leaseYears: p.tenure.toLowerCase().includes("freehold") ? null : 99,
          leaseStartYear: (p.tenure.match(/from (\d{4})/)?.[1] && parseInt(p.tenure.match(/from (\d{4})/)![1], 10)) || null,
          floorRange: `${String(floorLow).padStart(2, "0")}-${String(floorLow + 4).padStart(2, "0")}`,
          areaSqm: Math.round(areaSqm * 10) / 10,
          areaSqft: Math.round(areaSqft),
          price,
          nettPrice: null,
          psf: price / areaSqft,
          psm: price / areaSqm,
          contractDate: d.month.slice(5) + d.month.slice(2, 4),
          date: d.iso,
          year: d.year,
          quarter: d.quarter,
          month: d.month,
        });
      }
    }

    // Rentals for the last 6 quarters, priced off a rent-to-PSF relationship.
    for (let qi = 0; qi < 6; qi++) {
      let y = endYear;
      let q = Math.floor((endMonth - 1) / 3) + 1 - qi;
      while (q < 1) {
        q += 4;
        y -= 1;
      }
      const rentPerYear = Math.max(3, Math.round(p.volume * 0.4));
      for (let k = 0; k < rentPerYear; k++) {
        const areaSqm = pick(rng, p.sizesSqm) * (0.97 + rng() * 0.06);
        const areaSqft = sqmToSqft(areaSqm);
        const yearsFrom2020 = y - 2020 + (q * 3 - 2) / 12;
        const trendPsf = p.base2020Psf * Math.pow(1 + p.annualGrowth, yearsFrom2020);
        // Monthly rent psf typically ~ sale psf / 260 for SG condos, with noise.
        const rentPsfMonthly = (trendPsf / 330) * (0.9 + rng() * 0.2);
        const rent = Math.round((rentPsfMonthly * areaSqft) / 50) * 50;
        const bedrooms = areaSqm < 50 ? 1 : areaSqm < 80 ? 2 : areaSqm < 115 ? 3 : 4;
        const month = (q - 1) * 3 + 1 + Math.floor(rng() * 3);
        const d = parseMMYY(`${String(month).padStart(2, "0")}${String(y % 100).padStart(2, "0")}`)!;
        rentals.push({
          id: `sr${rSeq++}`,
          project: p.project,
          street: p.street,
          district: p.district.padStart(2, "0"),
          propertyType: p.type,
          bedrooms,
          areaSqftMid: Math.round(areaSqft),
          rent,
          leaseDate: d.month.slice(5) + d.month.slice(2, 4),
          date: d.iso,
          year: d.year,
          quarter: d.quarter,
        });
      }
    }
  }

  const months = txns.map((t) => t.month).sort();
  const rentalQ = Array.from(new Set(rentals.map((r) => r.quarter))).sort();

  return {
    txns,
    rentals,
    source: "SAMPLE",
    fetchedAt: now.toISOString(),
    transactionMonths: months.length ? { min: months[0], max: months[months.length - 1] } : null,
    rentalQuarters: rentalQ,
  };
}
