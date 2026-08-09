import { NextRequest, NextResponse } from "next/server";
import { getAccessDataset } from "@/lib/access";
import { appreciation } from "@/lib/analysis";
import { parseFilter } from "@/lib/params";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const ds = await getAccessDataset();
  if (!ds.full) return NextResponse.json({ locked: true }, { status: 403 }); // full version only
  return NextResponse.json({ rows: appreciation(ds, parseFilter(sp)) });
}
