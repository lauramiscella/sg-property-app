import { NextRequest, NextResponse } from "next/server";
import { getDataset } from "@/lib/store";
import { budgetExplorer } from "@/lib/analysis";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const ds = await getDataset();
  const min = Number(sp.get("min") || 0);
  const max = Number(sp.get("max") || 0);
  const types = sp.get("types")?.split("|").filter(Boolean);
  const opts = { months: 24, maxMonth: ds.transactionMonths?.max, propertyTypes: types };
  // Split the market: RESALE (incl. sub-sales, i.e. secondary market) vs NEW SALES (developer).
  const resaleTxns = ds.txns.filter((t) => t.saleType === "Resale" || t.saleType === "Sub Sale");
  const newTxns = ds.txns.filter((t) => t.saleType === "New Sale");
  return NextResponse.json({
    windowMonths: 24,
    resale: budgetExplorer(resaleTxns, min, max, opts),
    newSale: budgetExplorer(newTxns, min, max, opts),
  });
}
