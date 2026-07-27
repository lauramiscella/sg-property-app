import { NextResponse } from "next/server";
import { refreshDataset } from "@/lib/store";
import { buildMeta } from "@/lib/analysis";

export const dynamic = "force-dynamic";

export async function POST() {
  const ds = await refreshDataset();
  return NextResponse.json(buildMeta(ds));
}
