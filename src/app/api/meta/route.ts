import { NextResponse } from "next/server";
import { getAccessDataset, TRIAL_MONTHS } from "@/lib/access";
import { buildMeta } from "@/lib/analysis";

export const dynamic = "force-dynamic";

export async function GET() {
  const ds = await getAccessDataset();
  return NextResponse.json({
    ...buildMeta(ds),
    access: ds.full ? "full" : "trial",
    trialFrom: ds.trialFrom,
    trialMonths: TRIAL_MONTHS,
  });
}
