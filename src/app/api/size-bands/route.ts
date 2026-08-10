import { NextRequest, NextResponse } from "next/server";
import { limited } from "@/lib/ratelimit";
import { getAccessDataset } from "@/lib/access";
import { applyFilters, sizeBandStats } from "@/lib/analysis";
import { parseFilter } from "@/lib/params";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const rl = limited(req, "data");
  if (rl) return rl;
  const sp = req.nextUrl.searchParams;
  const ds = await getAccessDataset();
  if (!ds.full) return NextResponse.json({ locked: true }, { status: 403 }); // full version only
  const filter = parseFilter(sp);
  // Optional recent window (e.g. last 12 months) computed from the dataset's latest month.
  const months = Math.min(120, Math.max(0, Number(sp.get("months") || 0) || 0));
  if (months > 0 && ds.transactionMonths?.max) {
    const [y, m] = ds.transactionMonths.max.split("-").map(Number);
    const t = y * 12 + (m - 1) - (months - 1);
    filter.from = `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
  }
  const filtered = applyFilters(ds.txns, filter);
  return NextResponse.json({ rows: sizeBandStats(filtered) });
}
