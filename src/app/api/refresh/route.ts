import { NextResponse } from "next/server";
import { refreshDataset } from "@/lib/store";
import { buildMeta } from "@/lib/analysis";
import { hasFullAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function POST() {
  // Trial visitors can't trigger URA pulls.
  if (!(await hasFullAccess()))
    return NextResponse.json({ locked: true }, { status: 403 });
  const ds = await refreshDataset();
  return NextResponse.json({ ...buildMeta(ds), access: "full" });
}
