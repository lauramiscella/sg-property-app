"use client";

import { useEffect, useMemo, useState } from "react";
import { Meta, BudgetRow } from "@/lib/analysis";
import { districtLabel, fmtSGD, fmtNum } from "@/lib/format";
import { Card, Field, TextInput, Kpi, Spinner, Empty } from "./ui";

const RANGE_CHIPS: { label: string; min: number; max: number }[] = [
  { label: "$1M–$1.5M", min: 1_000_000, max: 1_500_000 },
  { label: "$1.5M–$2M", min: 1_500_000, max: 2_000_000 },
  { label: "$2M–$2.5M", min: 2_000_000, max: 2_500_000 },
  { label: "$2.5M–$3M", min: 2_500_000, max: 3_000_000 },
  { label: "$3M–$4M", min: 3_000_000, max: 4_000_000 },
];

// Group URA's raw property types into buyer-friendly categories. "Apartment"
// is folded into Condo (they overlap in everyday use).
function buildTypeGroups(propertyTypes: string[]) {
  const condo = propertyTypes.filter((t) => /apartment|condominium/i.test(t) && !/executive/i.test(t));
  const ec = propertyTypes.filter((t) => /executive/i.test(t));
  const landed = propertyTypes.filter((t) => !condo.includes(t) && !ec.includes(t));
  return [
    { id: "condo", label: "Condo / Apartment", types: condo },
    { id: "landed", label: "Landed", types: landed },
    { id: "ec", label: "Executive Condo", types: ec },
  ].filter((g) => g.types.length > 0);
}

export default function Budget({ meta }: { meta: Meta }) {
  const [minS, setMinS] = useState("1500000");
  const [maxS, setMaxS] = useState("2000000");
  const groups = useMemo(() => buildTypeGroups(meta.propertyTypes), [meta.propertyTypes]);
  const [checked, setChecked] = useState<string[]>([]); // group ids; empty = all
  const [data, setData] = useState<{ rows: BudgetRow[]; total: number; windowMonths: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const min = Number(minS) || 0;
  const max = Number(maxS) || 0;
  const valid = min > 0 && max > min;

  const toggle = (id: string) =>
    setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const typesParam = useMemo(() => {
    if (!checked.length || checked.length === groups.length) return ""; // all
    return groups
      .filter((g) => checked.includes(g.id))
      .flatMap((g) => g.types)
      .join("|");
  }, [checked, groups]);

  useEffect(() => {
    if (!valid) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const sp = new URLSearchParams({ min: String(min), max: String(max) });
    if (typesParam) sp.set("types", typesParam);
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
  }, [valid, min, max, typesParam]);

  const rows = data?.rows ?? [];
  const biggest = rows[0];

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,300px)_1fr]">
      <Card title="Your budget range" subtitle="Only deals inside this exact range are counted.">
        <div className="grid grid-cols-2 gap-3">
          <Field label="From (SGD)">
            <TextInput type="number" value={minS} onChange={setMinS} placeholder="e.g. 1500000" />
          </Field>
          <Field label="To (SGD)">
            <TextInput type="number" value={maxS} onChange={setMaxS} placeholder="e.g. 2000000" />
          </Field>
        </div>
        {!valid && (minS || maxS) && (
          <p className="mt-2 text-xs text-clay">&ldquo;To&rdquo; must be higher than &ldquo;From&rdquo;.</p>
        )}
        <div className="mt-3">
          <Field label="Property type (tick any — none ticked = all)">
            <div className="flex flex-col gap-1.5 rounded-lg border border-line bg-card-2 px-3 py-2.5">
              {groups.map((g) => (
                <label key={g.id} className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
                  <input
                    type="checkbox"
                    checked={checked.includes(g.id)}
                    onChange={() => toggle(g.id)}
                    className="h-4 w-4 rounded border-line accent-[#b0743a]"
                  />
                  {g.label}
                </label>
              ))}
            </div>
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {RANGE_CHIPS.map((c) => {
            const active = min === c.min && max === c.max;
            return (
              <button
                key={c.label}
                onClick={() => {
                  setMinS(String(c.min));
                  setMaxS(String(c.max));
                }}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${active ? "border-amber bg-amber text-white" : "border-line bg-card-2 text-ink-soft hover:border-amber"}`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </Card>

      <Card
        title={valid ? `What ${fmtSGD(min)}–${fmtSGD(max)} bought` : "What your budget buys"}
        subtitle={`Only transactions priced INSIDE this range, last ${data?.windowMonths ?? 24} months, by district.`}
      >
        {!valid ? (
          <Empty>Enter a budget range (from and to) to see real deals inside it.</Empty>
        ) : loading && !data ? (
          <div className="py-16"><Spinner /></div>
        ) : rows.length === 0 ? (
          <Empty>No transactions inside this range for the ticked property types in the last 24 months. Widen the range.</Empty>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Kpi label="Districts in range" value={fmtNum(rows.length)} accent="emerald" sub={`${fmtNum(data!.total)} transactions`} />
              <Kpi label="Most space" value={biggest?.medianSqft ? `${fmtNum(biggest.medianSqft)} sqft` : "—"} accent="amber" sub={biggest ? districtLabel(biggest.district) : ""} />
              <Kpi label="Median PSF there" value={fmtSGD(biggest?.medianPsf ?? null)} accent="plum" sub="at that district" />
            </div>
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-line bg-card-2 text-left text-[11px] uppercase tracking-wide text-muted">
                    <th className="px-3 py-2.5 font-medium">District</th>
                    <th className="px-3 py-2.5 text-right font-medium">Deals in range</th>
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
                        {r.topProjects.map((p) => `${p.name} (${p.count})`).join(" · ")}
                        {r.totalProjects > r.topProjects.length && (
                          <span className="text-amber"> +{r.totalProjects - r.topProjects.length} more projects</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted">
              Every figure comes only from caveats priced between {fmtSGD(min)} and {fmtSGD(max)} — nothing outside
              the range is counted. &ldquo;Where it happened&rdquo; lists the 5 most active projects; the +N covers the
              rest. Real lodged deals, not listings.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
