"use client";

import { useState } from "react";
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TxnFilter } from "@/lib/types";
import { PremiumResult, PremiumPoint } from "@/lib/analysis";
import { toQuery } from "@/lib/query";
import { useApi } from "@/lib/useApi";
import { fmtSGD, fmtNum, fmtPct } from "@/lib/format";
import { Card, Kpi, Segmented, Spinner, Empty } from "./ui";

type GroupBy = "year" | "quarter";

export default function Premium({ filters }: { filters: TxnFilter }) {
  const [groupBy, setGroupBy] = useState<GroupBy>("year");
  const url = `/api/premium${toQuery(filters, { groupBy })}`;
  const { data, loading } = useApi<PremiumResult & { count: number }>(url);

  const points = data?.points ?? [];
  const cur = data?.currentPremiumPct ?? null;
  const avg = data?.avgPremiumPct ?? null;
  const gap = cur != null && avg != null ? cur - avg : null;

  return (
    <div className="space-y-5">
      <Card
        title="New-launch vs resale premium"
        subtitle="Median PSF of New Sale vs Resale in the same bucket. Set filters (district, size, tenure, type) so you're comparing like with like."
        right={
          <Segmented<GroupBy>
            value={groupBy}
            onChange={setGroupBy}
            options={[
              { value: "year", label: "Yearly" },
              { value: "quarter", label: "Quarterly" },
            ]}
          />
        }
      >
        {loading ? (
          <div className="py-16"><Spinner /></div>
        ) : points.filter((p) => p.premiumPct != null).length === 0 ? (
          <Empty>Not enough New Sale and Resale caveats in the same periods to compare. Widen the filters.</Empty>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Kpi label="Current premium" value={fmtPct(cur)} tone={cur != null && cur > 0 ? "down" : "up"} accent="plum" sub="new over resale, now" />
              <Kpi label="Historical average" value={fmtPct(avg)} accent="amber" sub="across the window" />
              <Kpi label="Latest new PSF" value={fmtSGD(data?.latestNewPsf ?? null)} accent="brick" />
              <Kpi label="Latest resale PSF" value={fmtSGD(data?.latestResalePsf ?? null)} accent="emerald" />
            </div>

            {gap != null && (
              <div
                className={`mb-4 rounded-lg border px-3 py-2 text-xs ${
                  gap > 2
                    ? "border-brick/30 bg-brick/5 text-brick"
                    : gap < -2
                    ? "border-emerald/30 bg-emerald/5 text-[#3f7d57]"
                    : "border-line bg-card-2 text-ink-soft"
                }`}
              >
                {gap > 2 ? (
                  <>The current premium is <b>{fmtPct(gap, 1)} above</b> its historical average here — new launches look richly priced versus resale relative to the past. The premium pays off only if this project&apos;s exit PSF beats comparable resale by more than you paid in.</>
                ) : gap < -2 ? (
                  <>The current premium is <b>{fmtPct(Math.abs(gap), 1)} below</b> its historical average — new launches are relatively well-priced versus resale here.</>
                ) : (
                  <>The current premium is roughly in line with its historical average here.</>
                )}
              </div>
            )}

            <div className="h-[330px] w-full">
              <ResponsiveContainer>
                <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid stroke="#e8dfce" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#8c8375" }} tickLine={false} axisLine={{ stroke: "#e8dfce" }} minTickGap={16} />
                  <YAxis yAxisId="psf" tick={{ fontSize: 11, fill: "#8c8375" }} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => `$${fmtNum(v)}`} domain={["auto", "auto"]} />
                  <YAxis yAxisId="prem" orientation="right" tick={{ fontSize: 11, fill: "#b0743a" }} tickLine={false} axisLine={false} width={42} tickFormatter={(v) => `${v}%`} />
                  <Tooltip content={<PremTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="prem" dataKey="premiumPct" name="Premium %" fill="#e3cf9f" radius={[2, 2, 0, 0]} maxBarSize={26} />
                  <Line yAxisId="psf" dataKey="newPsf" name="New Sale PSF" stroke="#a8442f" strokeWidth={2.4} dot={false} connectNulls />
                  <Line yAxisId="psf" dataKey="resalePsf" name="Resale PSF" stroke="#3f7d57" strokeWidth={2.4} dot={false} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <p className="mt-3 text-xs text-muted">
              The premium alone isn&apos;t the whole decision: a new launch also carries a ~3–5 year construction wait
              and progressive-payment cash-flow, a full fresh lease, and no rental income while building — while resale
              is move-in and income-ready. Use this to judge whether today&apos;s premium is high or low versus history,
              not as a guarantee of future gain. New Sale here includes sub-sales lodged as new; comparison is only as
              matched as your filters.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}

type TT = { active?: boolean; payload?: { payload: PremiumPoint }[]; label?: string };
function PremTooltip({ active, payload, label }: TT) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold text-ink">{label}</div>
      <div className="mt-1 space-y-0.5 text-ink-soft">
        <div>New Sale: <b>{fmtSGD(p.newPsf)}</b> ({fmtNum(p.newVol)})</div>
        <div>Resale: <b>{fmtSGD(p.resalePsf)}</b> ({fmtNum(p.resaleVol)})</div>
        <div>Premium: <b>{fmtPct(p.premiumPct)}</b></div>
      </div>
    </div>
  );
}
