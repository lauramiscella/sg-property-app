import { NextRequest, NextResponse } from "next/server";
import { refreshDataset } from "@/lib/store";
import { buildMeta } from "@/lib/analysis";
import { hasFullAccess } from "@/lib/access";
import { limited } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Forces a URA pull — expensive, so tightly limited (3/hour per IP) and
// blocked for trial visitors.
export async function POST(req: NextRequest) {
  const rl = limited(req, "refresh");
  if (rl) return rl;
  if (!(await hasFullAccess()))
    return NextResponse.json({ locked: true }, { status: 403 });
  const ds = await refreshDataset();
  return NextResponse.json({ ...buildMeta(ds), access: "full" });
}
