import { NextRequest, NextResponse } from "next/server";
import { limited } from "@/lib/ratelimit";
import { getAccessDataset } from "@/lib/access";
import { rentalYield } from "@/lib/analysis";
import { parseFilter } from "@/lib/params";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const rl = limited(req, "data");
  if (rl) return rl;
  const sp = req.nextUrl.searchParams;
  const ds = await getAccessDataset();
  if (!ds.full) return NextResponse.json({ locked: true }, { status: 403 }); // full version only
  const level = (sp.get("level") || "district") as "district" | "project";
  return NextResponse.json({
    level,
    rentalQuarters: ds.rentalQuarters,
    rows: rentalYield(ds, parseFilter(sp), level),
  });
}
