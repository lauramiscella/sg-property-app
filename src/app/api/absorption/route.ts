import { NextRequest, NextResponse } from "next/server";
import { limited } from "@/lib/ratelimit";
import { getAccessDataset } from "@/lib/access";
import { applyFilters, absorption } from "@/lib/analysis";
import { parseFilter } from "@/lib/params";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const rl = limited(req, "data");
  if (rl) return rl;
  const sp = req.nextUrl.searchParams;
  const ds = await getAccessDataset();
  if (!ds.full) return NextResponse.json({ locked: true }, { status: 403 }); // full version only
  const filtered = applyFilters(ds.txns, parseFilter(sp));
  const listings = Math.min(1_000_000, Math.max(0, Number(sp.get("listings") || 0) || 0));
  const dedupePct = Math.min(95, Math.max(0, Number(sp.get("dedupe") || 20) || 0));
  const sqft = Math.min(100_000, Math.max(0, Number(sp.get("sqft") || 0) || 0)) || undefined;
  return NextResponse.json(
    absorption(filtered, { listings, dedupePct, sqft, months: 12, maxMonth: ds.transactionMonths?.max })
  );
}
