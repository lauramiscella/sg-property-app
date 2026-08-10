import { NextRequest, NextResponse } from "next/server";
import { limited } from "@/lib/ratelimit";
import { getAccessDataset } from "@/lib/access";
import { applyFilters, newVsResale } from "@/lib/analysis";
import { parseFilter } from "@/lib/params";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const rl = limited(req, "data");
  if (rl) return rl;
  const sp = req.nextUrl.searchParams;
  const ds = await getAccessDataset();
  if (!ds.full) return NextResponse.json({ locked: true }, { status: 403 }); // full version only
  const filtered = applyFilters(ds.txns, parseFilter(sp));
  const groupBy = (sp.get("groupBy") || "year") as "quarter" | "year";
  return NextResponse.json({ count: filtered.length, ...newVsResale(filtered, groupBy) });
}
