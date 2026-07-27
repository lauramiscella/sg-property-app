"use client";

import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TxnFilter } from "@/lib/types";
import { YieldRow, Meta } from "@/lib/analysis";
import { toQuery } from "@/lib/query";
import { useApi } from "@/lib/useApi";
import { fmtSGD, fmtPct, fmtNum, districtLabel, dShort } from "@/lib/format";
import { Card, Segmented, Spinner, Empty, Kpi } from "./ui";

type Level = "district" | "project";

export default function RentalYield({ filters, meta }: { filters: TxnFilter; meta: Meta }) {
  const [level, setLevel] = useState<Level>("district");
  const url = `/api/rental-yield${toQuery(filters, { level })}`;
  const { data, loading } = useApi<{ rows: YieldRow[]; rentalQuarters: string[] }>(url);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const chartData = rows.slice(0, 12).map((r) => ({
    name:
      level === "project"
        ? `${r.project} · ${r.bedBand}`
        : `${dShort(r.district)} · ${r.bedBand}`,
    yield: r.grossYieldPct ?? 0,
  }));

  const best = rows[0];
  const median =
    rows.length > 0
      ? [...rows].map((r) => r.grossYieldPct ?? 0).sort((a, b) => a - b)[Math.floor(rows.length / 2)]
      : null;

  return (
    <div className="space-y-5">
      <Card
        title="Gross rental yield"
        subtitle={`Estimate: annualised median rent ÷ median price for the same district & unit band${
          data?.rentalQuarters?.length ? ` · rents ${data.rentalQuarters[data.rentalQuarters.length - 1]}–${data.rentalQuarters[0]}` : ""
        }`}
        right={
          <Segmented<Level>
            value={level}
            onChange={setLevel}
            options={[
              { value: "district", label: "By district" },
              { value: "project", label: "By project" },
            ]}
          />
        }
      >
        {loading ? (
          <div className="py-16">
            <Spinner />
          </div>
        ) : meta.rentalCount === 0 ? (
          <Empty>
            No rental caveats loaded. Rental data pulls from URA once an access key is configured.
          </Empty>
        ) : rows.length === 0 ? (
          <Empty>
            Not enough overlapping rent and sale data to compute yield for this selection. Try a
            broader filter or the district level.
          </Empty>
        ) : (
          <>
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Kpi
                label="Highest yield here"
                value={fmtPct(best.grossYieldPct)}
                tone="up"
                accent="emerald"
                sub={
                  level === "project"
                    ? `${best.project} · ${best.bedBand}`
                    : `${districtLabel(best.district)} · ${best.bedBand}`
                }
              />
              <Kpi label="Median of segments" value={fmtPct(median)} sub={`${rows.length} segments`} accent="amber" />
              <Kpi
                label="Method"
                value="Gross"
                sub="before maintenance, tax, vacancy"
                accent="plum"
              />
            </div>

            <div className="h-[300px] w-full">
              <ResponsiveContainer>
                <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                  <CartesianGrid stroke="#e6ddce" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "#8c8375" }}
                    tickLine={false}
                    axisLine={{ stroke: "#e6ddce" }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "#514a40" }}
                    tickLine={false}
                    axisLine={false}
                    width={level === "project" ? 190 : 150}
                  />
                  <Tooltip
                    cursor={{ fill: "#f6f1e8" }}
                    formatter={(v) => [`${Number(v).toFixed(2)}%`, "Gross yield"]}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #e6ddce",
                      background: "#fffdf8",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="yield" radius={[0, 6, 6, 0]} maxBarSize={22}>
                    {chartData.map((_, i) => {
                      const ramp = ["#9d3b63", "#c34a2f", "#d97a1f", "#d4a017", "#7a9a2e", "#2f8f5b", "#2e8f7a"];
                      return <Cell key={i} fill={ramp[i % ramp.length]} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </Card>

      {rows.length > 0 && (
        <Card title="Yield table" subtitle="Sorted by gross yield. Segments need ≥2 rent and ≥2 sale caveats.">
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line bg-card-2 text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-3 py-2.5 font-medium">Segment</th>
                  <th className="px-3 py-2.5 font-medium">Unit band</th>
                  <th className="px-3 py-2.5 text-right font-medium">Median rent /mo</th>
                  <th className="px-3 py-2.5 text-right font-medium">Median price</th>
                  <th className="px-3 py-2.5 text-right font-medium">Gross yield</th>
                  <th className="px-3 py-2.5 text-right font-medium">Samples (R/S)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-b border-line/60 last:border-0 hover:bg-card-2">
                    <td className="px-3 py-2.5 font-medium text-ink">
                      {level === "project" ? r.project : districtLabel(r.district)}
                    </td>
                    <td className="px-3 py-2.5 text-ink-soft">{r.bedBand}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">
                      {fmtSGD(r.medianMonthlyRent)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">
                      {fmtSGD(r.medianPrice)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-amber">
                      {fmtPct(r.grossYieldPct)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted">
                      {fmtNum(r.rentSamples)}/{fmtNum(r.saleSamples)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">
            Gross yield only — it does not net off maintenance fees, property tax, vacancy, or agent
            costs. Rent and sale caveats are matched at the district/unit-band level, not per unit, so
            treat this as a market signal rather than a specific unit&apos;s return.
          </p>
        </Card>
      )}
    </div>
  );
}
