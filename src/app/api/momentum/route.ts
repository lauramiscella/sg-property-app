import { NextRequest, NextResponse } from "next/server";
import { getDataset } from "@/lib/store";
import { applyFilters, districtMomentum } from "@/lib/analysis";
import { parseFilter } from "@/lib/params";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const ds = await getDataset();
  const filtered = applyFilters(ds.txns, parseFilter(sp));
  const window = Math.max(1, Math.min(12, Number(sp.get("window") || 12)));
  return NextResponse.json({ window, rows: districtMomentum(filtered, ds.transactionMonths?.max, window) });
}
