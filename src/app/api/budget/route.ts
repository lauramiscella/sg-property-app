import { NextRequest, NextResponse } from "next/server";
import { getAccessDataset } from "@/lib/access";
import { budgetExplorer, BudgetResult } from "@/lib/analysis";
export const dynamic = "force-dynamic";

// Trial teaser: keep the true deal totals, but show only the 2 busiest
// districts and lock project names. Enforced here, server-side.
const TRIAL_DISTRICT_ROWS = 2;
function trialBucket(b: BudgetResult) {
  return {
    total: b.total,
    rows: b.rows.slice(0, TRIAL_DISTRICT_ROWS).map((r) => ({
      ...r,
      topProjects: [],
      projectsLocked: true,
    })),
    lockedDistricts: Math.max(0, b.rows.length - TRIAL_DISTRICT_ROWS),
  };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const ds = await getAccessDataset();
  const min = Number(sp.get("min") || 0);
  const max = Number(sp.get("max") || 0);
  const types = sp.get("types")?.split("|").filter(Boolean);
  const windowMonths = ds.full ? 24 : 12; // trial slice only holds 12 months
  const opts = { months: windowMonths, maxMonth: ds.transactionMonths?.max ?? undefined, propertyTypes: types };
  // Split the market: RESALE (incl. sub-sales, i.e. secondary market) vs NEW SALES (developer).
  const resaleTxns = ds.txns.filter((t) => t.saleType === "Resale" || t.saleType === "Sub Sale");
  const newTxns = ds.txns.filter((t) => t.saleType === "New Sale");
  const resale = budgetExplorer(resaleTxns, min, max, opts);
  const newSale = budgetExplorer(newTxns, min, max, opts);
  return NextResponse.json({
    windowMonths,
    access: ds.full ? "full" : "trial",
    resale: ds.full ? resale : trialBucket(resale),
    newSale: ds.full ? newSale : trialBucket(newSale),
  });
}
