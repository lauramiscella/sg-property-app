"use client";

import { useEffect, useMemo, useState } from "react";
import { Meta, ValuationResult } from "@/lib/analysis";
import { districtLabel, dShort, fmtSGD, fmtNum } from "@/lib/format";
import { Card, Field, Select, TextInput, Kpi, Spinner, Empty, Ring } from "./ui";

type MatchBy = "project" | "district";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

export default function ValueCheck({ meta }: { meta: Meta }) {
  const [matchBy, setMatchBy] = useState<MatchBy>("project");
  const [project, setProject] = useState("");
  const [district, setDistrict] = useState("");
  const [sqft, setSqft] = useState("");
  const [price, setPrice] = useState("");
  const [data, setData] = useState<ValuationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const ready = Number(sqft) > 0 && Number(price) > 0 && (matchBy === "project" ? !!project : !!district);

  useEffect(() => {
    if (!ready) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const sp = new URLSearchParams({ sqft, price, months: "24" });
    if (matchBy === "project") sp.set("project", project);
    else sp.set("district", district);
    fetch(`/api/overpay?${sp.toString()}`)
      .then((r) => r.json())
      .then((d) => !cancelled && setData(d))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [ready, matchBy, project, district, sqft, price]);

  const verdictCopy = useMemo(() => {
    if (!data?.verdict) return null;
    const map: Record<string, { text: string; tone: string }> = {
      "well below": { text: "priced well below the market for comparable units — a strong deal on the data", tone: "emerald" },
      below: { text: "priced below the market for comparable units", tone: "emerald" },
      around: { text: "priced around the market for comparable units — fair", tone: "amber" },
      above: { text: "priced above the market for comparable units", tone: "brick" },
      "well above": { text: "priced well above the market for comparable units — worth pushing back on", tone: "brick" },
    };
    return map[data.verdict];
  }, [data]);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,330px)_1fr]">
      <Card title="Check a unit" subtitle="Enter a size and an asking price to see where it sits vs recent comparables.">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field label="Match against">
              <Select value={matchBy} onChange={(v) => setMatchBy(v as MatchBy)} placeholder=""
                options={[{ value: "project", label: "Same project (tightest)" }, { value: "district", label: "Same district (broader)" }]} />
            </Field>
          </div>
          {matchBy === "project" ? (
            <div className="col-span-2">
              <Field label="Project">
                <>
                  <input
                    list="vc-projects"
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                    placeholder="Type a project"
                    className="h-9 w-full rounded-lg border border-line bg-card px-2.5 text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20"
                  />
                  <datalist id="vc-projects">
                    {meta.projects.slice(0, 400).map((p) => (
                      <option key={p.name} value={p.name}>{`${dShort(p.district)} · ${p.count} caveats`}</option>
                    ))}
                  </datalist>
                </>
              </Field>
            </div>
          ) : (
            <div className="col-span-2">
              <Field label="District">
                <Select value={district} onChange={setDistrict} placeholder="Pick a district"
                  options={meta.districts.map((d) => ({ value: d, label: districtLabel(d) }))} />
              </Field>
            </div>
          )}
          <Field label="Unit size (sqft)">
            <TextInput type="number" value={sqft} onChange={setSqft} placeholder="e.g. 900" />
          </Field>
          <Field label="Asking price">
            <TextInput type="number" value={price} onChange={setPrice} placeholder="e.g. 2100000" />
          </Field>
        </div>
        {Number(sqft) > 0 && Number(price) > 0 && (
          <div className="mt-3 rounded-lg border border-line bg-card-2 px-3 py-2 text-xs text-ink-soft">
            That&apos;s <b>{fmtSGD(Number(price) / Number(sqft))}</b> psf.
          </div>
        )}
      </Card>

      <div className="space-y-5">
        <Card title="Where it sits" subtitle="Against comparable caveats: similar size (±15%), last 24 months.">
          {!ready ? (
            <Empty>Pick a project or district, then enter a size and price.</Empty>
          ) : loading && !data ? (
            <div className="py-16"><Spinner /></div>
          ) : !data || data.count === 0 ? (
            <Empty>No comparable caveats found for that size in this selection. Try &ldquo;same district&rdquo; or a nearby size.</Empty>
          ) : (
            <>
              {verdictCopy && (
                <div
                  className="mb-4 flex items-center gap-4 rounded-2xl border px-4 py-3 text-sm"
                  style={{
                    borderColor: `color-mix(in srgb, var(--color-${verdictCopy.tone}) 35%, transparent)`,
                    background: `color-mix(in srgb, var(--color-${verdictCopy.tone}) 7%, transparent)`,
                    color: `var(--color-${verdictCopy.tone})`,
                  }}
                >
                  <Ring
                    pct={data.percentile ?? 0}
                    color={`var(--color-${verdictCopy.tone})`}
                    label={ordinal(data.percentile ?? 0)}
                  />
                  <span>
                    At <b>{fmtSGD(data.enteredPsf)}</b> psf, this unit is in the{" "}
                    <b>{ordinal(data.percentile ?? 0)} percentile</b> of comparable sales — {verdictCopy.text}.
                  </span>
                </div>
              )}

              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Kpi label="Your PSF" value={fmtSGD(data.enteredPsf)} accent="plum" />
                <Kpi label="Market median" value={fmtSGD(data.median)} accent="amber" />
                <Kpi label="Percentile" value={ordinal(data.percentile ?? 0)} accent={(data.percentile ?? 0) > 60 ? "brick" : "emerald"} sub="of comparables" />
                <Kpi label="Comparables" value={fmtNum(data.count)} accent="gold" sub={`${fmtNum(data.sizeLow)}–${fmtNum(data.sizeHigh)} sqft`} />
              </div>

              <PositionBar data={data} />

              <p className="mt-4 text-xs text-muted">
                Percentile = the share of comparable caveats priced below yours. This is a market-position read from
                recent transactions, not a formal valuation — it doesn&apos;t adjust for floor, facing, condition or
                renovation. Tighten it with &ldquo;same project&rdquo; where there&apos;s enough data.
              </p>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function PositionBar({ data }: { data: ValuationResult }) {
  const min = data.min ?? 0;
  const max = data.max ?? 1;
  const span = Math.max(1, max - min);
  const pos = (v: number | null) => (v == null ? 0 : ((v - min) / span) * 100);
  const you = pos(data.enteredPsf);
  return (
    <div className="px-1">
      <div className="relative h-10">
        {/* p25–p75 range band */}
        <div
          className="absolute top-4 h-2 rounded-full"
          style={{ left: `${pos(data.p25)}%`, width: `${pos(data.p75) - pos(data.p25)}%`, background: "color-mix(in srgb, var(--color-amber) 30%, transparent)" }}
        />
        <div className="absolute top-4 h-2 w-full rounded-full border border-line" />
        {/* median marker */}
        <div className="absolute top-2.5 h-5 w-[2px] bg-amber" style={{ left: `${pos(data.median)}%` }} />
        {/* your marker */}
        <div
          className="absolute top-1 flex -translate-x-1/2 flex-col items-center"
          style={{ left: `${Math.max(2, Math.min(98, you))}%` }}
        >
          <span className="h-7 w-[3px] rounded" style={{ background: "var(--color-plum)" }} />
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted">
        <span>{fmtSGD(data.min)}</span>
        <span>median {fmtSGD(data.median)}</span>
        <span>{fmtSGD(data.max)}</span>
      </div>
    </div>
  );
}
