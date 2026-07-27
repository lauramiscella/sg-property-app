"use client";

import { useMemo, useState } from "react";
import {
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TxnFilter } from "@/lib/types";
import { TrendPoint } from "@/lib/analysis";
import { toQuery } from "@/lib/query";
import { useApi } from "@/lib/useApi";
import { fmtNum, fmtSGD, fmtPct } from "@/lib/format";
import { Card, Kpi, Segmented, Spinner, Empty } from "./ui";

type GroupBy = "quarter" | "year" | "month";

export default function PsfTrends({ filters }: { filters: TxnFilter }) {
  const [groupBy, setGroupBy] = useState<GroupBy>("quarter");
  const url = `/api/psf-trends${toQuery(filters, { groupBy })}`;
  const { data, loading } = useApi<{ points: TrendPoint[]; count: number }>(url);

  const points = data?.points ?? [];

  const kpis = useMemo(() => {
    if (points.length < 1) return null;
    const withPsf = points.filter((p) => p.medianPsf != null);
    if (!withPsf.length) return null;
    const latest = withPsf[withPsf.length - 1];
    const first = withPsf[0];
    // Prefer a same-period-last-year comparison when grouping by quarter/month.
    const periodsPerYear = groupBy === "quarter" ? 4 : groupBy === "month" ? 12 : 1;
    const prior = withPsf[withPsf.length - 1 - periodsPerYear];
    const yoy =
      prior && prior.medianPsf && latest.medianPsf
        ? ((latest.medianPsf - prior.medianPsf) / prior.medianPsf) * 100
        : null;
    const totalGrowth =
      first.medianPsf && latest.medianPsf
        ? ((latest.medianPsf - first.medianPsf) / first.medianPsf) * 100
        : null;
    const volume = points.reduce((a, p) => a + p.volume, 0);
    return { latest, yoy, totalGrowth, volume };
  }, [points, groupBy]);

  return (
    <div className="space-y-5">
      <Card
        title="Median price psf over time"
        subtitle={`${fmtNum(data?.count ?? 0)} caveats in view · shaded band = 25th–75th percentile`}
        right={
          <Segmented<GroupBy>
            value={groupBy}
            onChange={setGroupBy}
            options={[
              { value: "quarter", label: "Quarterly" },
              { value: "year", label: "Yearly" },
              { value: "month", label: "Monthly" },
            ]}
          />
        }
      >
        {loading ? (
          <div className="py-16">
            <Spinner />
          </div>
        ) : points.length === 0 ? (
          <Empty>No transactions match these filters.</Empty>
        ) : (
          <>
            {kpis && (
              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Kpi
                  label="Latest median PSF"
                  value={fmtSGD(kpis.latest.medianPsf)}
                  sub={kpis.latest.period}
                  accent="amber"
                />
                <Kpi
                  label="Year-on-year"
                  value={kpis.yoy != null ? fmtPct(kpis.yoy) : "—"}
                  tone={kpis.yoy != null ? (kpis.yoy >= 0 ? "up" : "down") : "default"}
                  sub="vs same period last year"
                  accent={kpis.yoy != null && kpis.yoy < 0 ? "brick" : "emerald"}
                />
                <Kpi
                  label="Growth over window"
                  value={kpis.totalGrowth != null ? fmtPct(kpis.totalGrowth) : "—"}
                  tone={kpis.totalGrowth != null ? (kpis.totalGrowth >= 0 ? "up" : "down") : "default"}
                  sub={`${points[0].period} → ${points[points.length - 1].period}`}
                  accent="plum"
                />
                <Kpi label="Total volume" value={fmtNum(kpis.volume)} sub="caveats" accent="gold" />
              </div>
            )}

            <div className="h-[340px] w-full">
              <ResponsiveContainer>
                <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                  <defs>
                    <linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#c99a63" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#c99a63" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#e6ddce" vertical={false} />
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 11, fill: "#8c8375" }}
                    tickLine={false}
                    axisLine={{ stroke: "#e6ddce" }}
                    minTickGap={20}
                  />
                  <YAxis
                    yAxisId="psf"
                    tick={{ fontSize: 11, fill: "#8c8375" }}
                    tickLine={false}
                    axisLine={false}
                    width={52}
                    tickFormatter={(v) => `$${fmtNum(v)}`}
                    domain={["auto", "auto"]}
                  />
                  <YAxis
                    yAxisId="vol"
                    orientation="right"
                    tick={{ fontSize: 11, fill: "#c0b6a4" }}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                  />
                  <Tooltip content={<TrendTooltip />} />
                  <Bar
                    yAxisId="vol"
                    dataKey="volume"
                    fill="#e3d4bd"
                    radius={[2, 2, 0, 0]}
                    maxBarSize={26}
                    name="Volume"
                  />
                  <Area
                    yAxisId="psf"
                    dataKey="p75Psf"
                    stroke="none"
                    fill="url(#bandFill)"
                    name="p75"
                    isAnimationActive={false}
                  />
                  <Area
                    yAxisId="psf"
                    dataKey="p25Psf"
                    stroke="none"
                    fill="#f6f1e8"
                    name="p25"
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="psf"
                    dataKey="medianPsf"
                    stroke="#b0743a"
                    strokeWidth={2.4}
                    dot={false}
                    name="Median PSF"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

type TT = { active?: boolean; payload?: { payload: TrendPoint }[]; label?: string };
function TrendTooltip({ active, payload, label }: TT) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold text-ink">{label}</div>
      <div className="mt-1 space-y-0.5 text-ink-soft">
        <div>
          Median PSF: <b>{fmtSGD(p.medianPsf)}</b>
        </div>
        <div>
          Range: {fmtSGD(p.p25Psf)} – {fmtSGD(p.p75Psf)}
        </div>
        <div>Median price: {fmtSGD(p.medianPrice)}</div>
        <div>Volume: {fmtNum(p.volume)}</div>
      </div>
    </div>
  );
}
