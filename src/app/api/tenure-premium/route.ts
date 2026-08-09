import { NextRequest, NextResponse } from "next/server";
import { getAccessDataset } from "@/lib/access";
import { applyFilters, tenurePremium } from "@/lib/analysis";
import { parseFilter } from "@/lib/params";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const ds = await getAccessDataset();
  if (!ds.full) return NextResponse.json({ locked: true }, { status: 403 }); // full version only
  const filtered = applyFilters(ds.txns, parseFilter(sp));
  const groupBy = (sp.get("groupBy") || "year") as "quarter" | "year";
  return NextResponse.json({ count: filtered.length, ...tenurePremium(filtered, groupBy) });
}
