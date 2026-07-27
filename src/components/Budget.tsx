"use client";

import { useEffect, useState } from "react";
import { Meta, BudgetRow } from "@/lib/analysis";
import { districtLabel, dShort, fmtSGD, fmtNum } from "@/lib/format";
import { Card, Field, Select, TextInput, Kpi, Spinner, Empty } from "./ui";

export default function Budget({ meta }: { meta: Meta }) {
  const [budget, setBudget] = useState("1500000");
  const [ptype, setPtype] = useState("");
  const [data, setData] = useState<{ rows: BudgetRow[]; total: number; windowMonths: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const b = Number(budget) || 0;

  useEffect(() => {
    if (b <= 0) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const sp = new URLSearchParams({ budget: String(b) });
    if (ptype) sp.set("propertyType", ptype);
    const t = setTimeout(() => {
      fetch(`/api/budget?${sp.toString()}`)
        .then((r) => r.json())
        .then((d) => !cancelled && setData(d))
        .finally(() => !cancelled && setLoading(false));
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [b, ptype]);

  const rows = data?.rows ?? [];
  const biggest = rows[0];

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,300px)_1fr]">
      <Card title="Your budget" subtitle="What did this money actually buy recently?">
        <Field label="Budget (SGD)">
          <TextInput type="number" value={budget} onChange={setBudget} placeholder="e.g. 1500000" />
        </Field>
        <div className="mt-3">
          <Field label="Property type">
            <Select value={ptype} onChange={setPtype} options={meta.propertyTypes.map((t) => ({ value: t, label: t }))} placeholder="All types" />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {["1000000", "1500000", "2000000", "2500000", "3000000"].map((v) => (
            <button
              key={v}
              onClick={() => setBudget(v)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${budget === v ? "border-amber bg-amber text-white" : "border-line bg-card-2 text-ink-soft hover:border-amber"}`}
            >
              ${Number(v) / 1_000_000}M
            </button>
          ))}
        </div>
      </Card>

      <Card
        title={b > 0 ? `What ${fmtSGD(b)} buys` : "What your budget buys"}
        subtitle={`Actual transactions at or under budget, last ${data?.windowMonths ?? 24} months, by district. Sorted by space.`}
      >
        {b <= 0 ? (
          <Empty>Enter a budget to see where it goes furthest.</Empty>
        ) : loading && !data ? (
          <div className="py-16"><Spinner /></div>
        ) : rows.length === 0 ? (
          <Empty>No recent transactions at or under this budget{ptype ? ` for ${ptype}s` : ""}. Try a higher figure.</Empty>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Kpi label="Districts in reach" value={fmtNum(rows.length)} accent="emerald" sub={`${fmtNum(data!.total)} transactions`} />
              <Kpi label="Most space" value={biggest?.medianSqft ? `${fmtNum(biggest.medianSqft)} sqft` : "—"} accent="amber" sub={biggest ? districtLabel(biggest.district) : ""} />
              <Kpi label="Median PSF there" value={fmtSGD(biggest?.medianPsf ?? null)} accent="plum" sub="at that district" />
            </div>
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-line bg-card-2 text-left text-[11px] uppercase tracking-wide text-muted">
                    <th className="px-3 py-2.5 font-medium">District</th>
                    <th className="px-3 py-2.5 text-right font-medium">Deals ≤ budget</th>
                    <th className="px-3 py-2.5 text-right font-medium">Median size</th>
                    <th className="px-3 py-2.5 text-right font-medium">Median price</th>
                    <th className="px-3 py-2.5 font-medium">Where it happened</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.district} className="border-b border-line/60 last:border-0 hover:bg-card-2">
                      <td className="px-3 py-2.5 font-medium text-ink">{districtLabel(r.district)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted">{fmtNum(r.count)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-emerald">{r.medianSqft ? `${fmtNum(r.medianSqft)} sqft` : "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">{fmtSGD(r.medianPrice)}</td>
                      <td className="px-3 py-2.5 text-xs text-muted">
                        {r.topProjects.map((p) => p.name).join(" · ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted">
              Based on lodged caveats at or under your budget — real deals, not listings. {dShort(rows[rows.length - 1]?.district ?? "")}–{dShort(rows[0]?.district ?? "")} medians describe what transacted, so a district
              with few deals under budget may still have options coming up.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
