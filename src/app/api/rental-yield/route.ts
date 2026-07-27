import { NextRequest, NextResponse } from "next/server";
import { getDataset } from "@/lib/store";
import { rentalYield } from "@/lib/analysis";
import { parseFilter } from "@/lib/params";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const ds = await getDataset();
  const level = (sp.get("level") || "district") as "district" | "project";
  return NextResponse.json({
    level,
    rentalQuarters: ds.rentalQuarters,
    rows: rentalYield(ds, parseFilter(sp), level),
  });
}
