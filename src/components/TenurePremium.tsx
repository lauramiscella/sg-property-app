"use client";

import { useState } from "react";
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TxnFilter } from "@/lib/types";
import { TenurePoint } from "@/lib/analysis";
import { toQuery } from "@/lib/query";
import { useApi } from "@/lib/useApi";
import { fmtSGD, fmtNum, fmtPct } from "@/lib/format";
import { Card, Kpi, Segmented, Spinner, Empty } from "./ui";

type GroupBy = "year" | "quarter";
interface Result {
  points: TenurePoint[];
  currentPremiumPct: number | null;
  avgPremiumPct: number | null;
  latestFhPsf: number | null;
  latestLhPsf: number | null;
}

export default function TenurePremium({ filters }: { filters: TxnFilter }) {
  const [groupBy, setGroupBy] = useState<GroupBy>("year");
  const url = `/api/tenure-premium${toQuery(filters, { groupBy })}`;
  const { data, loading } = useApi<Result>(url);
  const points = data?.points ?? [];
  const cur = data?.currentPremiumPct ?? null;
  const avg = data?.avgPremiumPct ?? null;
  const gap = cur != null && avg != null ? cur - avg : null;

  return (
    <Card
      title="Freehold vs leasehold premium"
      subtitle="Median PSF of freehold vs leasehold sales in the same bucket. Filter to a district or size band to compare like with like."
      right={
        <Segmented<GroupBy>
          value={groupBy}
          onChange={setGroupBy}
          options={[{ value: "year", label: "Yearly" }, { value: "quarter", label: "Quarterly" }]}
        />
      }
    >
      {loading ? (
        <div className="py-16"><Spinner /></div>
      ) : points.filter((p) => p.premiumPct != null).length === 0 ? (
        <Empty>Not enough freehold and leasehold sales in the same periods here. Widen the filters.</Empty>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Current FH premium" value={fmtPct(cur)} accent="plum" sub="freehold over leasehold" />
            <Kpi label="Historical average" value={fmtPct(avg)} accent="amber" sub="across the window" />
            <Kpi label="Latest freehold PSF" value={fmtSGD(data?.latestFhPsf ?? null)} accent="brick" />
            <Kpi label="Latest leasehold PSF" value={fmtSGD(data?.latestLhPsf ?? null)} accent="emerald" />
          </div>
          {gap != null && (
            <div className={`mb-4 rounded-lg border px-3 py-2 text-xs ${gap > 2 ? "border-emerald/30 bg-emerald/5 text-[#3f7d57]" : gap < -2 ? "border-brick/30 bg-brick/5 text-brick" : "border-line bg-card-2 text-ink-soft"}`}>
              {gap > 2
                ? <>Freehold&apos;s premium here is <b>{fmtPct(gap, 1)} above</b> its own history — you&apos;re paying more than usual for the freehold label right now.</>
                : gap < -2
                ? <>Freehold&apos;s premium is <b>{fmtPct(Math.abs(gap), 1)} below</b> its own history — freehold is relatively well-priced versus leasehold here.</>
                : <>The freehold premium is roughly in line with its history here.</>}
            </div>
          )}
          <div className="h-[320px] w-full">
            <ResponsiveContainer>
              <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid stroke="#e8dfce" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#8c8375" }} tickLine={false} axisLine={{ stroke: "#e8dfce" }} minTickGap={16} />
                <YAxis yAxisId="psf" tick={{ fontSize: 11, fill: "#8c8375" }} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => `$${fmtNum(v)}`} domain={["auto", "auto"]} />
                <YAxis yAxisId="prem" orientation="right" tick={{ fontSize: 11, fill: "#b0743a" }} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  formatter={(v, name) =>
                    name === "FH premium %" ? [`${v}%`, name] : [fmtSGD(Number(v)), name]
                  }
                  contentStyle={{ borderRadius: 8, border: "1px solid #e8dfce", background: "#fffdf8", fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="prem" dataKey="premiumPct" name="FH premium %" fill="#e3cf9f" radius={[2, 2, 0, 0]} maxBarSize={26} />
                <Line yAxisId="psf" dataKey="fhPsf" name="Freehold PSF" stroke="#8f4a5e" strokeWidth={2.4} dot={false} connectNulls />
                <Line yAxisId="psf" dataKey="lhPsf" name="Leasehold PSF" stroke="#3f7d57" strokeWidth={2.4} dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-xs text-muted">
            The premium is what buyers pay for tenure security; whether it&apos;s &ldquo;worth it&rdquo; depends on
            holding horizon — leasehold decay accelerates in the back half of a lease, while freehold holds value
            longer. Mix effects matter: freehold stock skews older and more central, so filter before quoting.
          </p>
        </>
      )}
    </Card>
  );
}
