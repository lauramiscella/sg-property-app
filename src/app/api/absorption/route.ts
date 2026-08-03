import { NextRequest, NextResponse } from "next/server";
import { getAccessDataset } from "@/lib/access";
import { applyFilters, absorption } from "@/lib/analysis";
import { parseFilter } from "@/lib/params";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const ds = await getAccessDataset();
  const filtered = applyFilters(ds.txns, parseFilter(sp));
  const listings = Number(sp.get("listings") || 0);
  const dedupePct = Number(sp.get("dedupe") || 20);
  const sqft = Number(sp.get("sqft") || 0) || undefined;
  return NextResponse.json(
    absorption(filtered, { listings, dedupePct, sqft, months: 12, maxMonth: ds.transactionMonths?.max })
  );
}
