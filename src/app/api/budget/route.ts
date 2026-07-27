import { NextRequest, NextResponse } from "next/server";
import { getDataset } from "@/lib/store";
import { budgetExplorer } from "@/lib/analysis";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const ds = await getDataset();
  const budget = Number(sp.get("budget") || 0);
  const propertyType = sp.get("propertyType") || undefined;
  return NextResponse.json(
    budgetExplorer(ds.txns, budget, { months: 24, maxMonth: ds.transactionMonths?.max, propertyType })
  );
}
