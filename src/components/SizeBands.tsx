"use client";

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TxnFilter } from "@/lib/types";
import { SizeBandRow } from "@/lib/analysis";
import { toQuery } from "@/lib/query";
import { useApi } from "@/lib/useApi";
import { fmtSGD, fmtNum, fmtPct } from "@/lib/format";
import { Card, Spinner, Empty, Segmented } from "./ui";

const COLORS = ["#9d3b63", "#c34a2f", "#d97a1f", "#d4a017", "#7a9a2e", "#2f8f5b"];

export default function SizeBands({ filters }: { filters: TxnFilter }) {
  const [window, setWindow] = useState<"all" | "12">("all");
  const url = `/api/size-bands${toQuery(filters, window === "12" ? { months: 12 } : {})}`;
  const { data, loading } = useApi<{ rows: SizeBandRow[] }>(url);
  const rows = data?.rows ?? [];
  const best = rows.reduce<SizeBandRow | null>((a, r) => ((r.cagrPct ?? -99) > (a?.cagrPct ?? -99) ? r : a), null);

  return (
    <Card
      title="Do bigger units perform better?"
      subtitle={window === "12" ? "Median PSF by unit size, last 12 months only." : "Median PSF and price growth by unit size band, across all available years."}
      right={
        <Segmented<"all" | "12">
          value={window}
          onChange={setWindow}
          options={[
            { value: "all", label: "All years" },
            { value: "12", label: "Last 12 months" },
          ]}
        />
      }
    >
      {loading ? (
        <div className="py-16"><Spinner /></div>
      ) : rows.length === 0 ? (
        <Empty>No transactions match these filters.</Empty>
      ) : (
        <>
          {best?.cagrPct != null && (
            <div className="mb-4 rounded-lg border border-emerald/30 bg-emerald/5 px-3 py-2 text-xs text-[#3f7d57]">
              In this slice, <b>{best.band}</b> units appreciated fastest — {fmtPct(best.cagrPct)} per year
              ({best.firstYear}–{best.lastYear}). Size isn&apos;t destiny though: it varies by district and project.
            </div>
          )}
          <div className="h-[260px] w-full">
            <ResponsiveContainer>
              <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid stroke="#e8dfce" vertical={false} />
                <XAxis dataKey="band" tick={{ fontSize: 10, fill: "#8c8375" }} tickLine={false} axisLine={{ stroke: "#e8dfce" }} interval={0} />
                <YAxis tick={{ fontSize: 11, fill: "#8c8375" }} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => `$${fmtNum(v)}`} />
                <Tooltip
                  formatter={(v) => [fmtSGD(Number(v)), "Median PSF"]}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e8dfce", background: "#fffdf8", fontSize: 12 }}
                  cursor={{ fill: "#f5efe3" }}
                />
                <Bar dataKey="medianPsf" radius={[4, 4, 0, 0]} maxBarSize={54}>
                  {rows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-line bg-card-2 text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-3 py-2.5 font-medium">Size band</th>
                  <th className="px-3 py-2.5 text-right font-medium">Caveats</th>
                  <th className="px-3 py-2.5 text-right font-medium">Median price</th>
                  <th className="px-3 py-2.5 text-right font-medium">Median PSF</th>
                  <th className="px-3 py-2.5 text-right font-medium">Growth</th>
                  <th className="px-3 py-2.5 text-right font-medium">CAGR</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.band} className="border-b border-line/60 last:border-0 hover:bg-card-2">
                    <td className="px-3 py-2.5 font-medium text-ink">
                      <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: COLORS[i % COLORS.length] }} />
                      {r.band}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted">{fmtNum(r.volume)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">{fmtSGD(r.medianPrice)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">{fmtSGD(r.medianPsf)}</td>
                    <td className={`px-3 py-2.5 text-right tabular-nums font-medium ${(r.growthPct ?? 0) >= 0 ? "text-emerald" : "text-brick"}`}>
                      {r.growthPct != null ? `${fmtPct(r.growthPct)} (${r.firstYear}–${r.lastYear})` : "—"}
                    </td>
                    <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${(r.cagrPct ?? 0) >= 0 ? "text-emerald" : "text-brick"}`}>{fmtPct(r.cagrPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">
            Smaller units usually carry higher PSF (the &ldquo;quantum effect&rdquo;) — that&apos;s normal and
            doesn&apos;t mean they&apos;re overpriced. The growth columns answer the real question: which size held
            or grew value fastest. {window === "12" ? "Growth needs at least two years of data, so it shows — in the 12-month view; switch to All years for growth." : "Bands need ≥5 caveats per year to count."}
          </p>
        </>
      )}
    </Card>
  );
}
