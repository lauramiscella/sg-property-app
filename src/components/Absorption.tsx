"use client";

import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from "recharts";
import { Meta, AbsorptionResult } from "@/lib/analysis";
import { districtLabel, fmtSGD, fmtNum } from "@/lib/format";
import { Card, Field, Select, TextInput, Kpi, Spinner, Empty } from "./ui";
import ProjectSearch from "./ProjectSearch";

type MatchBy = "project" | "district";

const VERDICT_COPY = {
  seller: { label: "Seller's market", color: "var(--color-emerald)", text: "supply clears fast here — sellers hold the cards" },
  balanced: { label: "Balanced market", color: "var(--color-gold)", text: "supply and demand are roughly matched" },
  buyer: { label: "Buyer's market", color: "var(--color-brick)", text: "plenty of supply for the pace of sales — buyers can bargain" },
} as const;

export default function Absorption({ meta }: { meta: Meta }) {
  const [matchBy, setMatchBy] = useState<MatchBy>("project");
  const [project, setProject] = useState("");
  const [district, setDistrict] = useState("");
  const [sqft, setSqft] = useState("");
  const [listings, setListings] = useState("");
  const [dedupe, setDedupe] = useState("20");
  const [pick, setPick] = useState<number | null>(null); // selected price point index
  const [data, setData] = useState<AbsorptionResult | null>(null);
  const [loading, setLoading] = useState(false);

  const ready = Number(listings) > 0 && (matchBy === "project" ? !!project : !!district);

  useEffect(() => {
    if (!ready) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const sp = new URLSearchParams({ listings, dedupe: dedupe || "20" });
    if (matchBy === "project") sp.set("project", project);
    else sp.set("district", district);
    if (Number(sqft) > 0) sp.set("sqft", sqft);
    const t = setTimeout(() => {
      fetch(`/api/absorption?${sp.toString()}`)
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled) {
            setData(d);
            setPick(null);
          }
        })
        .finally(() => !cancelled && setLoading(false));
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [ready, matchBy, project, district, sqft, listings, dedupe]);

  const points = useMemo(() => data?.points ?? [], [data]);
  const sel = pick != null ? points[pick] : null;
  const v = data?.verdict ? VERDICT_COPY[data.verdict] : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,300px)_1fr]">
      <Card className="print:hidden" title="Your inputs" subtitle="Count active listings on the portal yourself, enter the number — the rest is computed from URA sales.">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field label="Match against">
              <Select value={matchBy} onChange={(x) => setMatchBy(x as MatchBy)} placeholder=""
                options={[{ value: "project", label: "Same project (tightest)" }, { value: "district", label: "Same district (broader)" }]} />
            </Field>
          </div>
          <div className="col-span-2">
            {matchBy === "project" ? (
              <Field label="Project">
                <ProjectSearch projects={meta.projects.slice(0, 400)} value={project} onChange={setProject} placeholder="Type a project" />
              </Field>
            ) : (
              <Field label="District">
                <Select value={district} onChange={setDistrict} placeholder="Pick a district"
                  options={meta.districts.map((d) => ({ value: d, label: districtLabel(d) }))} />
              </Field>
            )}
          </div>
          <Field label="Unit size (sqft, optional)">
            <TextInput type="number" value={sqft} onChange={setSqft} placeholder="e.g. 900" />
          </Field>
          <Field label="Active listings">
            <TextInput type="number" value={listings} onChange={setListings} placeholder="from the portal" />
          </Field>
          <div className="col-span-2">
            <Field label="Duplicate haircut % (same unit listed by many agents)">
              <TextInput type="number" value={dedupe} onChange={setDedupe} placeholder="20" />
            </Field>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted">
          Supply is what you count on the portal today; {dedupe || 20}% is shaved off for duplicated listings of the
          same unit. Sales pace comes from URA caveats, last 12 months{sqft ? ", similar size (±15%)" : ""}.
        </p>
      </Card>

      <div className="space-y-5">
        <Card title="How fast is this market moving?" subtitle="Months of supply = listings after haircut ÷ monthly sales rate. Under 4 = seller's, 4–6 = balanced, over 6 = buyer's.">
          {!ready ? (
            <Empty>Pick a project or district and enter the number of active listings.</Empty>
          ) : loading && !data ? (
            <div className="py-16"><Spinner /></div>
          ) : !data || data.comps < 5 ? (
            <Empty>Fewer than 5 comparable sales in the last 12 months — not enough to estimate a sales pace. Try district level or drop the size filter.</Empty>
          ) : (
            <>
              {v && (
                <div
                  className="mb-4 rounded-xl border px-4 py-3 text-sm font-medium"
                  style={{
                    borderColor: `color-mix(in srgb, ${v.color} 35%, transparent)`,
                    background: `color-mix(in srgb, ${v.color} 8%, transparent)`,
                    color: v.color,
                  }}
                >
                  {v.label} — {v.text}. At the current pace, the standing supply takes about{" "}
                  <b>{fmtNum(data.domDays)} days</b> to clear.
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Kpi label="Sales pace" value={`${data.monthlyRate}/mo`} sub={`${fmtNum(data.comps)} deals in ${data.windowMonths} months`} accent="amber" />
                <Kpi label="Effective supply" value={fmtNum(data.effListings)} sub={`after ${dedupe || 20}% duplicate haircut`} accent="plum" />
                <Kpi label="Months of supply" value={data.monthsSupply != null ? String(data.monthsSupply) : "—"} accent="gold" />
                <Kpi label="Approx. days on market" value={data.domDays != null ? `~${fmtNum(data.domDays)}` : "—"} sub="if pace holds" accent="emerald" />
              </div>
            </>
          )}
        </Card>

        {data && data.comps >= 5 && points.length > 0 && (
          <Card
            title="What happens if you price higher or lower?"
            subtitle="Tap a price point: at that asking PSF, only the share of buyers who historically paid that much or more remain — the market slows for you accordingly."
          >
            <div className="mb-3 flex flex-wrap gap-1.5">
              {points.map((p, i) => (
                <button
                  key={p.psf}
                  onClick={() => setPick(i === pick ? null : i)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                    pick === i ? "border-amber bg-amber text-white" : "border-line bg-card-2 text-ink-soft hover:border-amber"
                  }`}
                >
                  {fmtSGD(p.psf)}
                </button>
              ))}
            </div>
            {sel && (
              <div className="mb-4 rounded-lg border border-line bg-card-2 px-4 py-3 text-sm text-ink-soft">
                Ask <b>{fmtSGD(sel.psf)} psf</b> and roughly <b>{sel.poolPct}%</b> of recent buyers paid that much or
                more — estimated <b>~{fmtNum(sel.domDays)} days</b> on market ({sel.monthsSupply} months of supply at
                that price level). Median here is {fmtSGD(data.medianPsf)} psf.
              </div>
            )}
            <div className="h-[260px] w-full">
              <ResponsiveContainer>
                <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                  <CartesianGrid stroke="#e8dfce" vertical={false} />
                  <XAxis dataKey="psf" tick={{ fontSize: 11, fill: "#8c8375" }} tickLine={false} axisLine={{ stroke: "#e8dfce" }} tickFormatter={(x) => `$${fmtNum(x)}`} />
                  <YAxis tick={{ fontSize: 11, fill: "#8c8375" }} tickLine={false} axisLine={false} width={48} tickFormatter={(x) => `${fmtNum(x)}d`} />
                  <Tooltip
                    formatter={(val, name) => (name === "domDays" ? [`~${fmtNum(Number(val))} days`, "Est. days on market"] : [String(val), String(name)])}
                    labelFormatter={(l) => `Asking ${fmtSGD(Number(l))} psf`}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e8dfce", background: "#fffdf8", fontSize: 12 }}
                  />
                  <Line dataKey="domDays" stroke="#b0743a" strokeWidth={2.4} dot={{ r: 3, fill: "#b0743a" }} />
                  {sel && <ReferenceDot x={sel.psf} y={sel.domDays ?? 0} r={6} fill="#8f4a5e" stroke="#fffdf8" strokeWidth={2} />}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-muted">
              This is a transparent model, not measured days-on-market: it assumes the recent URA sales pace holds and
              that your effective buyer pool at a given price equals the share of the last 12 months&apos; buyers who
              paid that PSF or more. Listing counts are your own portal snapshot and change daily. Use it to frame a
              pricing conversation, not as a guarantee.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
