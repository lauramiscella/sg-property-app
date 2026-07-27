"use client";

import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Meta, TrendPoint } from "@/lib/analysis";
import { districtLabel, dShort, fmtSGD, fmtPct, fmtNum } from "@/lib/format";
import { Card, Segmented, Select, Spinner, Empty } from "./ui";

type Mode = "project" | "district";
type Metric = "index" | "psf";

const SERIES_COLORS = ["#b0743a", "#8f4a5e", "#3f7d57", "#cf9a3a", "#7c8a44", "#a8442f"];
const MAX = 6;

interface Series {
  key: string;
  label: string;
  points: TrendPoint[];
}

export default function Compare({ meta }: { meta: Meta }) {
  const [mode, setMode] = useState<Mode>("project");
  const [metric, setMetric] = useState<Metric>("index");
  const [selected, setSelected] = useState<string[]>([]);
  const [series, setSeries] = useState<Record<string, Series>>({});
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState("");

  // Seed with a few sensible defaults on first load.
  useEffect(() => {
    if (mode === "project" && meta.projects.length) {
      setSelected(meta.projects.slice(0, 3).map((p) => p.name));
    } else if (mode === "district") {
      setSelected(meta.districts.slice(0, 3));
    }
    setSeries({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Fetch any selected series we don't have yet.
  useEffect(() => {
    const missing = selected.filter((s) => !series[s]);
    if (!missing.length) return;
    let cancelled = false;
    setLoading(true);
    Promise.all(
      missing.map((s) => {
        const qs = new URLSearchParams({ groupBy: "year", [mode]: s }).toString();
        return fetch(`/api/psf-trends?${qs}`)
          .then((r) => r.json())
          .then((j) => ({
            key: s,
            label: mode === "district" ? districtLabel(s) : s,
            points: (j.points as TrendPoint[]) || [],
          }));
      })
    ).then((results) => {
      if (cancelled) return;
      setSeries((prev) => {
        const next = { ...prev };
        for (const r of results) next[r.key] = r;
        return next;
      });
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [selected, mode, series]);

  const active = selected.map((s) => series[s]).filter(Boolean) as Series[];

  // Build chart rows keyed by year across all series.
  const chartData = useMemo(() => {
    const years = new Set<string>();
    active.forEach((s) => s.points.forEach((p) => years.add(p.period)));
    const sorted = Array.from(years).sort();
    return sorted.map((year) => {
      const row: Record<string, number | string | null> = { year };
      active.forEach((s) => {
        const pt = s.points.find((p) => p.period === year);
        if (!pt || pt.medianPsf == null) {
          row[s.key] = null;
          return;
        }
        if (metric === "psf") {
          row[s.key] = pt.medianPsf;
        } else {
          const base = s.points.find((p) => p.medianPsf != null)?.medianPsf;
          row[s.key] = base ? Math.round((pt.medianPsf / base) * 1000) / 10 : null;
        }
      });
      return row;
    });
  }, [active, metric]);

  const table = useMemo(
    () =>
      active.map((s, i) => {
        const pts = s.points.filter((p) => p.medianPsf != null);
        const first = pts[0];
        const last = pts[pts.length - 1];
        const years = first && last ? Number(last.period) - Number(first.period) : 0;
        const growth = first?.medianPsf && last?.medianPsf ? ((last.medianPsf - first.medianPsf) / first.medianPsf) * 100 : null;
        const cagr = first?.medianPsf && last?.medianPsf && years > 0 ? (Math.pow(last.medianPsf / first.medianPsf, 1 / years) - 1) * 100 : null;
        const volume = s.points.reduce((a, p) => a + p.volume, 0);
        return {
          key: s.key,
          label: s.label,
          color: SERIES_COLORS[i % SERIES_COLORS.length],
          firstPsf: first?.medianPsf ?? null,
          lastPsf: last?.medianPsf ?? null,
          window: first && last ? `${first.period}–${last.period}` : "—",
          growth,
          cagr,
          volume,
        };
      }),
    [active]
  );

  const addOptions =
    mode === "district"
      ? meta.districts.filter((d) => !selected.includes(d)).map((d) => ({ value: d, label: districtLabel(d) }))
      : [];

  const addEntity = (v: string) => {
    if (!v || selected.includes(v) || selected.length >= MAX) return;
    setSelected([...selected, v]);
  };
  const remove = (k: string) => setSelected(selected.filter((s) => s !== k));

  return (
    <div className="space-y-5">
      <Card
        title="Growth comparison"
        subtitle={
          metric === "index"
            ? "Each line rebased to 100 at its own first year — compares appreciation trajectories directly."
            : "Median price psf per year, absolute."
        }
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented<Mode>
              value={mode}
              onChange={setMode}
              options={[
                { value: "project", label: "Projects" },
                { value: "district", label: "Districts" },
              ]}
            />
            <Segmented<Metric>
              value={metric}
              onChange={setMetric}
              options={[
                { value: "index", label: "Growth index" },
                { value: "psf", label: "PSF ($)" },
              ]}
            />
          </div>
        }
      >
        {/* Add + chips */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {mode === "project" ? (
            <>
              <input
                list="cmp-projects"
                value={pending}
                onChange={(e) => setPending(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    addEntity(pending);
                    setPending("");
                  }
                }}
                placeholder={selected.length >= MAX ? "Max 6 — remove one to add" : "Add a project + Enter"}
                disabled={selected.length >= MAX}
                className="h-9 w-64 rounded-lg border border-line bg-card px-2.5 text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20"
              />
              <datalist id="cmp-projects">
                {meta.projects.filter((p) => !selected.includes(p.name)).slice(0, 400).map((p) => (
                  <option key={p.name} value={p.name}>{`${dShort(p.district)} · ${p.count} caveats`}</option>
                ))}
              </datalist>
            </>
          ) : (
            <div className="w-64">
              <Select value="" onChange={addEntity} options={addOptions} placeholder={selected.length >= MAX ? "Max 6 reached" : "Add a district"} />
            </div>
          )}
          {table.map((t) => (
            <button
              key={t.key}
              onClick={() => remove(t.key)}
              className="group inline-flex items-center gap-1.5 rounded-full border border-line bg-card-2 py-1 pl-2 pr-2.5 text-xs font-medium text-ink-soft hover:border-clay"
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
              {t.label}
              <span className="text-muted group-hover:text-clay">✕</span>
            </button>
          ))}
        </div>

        {active.length === 0 ? (
          loading ? <div className="py-16"><Spinner /></div> : <Empty>Add a project or district to compare.</Empty>
        ) : (
          <div className="h-[360px] w-full">
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 4 }}>
                <CartesianGrid stroke="#e8dfce" vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#8c8375" }} tickLine={false} axisLine={{ stroke: "#e8dfce" }} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#8c8375" }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  domain={metric === "index" ? [80, "auto"] : ["auto", "auto"]}
                  tickFormatter={(v) => (metric === "index" ? String(v) : `$${fmtNum(v)}`)}
                />
                <Tooltip
                  formatter={(v, name) => {
                    const s = table.find((t) => t.key === name);
                    return [metric === "index" ? `${v}` : fmtSGD(Number(v)), s?.label ?? String(name)];
                  }}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e8dfce", background: "#fffdf8", fontSize: 12 }}
                />
                <Legend formatter={(name) => table.find((t) => t.key === name)?.label ?? name} wrapperStyle={{ fontSize: 11 }} />
                {metric === "index" && (
                  <Line dataKey={() => 100} stroke="#d8ccb7" strokeDasharray="4 4" dot={false} legendType="none" isAnimationActive={false} name="__base" />
                )}
                {table.map((t) => (
                  <Line key={t.key} dataKey={t.key} name={t.key} stroke={t.color} strokeWidth={2.4} dot={false} connectNulls isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {table.length > 0 && (
        <Card title="Side by side" subtitle="First vs latest year with data, per selection.">
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line bg-card-2 text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-3 py-2.5 font-medium">Selection</th>
                  <th className="px-3 py-2.5 font-medium">Window</th>
                  <th className="px-3 py-2.5 text-right font-medium">Entry PSF</th>
                  <th className="px-3 py-2.5 text-right font-medium">Latest PSF</th>
                  <th className="px-3 py-2.5 text-right font-medium">Total growth</th>
                  <th className="px-3 py-2.5 text-right font-medium">CAGR</th>
                  <th className="px-3 py-2.5 text-right font-medium">Caveats</th>
                </tr>
              </thead>
              <tbody>
                {table.map((t) => (
                  <tr key={t.key} className="border-b border-line/60 last:border-0">
                    <td className="px-3 py-2.5">
                      <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: t.color }} />
                      <span className="font-medium text-ink">{t.label}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-ink-soft">{t.window}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">{fmtSGD(t.firstPsf)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">{fmtSGD(t.lastPsf)}</td>
                    <td className={`px-3 py-2.5 text-right tabular-nums font-medium ${(t.growth ?? 0) >= 0 ? "text-emerald" : "text-brick"}`}>{fmtPct(t.growth)}</td>
                    <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${(t.cagr ?? 0) >= 0 ? "text-emerald" : "text-brick"}`}>{fmtPct(t.cagr)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted">{fmtNum(t.volume)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
