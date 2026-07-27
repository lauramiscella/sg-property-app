import { NextResponse } from "next/server";
import { getDataset } from "@/lib/store";
import { buildMeta } from "@/lib/analysis";

export const dynamic = "force-dynamic";

export async function GET() {
  const ds = await getDataset();
  return NextResponse.json(buildMeta(ds));
}
