import { NextRequest, NextResponse } from "next/server";
import { limited } from "@/lib/ratelimit";
import { getAccessDataset, TRIAL_MONTHS } from "@/lib/access";
import { buildMeta } from "@/lib/analysis";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const rl = limited(req, "data");
  if (rl) return rl;
  const ds = await getAccessDataset();
  return NextResponse.json({
    ...buildMeta(ds),
    access: ds.full ? "full" : "trial",
    trialFrom: ds.trialFrom,
    trialMonths: TRIAL_MONTHS,
  });
}
