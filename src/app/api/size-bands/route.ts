import { NextRequest, NextResponse } from "next/server";
import { getDataset } from "@/lib/store";
import { applyFilters, sizeBandStats } from "@/lib/analysis";
import { parseFilter } from "@/lib/params";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const ds = await getDataset();
  const filtered = applyFilters(ds.txns, parseFilter(req.nextUrl.searchParams));
  return NextResponse.json({ rows: sizeBandStats(filtered) });
}
