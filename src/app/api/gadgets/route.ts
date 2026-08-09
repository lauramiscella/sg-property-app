import { NextResponse } from "next/server";
import { getAccessDataset } from "@/lib/access";
import { psfTrends, districtMomentum, tenurePremium, newVsResale } from "@/lib/analysis";

export const dynamic = "force-dynamic";

// One small payload powering the home-screen gadget tiles. Access-aware:
// trial visitors get the free gadgets computed on their 12-month slice, and
// null (→ locked tile) for the full-version ones.
export async function GET() {
  const ds = await getAccessDataset();
  const maxMonth = ds.transactionMonths?.max;

  // Market pulse — whole private market, quarterly medians
  const trend = psfTrends(ds.txns, "quarter");
  const spark = trend.slice(-8).map((p) => ({ period: p.period, psf: p.medianPsf }));
  const latest = trend[trend.length - 1] ?? null;
  const yoyBase = trend[trend.length - 5] ?? null; // 4 quarters earlier
  const yoyPct =
    latest?.medianPsf && yoyBase?.medianPsf
      ? Math.round(((latest.medianPsf - yoyBase.medianPsf) / yoyBase.medianPsf) * 1000) / 10
      : null;
  const dealsLatestMonth = maxMonth ? ds.txns.filter((t) => t.month === maxMonth).length : 0;

  // Full-version gadgets
  let hotDistrict: { district: string; pct: number } | null = null;
  let fhPremiumPct: number | null = null;
  let launchPremiumPct: number | null = null;
  if (ds.full) {
    const mom = districtMomentum(ds.txns, maxMonth, 12)
      .filter((r) => r.momentumPct != null)
      .sort((a, b) => (b.momentumPct ?? 0) - (a.momentumPct ?? 0));
    if (mom[0]) hotDistrict = { district: mom[0].district, pct: mom[0].momentumPct! };
    fhPremiumPct = tenurePremium(ds.txns, "quarter").currentPremiumPct;
    launchPremiumPct = newVsResale(ds.txns, "quarter").currentPremiumPct;
  }

  return NextResponse.json({
    access: ds.full ? "full" : "trial",
    latestQuarter: latest?.period ?? null,
    medianPsf: latest?.medianPsf ?? null,
    yoyPct,
    spark,
    dealsLatestMonth,
    latestMonth: maxMonth ?? null,
    txnCount: ds.txns.length,
    hotDistrict,
    fhPremiumPct,
    launchPremiumPct,
  });
}
