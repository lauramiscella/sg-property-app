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
  return NextResponse.json(
    budgetExplorer(ds.txns, min, max, { months: 24, maxMonth: ds.transactionMonths?.max, propertyTypes: types })
  );
}
