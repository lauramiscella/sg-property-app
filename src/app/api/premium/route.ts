import { NextRequest, NextResponse } from "next/server";
import { getDataset } from "@/lib/store";
import { applyFilters, newVsResale } from "@/lib/analysis";
import { parseFilter } from "@/lib/params";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const ds = await getDataset();
  const filtered = applyFilters(ds.txns, parseFilter(sp));
  const groupBy = (sp.get("groupBy") || "year") as "quarter" | "year";
  return NextResponse.json({ count: filtered.length, ...newVsResale(filtered, groupBy) });
}
