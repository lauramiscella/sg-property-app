import { NextRequest, NextResponse } from "next/server";
import { getAccessDataset } from "@/lib/access";
import { applyFilters, comparables } from "@/lib/analysis";
import { parseFilter } from "@/lib/params";
import { Txn } from "@/lib/types";

export const dynamic = "force-dynamic";

// Trial cap: at most this many rows are ever served (browsing or CSV export).
const TRIAL_ROW_CAP = 400;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const ds = await getAccessDataset();
  const filtered = applyFilters(ds.txns, parseFilter(sp));
  const sort = (sp.get("sort") || "date") as keyof Txn;
  const dir = (sp.get("dir") || "desc") as "asc" | "desc";
  const page = Math.max(1, Number(sp.get("page") || 1));
  const pageSize = Math.min(200, Math.max(1, Number(sp.get("pageSize") || 50)));
  const result = comparables(filtered, sort, dir, page, pageSize);
  if (!ds.full) {
    const offset = (page - 1) * pageSize;
    if (offset >= TRIAL_ROW_CAP) result.rows = [];
    else if (offset + result.rows.length > TRIAL_ROW_CAP)
      result.rows = result.rows.slice(0, TRIAL_ROW_CAP - offset);
  }
  return NextResponse.json(result);
}
