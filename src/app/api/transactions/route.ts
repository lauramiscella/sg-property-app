import { NextRequest, NextResponse } from "next/server";
import { getDataset } from "@/lib/store";
import { applyFilters, comparables } from "@/lib/analysis";
import { parseFilter } from "@/lib/params";
import { Txn } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const ds = await getDataset();
  const filtered = applyFilters(ds.txns, parseFilter(sp));
  const sort = (sp.get("sort") || "date") as keyof Txn;
  const dir = (sp.get("dir") || "desc") as "asc" | "desc";
  const page = Math.max(1, Number(sp.get("page") || 1));
  const pageSize = Math.min(200, Math.max(1, Number(sp.get("pageSize") || 50)));
  return NextResponse.json(comparables(filtered, sort, dir, page, pageSize));
}
