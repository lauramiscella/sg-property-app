"use client";

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { TxnFilter } from "@/lib/types";
import { MomentumRow } from "@/lib/analysis";
import { toQuery } from "@/lib/query";
import { useApi } from "@/lib/useApi";
import { fmtSGD, fmtNum, fmtPct, districtLabel, dShort } from "@/lib/format";
import { Card, Spinner, Empty, Kpi, Segmented } from "./ui";

export default function Momentum({ filters }: { filters: TxnFilter }) {
  const [window, setWindow] = useState<"12" | "6" | "1">("12");
  const url = `/api/momentum${toQuery(filters, { window })}`;
  const { data, loading } = useApi<{ rows: MomentumRow[] }>(url);
  const wLabel = window === "12" ? "12 months" : window === "6" ? "6 months" : "month";
  const rows = data?.rows ?? [];
  const chartData = rows.map((r) => ({ name: dShort(r.district), mom: r.momentumPct ?? 0 }));
  const hottest = rows[0];
  const coolest = rows[rows.length - 1];

  return (
    <Card
      title="District momentum — price movement, not volume"
      subtitle={`How each district's PRICE (median $PSF) moved: last ${wLabel} vs the ${wLabel} before. The volume column is context only.`}
      right={
        <Segmented<"12" | "6" | "1">
          value={window}
          onChange={setWindow}
          options={[
            { value: "12", label: "12 months" },
            { value: "6", label: "6 months" },
            { value: "1", label: "Last month" },
          ]}
        />
      }
    >
      {loading ? (
        <div className="py-16"><Spinner /></div>
      ) : rows.length === 0 ? (
        <Empty>Not enough recent volume per district for a momentum read. Widen the filters.</Empty>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Kpi label="Heating fastest" value={fmtPct(hottest?.momentumPct ?? null)} tone="up" accent="emerald" sub={hottest ? districtLabel(hottest.district) : ""} />
            <Kpi label="Coolest" value={fmtPct(coolest?.momentumPct ?? null)} tone={(coolest?.momentumPct ?? 0) < 0 ? "down" : "default"} accent="brick" sub={coolest ? districtLabel(coolest.district) : ""} />
            <Kpi label="Districts measured" value={fmtNum(rows.length)} accent="gold" sub="enough deals in both windows" />
          </div>
          <div className="w-full" style={{ height: Math.max(220, rows.length * 26) }}>
            <ResponsiveContainer>
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 28, top: 4, bottom: 4 }}>
                <CartesianGrid stroke="#e8dfce" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#8c8375" }} tickLine={false} axisLine={{ stroke: "#e8dfce" }} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#4e463b" }} tickLine={false} axisLine={false} width={44} />
                <ReferenceLine x={0} stroke="#d8ccb7" />
                <Tooltip
                  formatter={(v) => [`${Number(v).toFixed(1)}%`, "12-month momentum"]}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e8dfce", background: "#fffdf8", fontSize: 12 }}
                  cursor={{ fill: "#f5efe3" }}
                />
                <Bar dataKey="mom" radius={[0, 4, 4, 0]} maxBarSize={16}>
                  {chartData.map((d, i) => <Cell key={i} fill={d.mom >= 0 ? "#3f7d57" : "#a8442f"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 overflow-x-auto rounded-xl border border-line">
            <table className="w-full sm:min-w-[540px] text-sm">
              <thead>
                <tr className="border-b border-line bg-card-2 text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-3 py-2.5 font-medium">District</th>
                  <th className="px-3 py-2.5 text-right font-medium">PSF now (12mo)</th>
                  <th className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">PSF prior (12mo)</th>
                  <th className="px-3 py-2.5 text-right font-medium">Momentum</th>
                  <th className="px-3 py-2.5 text-right font-medium">Volume now/prior</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.district} className="border-b border-line/60 last:border-0 hover:bg-card-2">
                    <td className="px-3 py-2.5 font-medium text-ink">{districtLabel(r.district)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">{fmtSGD(r.psfNow)}</td>
                    <td className="hidden px-3 py-2.5 text-right tabular-nums text-ink-soft sm:table-cell">{fmtSGD(r.psfPrior)}</td>
                    <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${(r.momentumPct ?? 0) >= 0 ? "text-emerald" : "text-brick"}`}>{fmtPct(r.momentumPct)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted">{fmtNum(r.volNow)}/{fmtNum(r.volPrior)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">
            Momentum here means <b>price movement</b> (median $PSF), not how many units sold. Shorter windows react
            faster but are noisier — one big launch can move a district&apos;s median, so cross-check a hot district
            in Market Trends before reading it as a trend.
          </p>
        </>
      )}
    </Card>
  );
}
