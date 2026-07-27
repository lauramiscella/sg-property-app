// Singapore residential purchase-cost + financing math.
//
// ACCURACY NOTE: rates below were verified against IRAS and MAS on 21 Jul 2026.
// Cooling measures change — every figure is editable in the UI and the app links
// to the primary source so the user confirms before advising. Nothing is
// presented as guaranteed-current.

export const RATE_NOTES = {
  verified: "21 Jul 2026",
  bsdEffective: "15 Feb 2023",
  absdEffective: "27 Apr 2023",
  ssdEffective: "4 Jul 2025 (4-yr: 16/12/8/4%)",
  ltvTdsrEffective: "MAS rules, TDSR floor 4% since Sep 2022",
  sources: [
    { label: "IRAS – Buyer's Stamp Duty", url: "https://www.iras.gov.sg/taxes/stamp-duty/for-property/buying-or-acquiring-property/buyer's-stamp-duty-(bsd)" },
    { label: "IRAS – Additional Buyer's Stamp Duty", url: "https://www.iras.gov.sg/taxes/stamp-duty/for-property/buying-or-acquiring-property/additional-buyer's-stamp-duty-(absd)" },
    { label: "IRAS – Seller's Stamp Duty", url: "https://www.iras.gov.sg/taxes/stamp-duty/for-property/selling-or-disposing-property/seller's-stamp-duty-(ssd)-for-residential-property" },
    { label: "MAS – Loan tenure & LTV limits", url: "https://www.mas.gov.sg/regulation/explainers/new-housing-loans/loan-tenure-and-loan-to-value-limits" },
  ],
};

// Buyer's Stamp Duty — residential, marginal bands (effective 15 Feb 2023).
export const BSD_BANDS: { upTo: number | null; rate: number }[] = [
  { upTo: 180_000, rate: 0.01 },
  { upTo: 360_000, rate: 0.02 },
  { upTo: 1_000_000, rate: 0.03 },
  { upTo: 1_500_000, rate: 0.04 },
  { upTo: 3_000_000, rate: 0.05 },
  { upTo: null, rate: 0.06 },
];

export function buyerStampDuty(price: number): number {
  let remaining = price;
  let prevCap = 0;
  let duty = 0;
  for (const band of BSD_BANDS) {
    const cap = band.upTo ?? Infinity;
    const bandWidth = cap - prevCap;
    const taxable = Math.max(0, Math.min(remaining, bandWidth));
    duty += taxable * band.rate;
    remaining -= taxable;
    prevCap = cap;
    if (remaining <= 0) break;
  }
  return Math.round(duty);
}

// Additional Buyer's Stamp Duty (effective 27 Apr 2023).
export type BuyerProfile = "SC" | "PR" | "Foreigner" | "Entity";

export const ABSD_RATES: Record<BuyerProfile, { first: number; second: number; third: number }> = {
  SC: { first: 0.0, second: 0.2, third: 0.3 },
  PR: { first: 0.05, second: 0.3, third: 0.35 },
  Foreigner: { first: 0.6, second: 0.6, third: 0.6 },
  Entity: { first: 0.65, second: 0.65, third: 0.65 },
};

export function absdRate(profile: BuyerProfile, propertyCount: number): number {
  const r = ABSD_RATES[profile];
  return propertyCount <= 1 ? r.first : propertyCount === 2 ? r.second : r.third;
}

export function absd(price: number, profile: BuyerProfile, propertyCount: number): number {
  return Math.round(price * absdRate(profile, propertyCount));
}

// LTV cap by number of OUTSTANDING housing loans + tenure/age (MAS).
// First loan 75% (5% cash); second 45% (25% cash); third+ 35% (25% cash).
// Reduced to 55/25/15% if tenure > 30yr OR age + tenure > 65.
export function ltv(
  outstandingLoans: number,
  loanTenureYears: number,
  borrowerAge: number
): { cap: number; minCashPct: number; reduced: boolean } {
  const reduced = loanTenureYears > 30 || borrowerAge + loanTenureYears > 65;
  if (outstandingLoans <= 0) return { cap: reduced ? 0.55 : 0.75, minCashPct: reduced ? 0.1 : 0.05, reduced };
  if (outstandingLoans === 1) return { cap: reduced ? 0.25 : 0.45, minCashPct: 0.25, reduced };
  return { cap: reduced ? 0.15 : 0.35, minCashPct: 0.25, reduced };
}

export const TDSR_LIMIT = 0.55;
export const MEDIUM_TERM_STRESS_RATE = 0.04; // MAS medium-term rate floor for TDSR.

export function monthlyRepayment(principal: number, annualRate: number, tenureYears: number): number {
  const r = annualRate / 12;
  const n = tenureYears * 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

export function maxLoanByTdsr(grossMonthlyIncome: number, monthlyDebt: number, tenureYears: number): number {
  const avail = Math.max(0, grossMonthlyIncome * TDSR_LIMIT - monthlyDebt);
  const rs = MEDIUM_TERM_STRESS_RATE / 12;
  const n = tenureYears * 12;
  return rs === 0 ? avail * n : (avail * (1 - Math.pow(1 + rs, -n))) / rs;
}

// ---- Single purchase --------------------------------------------------------

export interface AffordabilityInput {
  price: number;
  profile: BuyerProfile;
  propertyCount: number; // for ABSD
  outstandingLoans: number; // for LTV
  grossMonthlyIncome: number;
  monthlyDebt: number;
  borrowerAge: number;
  loanTenureYears: number;
  interestRate: number; // actual, for repayment estimate
}

export interface AffordabilityResult {
  bsd: number;
  absd: number;
  absdRate: number;
  ltvCap: number;
  reduced: boolean;
  maxLoanByLtv: number;
  minCashDownpayment: number;
  totalDownpayment: number;
  cpfDownpayment: number;
  maxLoanByTdsr: number;
  bindingConstraint: "LTV" | "TDSR";
  eligibleLoan: number;
  estMonthlyRepayment: number;
  totalUpfrontCash: number;
  totalStampDuty: number;
}

export function assessAffordability(i: AffordabilityInput): AffordabilityResult {
  const bsd = buyerStampDuty(i.price);
  const absdVal = absd(i.price, i.profile, i.propertyCount);
  const L = ltv(i.outstandingLoans, i.loanTenureYears, i.borrowerAge);
  const maxLoanByLtv = i.price * L.cap;
  const minCash = i.price * L.minCashPct;
  const totalDown = i.price - maxLoanByLtv;
  const tdsr = maxLoanByTdsr(i.grossMonthlyIncome, i.monthlyDebt, i.loanTenureYears);
  const eligibleLoan = Math.min(maxLoanByLtv, tdsr);
  const bindingConstraint = tdsr < maxLoanByLtv ? "TDSR" : "LTV";
  return {
    bsd,
    absd: absdVal,
    absdRate: absdRate(i.profile, i.propertyCount),
    ltvCap: L.cap,
    reduced: L.reduced,
    maxLoanByLtv,
    minCashDownpayment: minCash,
    totalDownpayment: totalDown,
    cpfDownpayment: Math.max(0, totalDown - minCash),
    maxLoanByTdsr: tdsr,
    bindingConstraint,
    eligibleLoan,
    estMonthlyRepayment: monthlyRepayment(eligibleLoan, i.interestRate, i.loanTenureYears),
    totalUpfrontCash: minCash + bsd + absdVal,
    totalStampDuty: bsd + absdVal,
  };
}

// ---- Asset progression (upgrade path) ---------------------------------------

export interface ProgressionInput {
  salePrice: number;
  outstandingMortgage: number;
  agentFeePct: number; // e.g. 2
  gstPct: number; // e.g. 9
  cpfPrincipalUsed: number;
  cpfAccruedInterest: number;
  yearsHeld: number; // holding period — drives accrued-interest estimate AND SSD
  boughtOnOrAfterJul2025: boolean; // selects the SSD schedule
  nextPrice: number;
  nextProfile: BuyerProfile;
  order: "sellfirst" | "buyfirst";
  nextTenureYears: number;
  nextAge: number;
}

export interface ProgressionResult {
  sellingCost: number;
  ssd: number;
  ssdRate: number;
  netSaleBalance: number;
  cpfRefund: number;
  cashInHand: number;
  fundsForNext: number;
  nextBsd: number;
  nextAbsd: number;
  nextAbsdRate: number;
  nextDownpayment: number;
  nextLtvCap: number;
  totalNeeded: number;
  surplus: number;
}

export function estimateAccruedInterest(cpfPrincipal: number, yearsHeld: number): number {
  return Math.round(cpfPrincipal * (Math.pow(1.025, yearsHeld) - 1));
}

export function assessProgression(i: ProgressionInput): ProgressionResult {
  const sellingCost = i.salePrice * (i.agentFeePct / 100) * (1 + i.gstPct / 100);
  const ssd = sellerStampDuty(i.salePrice, i.yearsHeld, i.boughtOnOrAfterJul2025);
  const netSaleBalance = i.salePrice - i.outstandingMortgage - sellingCost - ssd;
  const cpfRefund = i.cpfPrincipalUsed + i.cpfAccruedInterest;
  const cashInHand = netSaleBalance - cpfRefund;
  const fundsForNext = netSaleBalance; // cash + CPF both fund the next home

  const nextBsd = buyerStampDuty(i.nextPrice);
  // Sell-first => next is the only property (count 1). Buy-first => still own 1 => count 2.
  const count = i.order === "buyfirst" ? 2 : 1;
  const nextAbsd = absd(i.nextPrice, i.nextProfile, count);
  // Loan cleared on sale, so the next loan is a first loan again.
  const L = ltv(0, i.nextTenureYears, i.nextAge);
  const nextDownpayment = i.nextPrice * (1 - L.cap);
  const totalNeeded = nextDownpayment + nextBsd + nextAbsd;

  return {
    sellingCost: Math.round(sellingCost),
    ssd,
    ssdRate: ssdRate(i.yearsHeld, i.boughtOnOrAfterJul2025),
    netSaleBalance: Math.round(netSaleBalance),
    cpfRefund: Math.round(cpfRefund),
    cashInHand: Math.round(cashInHand),
    fundsForNext: Math.round(fundsForNext),
    nextBsd,
    nextAbsd,
    nextAbsdRate: absdRate(i.nextProfile, count),
    nextDownpayment: Math.round(nextDownpayment),
    nextLtvCap: L.cap,
    totalNeeded: Math.round(totalNeeded),
    surplus: Math.round(fundsForNext - totalNeeded),
  };
}

// ---- Reverse affordability — "what's the max price I can afford?" -----------
export interface MaxAffordInput {
  grossMonthlyIncome: number;
  monthlyDebt: number;
  borrowerAge: number;
  loanTenureYears: number;
  cashAvailable: number;
  cpfAvailable: number;
  profile: BuyerProfile;
  propertyCount: number;
  outstandingLoans: number;
  interestRate: number; // actual, for repayment estimate
}

export interface MaxAffordResult {
  maxPrice: number;
  binding: "Loan (TDSR)" | "Cash / CPF";
  ltvCap: number;
  maxLoanByTdsr: number;
  loanAtMax: number;
  downpaymentAtMax: number;
  bsdAtMax: number;
  absdAtMax: number;
  cashCpfUsed: number;
  fundsAvailable: number;
  estMonthlyRepayment: number;
}

export function maxAffordability(i: MaxAffordInput): MaxAffordResult {
  const cap = ltv(i.outstandingLoans, i.loanTenureYears, i.borrowerAge).cap;
  const tdsrLoan = maxLoanByTdsr(i.grossMonthlyIncome, i.monthlyDebt, i.loanTenureYears);
  const funds = i.cashAvailable + i.cpfAvailable;

  const cashNeeded = (price: number) => {
    const loan = Math.min(price * cap, tdsrLoan);
    return price - loan + buyerStampDuty(price) + absd(price, i.profile, i.propertyCount);
  };

  // Binary-search the largest price whose upfront cash+duties fit the funds.
  let lo = 0;
  let hi = 60_000_000;
  for (let iter = 0; iter < 60; iter++) {
    const mid = (lo + hi) / 2;
    if (cashNeeded(mid) <= funds) lo = mid;
    else hi = mid;
  }
  const maxPrice = Math.floor(lo / 1000) * 1000;
  const loanAtMax = Math.min(maxPrice * cap, tdsrLoan);
  const binding = maxPrice * cap >= tdsrLoan - 1 ? "Loan (TDSR)" : "Cash / CPF";
  const bsdAtMax = buyerStampDuty(maxPrice);
  const absdAtMax = absd(maxPrice, i.profile, i.propertyCount);
  return {
    maxPrice,
    binding,
    ltvCap: cap,
    maxLoanByTdsr: tdsrLoan,
    loanAtMax,
    downpaymentAtMax: maxPrice - loanAtMax,
    bsdAtMax,
    absdAtMax,
    cashCpfUsed: maxPrice - loanAtMax + bsdAtMax + absdAtMax,
    fundsAvailable: funds,
    estMonthlyRepayment: monthlyRepayment(loanAtMax, i.interestRate, i.loanTenureYears),
  };
}

export function cagr(startValue: number, endValue: number, years: number): number | null {
  if (startValue <= 0 || endValue <= 0 || years <= 0) return null;
  return (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
}

// ---- Seller's Stamp Duty ----------------------------------------------------
// Charged on the higher of price or market value. The applicable schedule
// depends on the PURCHASE date:
//   • Bought on/after 4 Jul 2025: 4-year holding, 16/12/8/4% (years 1-4).
//   • Bought 11 Mar 2017 – 3 Jul 2025: 3-year holding, 12/8/4% (years 1-3).
// yearsHeld is the completed holding period; the tier is floor(yearsHeld).
export function ssdRate(yearsHeld: number, boughtOnOrAfterJul2025: boolean): number {
  const tier = Math.floor(Math.max(0, yearsHeld));
  const schedule = boughtOnOrAfterJul2025 ? [0.16, 0.12, 0.08, 0.04] : [0.12, 0.08, 0.04];
  return tier < schedule.length ? schedule[tier] : 0;
}

export function sellerStampDuty(salePrice: number, yearsHeld: number, boughtOnOrAfterJul2025: boolean): number {
  return Math.round(salePrice * ssdRate(yearsHeld, boughtOnOrAfterJul2025));
}

// ---- Breakeven / hold-to-profit --------------------------------------------
// How much must the price rise to walk away whole if sold in year N?
// Entry costs (price + BSD + ABSD) are fixed; exit costs (agent fee + GST, and
// SSD if still within the holding period) scale with the sale price, so we solve
//   salePrice = entryCost / (1 - feeRate - ssdRate)
export interface BreakevenInput {
  price: number;
  profile: BuyerProfile;
  propertyCount: number;
  boughtOnOrAfterJul2025: boolean;
  agentFeePct: number;
  gstPct: number;
  maxYears?: number; // default 5
  // Optional holding costs, added per year of ownership:
  monthlyMaintenance?: number; // condo maintenance fee $/month
  annualPropertyTax?: number; // IRAS property tax $/year
  loanAmount?: number; // for the interest cost approximation
  loanInterestPct?: number; // e.g. 3.5 (% p.a.) — interest ≈ loan × rate (approximation)
}

export interface BreakevenRow {
  year: number;
  ssdRate: number;
  holdingCosts: number; // cumulative holding costs by that year
  breakevenPrice: number | null;
  breakevenGrowthPct: number | null; // total % rise needed
  breakevenCagrPct: number | null; // annualised
}

export function breakevenSchedule(i: BreakevenInput): {
  entryCost: number;
  bsd: number;
  absd: number;
  annualHolding: number;
  rows: BreakevenRow[];
} {
  const bsd = buyerStampDuty(i.price);
  const absdVal = absd(i.price, i.profile, i.propertyCount);
  const entryCost = i.price + bsd + absdVal;
  const feeRate = (i.agentFeePct / 100) * (1 + i.gstPct / 100);
  // Holding costs per year of ownership. Interest uses a flat loan × rate
  // approximation (real amortising interest falls slowly over time).
  const annualHolding =
    (i.monthlyMaintenance ?? 0) * 12 +
    (i.annualPropertyTax ?? 0) +
    (i.loanAmount ?? 0) * ((i.loanInterestPct ?? 0) / 100);
  const maxYears = i.maxYears ?? 5;
  const rows: BreakevenRow[] = [];
  for (let year = 1; year <= maxYears; year++) {
    const sr = ssdRate(year - 1, i.boughtOnOrAfterJul2025); // tier for a sale during year N
    const holdingCosts = Math.round(annualHolding * year);
    const denom = 1 - feeRate - sr;
    const bePrice = denom > 0 ? (entryCost + holdingCosts) / denom : null;
    const growth = bePrice ? (bePrice / i.price - 1) * 100 : null;
    const cagrPct = bePrice ? (Math.pow(bePrice / i.price, 1 / year) - 1) * 100 : null;
    rows.push({ year, ssdRate: sr, holdingCosts, breakevenPrice: bePrice ? Math.round(bePrice) : null, breakevenGrowthPct: growth, breakevenCagrPct: cagrPct });
  }
  return { entryCost, bsd, absd: absdVal, annualHolding: Math.round(annualHolding), rows };
}
