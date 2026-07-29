"use client";

import { Fragment, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TxnFilter } from "@/lib/types";
import { AppreciationRow } from "@/lib/analysis";
import { toQuery } from "@/lib/query";
import { useApi } from "@/lib/useApi";
import { fmtSGD, fmtPct, fmtNum, districtLabel } from "@/lib/format";
import { Card, Spinner, Empty } from "./ui";

export default function Appreciation({ filters }: { filters: TxnFilter }) {
  const url = `/api/appreciation${toQuery(filters)}`;
  const { data, loading } = useApi<{ rows: AppreciationRow[] }>(url);
  const [open, setOpen] = useState<string | null>(null);

  const rows = data?.rows ?? [];

  return (
    <Card
      title="Project appreciation"
      subtitle="Median PSF in the first vs latest year with data, per project. Ranked by compound annual growth."
    >
      {loading ? (
        <div className="py-16">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <Empty>
          Not enough depth to measure appreciation for this selection — a project needs at least two
          years with multiple caveats. Widen the filters.
        </Empty>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full sm:min-w-[660px] text-sm">
              <thead>
                <tr className="border-b border-line bg-card-2 text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-3 py-2.5 font-medium">Project</th>
                  <th className="hidden px-3 py-2.5 font-medium sm:table-cell">Window</th>
                  <th className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">Entry PSF</th>
                  <th className="px-3 py-2.5 text-right font-medium">Latest PSF</th>
                  <th className="px-3 py-2.5 text-right font-medium">Total growth</th>
                  <th className="px-3 py-2.5 text-right font-medium">CAGR</th>
                  <th className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">Caveats</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isOpen = open === r.project;
                  return (
                    <Fragment key={r.project}>
                      <tr
                        onClick={() => setOpen(isOpen ? null : r.project)}
                        className="cursor-pointer border-b border-line/60 last:border-0 hover:bg-card-2"
                      >
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-ink">
                            <span className="mr-1 text-muted">{isOpen ? "▾" : "▸"}</span>
                            {r.project}
                          </div>
                          <div className="pl-4 text-xs text-muted">
                            {districtLabel(r.district)} · {r.tenureType}
                          </div>
                        </td>
                        <td className="hidden whitespace-nowrap px-3 py-2.5 text-ink-soft sm:table-cell">
                          {r.firstYear}–{r.lastYear}
                        </td>
                        <td className="hidden px-3 py-2.5 text-right tabular-nums text-ink-soft sm:table-cell">
                          {fmtSGD(r.firstPsf)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">
                          {fmtSGD(r.lastPsf)}
                        </td>
                        <td
                          className={`px-3 py-2.5 text-right tabular-nums font-medium ${
                            (r.totalGrowthPct ?? 0) >= 0 ? "text-emerald" : "text-brick"
                          }`}
                        >
                          {fmtPct(r.totalGrowthPct)}
                        </td>
                        <td
                          className={`px-3 py-2.5 text-right tabular-nums font-semibold ${
                            (r.cagrPct ?? 0) >= 0 ? "text-emerald" : "text-brick"
                          }`}
                        >
                          {fmtPct(r.cagrPct)}
                        </td>
                        <td className="hidden px-3 py-2.5 text-right tabular-nums text-muted sm:table-cell">
                          {fmtNum(r.totalVolume)}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-line/60 bg-card-2">
                          <td colSpan={7} className="px-4 py-4">
                            <div className="h-[200px] w-full max-w-2xl">
                              <ResponsiveContainer>
                                <LineChart data={r.yearly} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                                  <CartesianGrid stroke="#e6ddce" vertical={false} />
                                  <XAxis
                                    dataKey="year"
                                    tick={{ fontSize: 11, fill: "#8c8375" }}
                                    tickLine={false}
                                    axisLine={{ stroke: "#e6ddce" }}
                                  />
                                  <YAxis
                                    tick={{ fontSize: 11, fill: "#8c8375" }}
                                    tickLine={false}
                                    axisLine={false}
                                    width={52}
                                    tickFormatter={(v) => `$${fmtNum(v)}`}
                                    domain={["auto", "auto"]}
                                  />
                                  <Tooltip
                                    formatter={(v) => [fmtSGD(Number(v)), "Median PSF"]}
                                    contentStyle={{
                                      borderRadius: 8,
                                      border: "1px solid #e6ddce",
                                      background: "#fffdf8",
                                      fontSize: 12,
                                    }}
                                  />
                                  <Line
                                    dataKey="medianPsf"
                                    stroke="#b0743a"
                                    strokeWidth={2.4}
                                    dot={{ r: 3, fill: "#b0743a" }}
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">
            This measures project-level PSF appreciation, not a specific unit&apos;s gain. URA caveats
            carry no unit identifier, so genuine buy-then-sell pairs can&apos;t be reconstructed from
            this data. Entry PSF is the median in the first year shown, which may be years after launch.
          </p>
        </>
      )}
    </Card>
  );
}
