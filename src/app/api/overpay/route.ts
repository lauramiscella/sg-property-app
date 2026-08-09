import { NextRequest, NextResponse } from "next/server";
import { getAccessDataset } from "@/lib/access";
import { applyFilters, valuationCheck } from "@/lib/analysis";
import { parseFilter } from "@/lib/params";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const ds = await getAccessDataset();
  if (!ds.full) return NextResponse.json({ locked: true }, { status: 403 }); // full version only
  const filtered = applyFilters(ds.txns, parseFilter(sp));
  const sqft = Number(sp.get("sqft") || 0);
  const price = Number(sp.get("price") || 0);
  const months = Number(sp.get("months") || 24);
  return NextResponse.json(
    valuationCheck(filtered, {
      sqft,
      price,
      months,
      maxMonth: ds.transactionMonths?.max,
    })
  );
}
