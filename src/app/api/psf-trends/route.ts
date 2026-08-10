import { NextRequest, NextResponse } from "next/server";
import { limited } from "@/lib/ratelimit";
import { getAccessDataset } from "@/lib/access";
import { applyFilters, psfTrends } from "@/lib/analysis";
import { parseFilter } from "@/lib/params";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const rl = limited(req, "data");
  if (rl) return rl;
  const sp = req.nextUrl.searchParams;
  const ds = await getAccessDataset();
  const filtered = applyFilters(ds.txns, parseFilter(sp));
  const groupBy = (sp.get("groupBy") || "quarter") as "quarter" | "year" | "month";
  return NextResponse.json({
    groupBy,
    count: filtered.length,
    points: psfTrends(filtered, groupBy),
  });
}
