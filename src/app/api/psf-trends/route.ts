import { NextRequest, NextResponse } from "next/server";
import { getDataset } from "@/lib/store";
import { applyFilters, psfTrends } from "@/lib/analysis";
import { parseFilter } from "@/lib/params";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const ds = await getDataset();
  const filtered = applyFilters(ds.txns, parseFilter(sp));
  const groupBy = (sp.get("groupBy") || "quarter") as "quarter" | "year" | "month";
  return NextResponse.json({
    groupBy,
    count: filtered.length,
    points: psfTrends(filtered, groupBy),
  });
}
