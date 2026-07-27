"use client";

import { useCallback, useEffect, useState } from "react";
import { TxnFilter } from "@/lib/types";
import { Meta } from "@/lib/analysis";
import FilterBar, { FilterField } from "./FilterBar";
import PsfTrends from "./PsfTrends";
import Comparables from "./Comparables";
import RentalYield from "./RentalYield";
import Appreciation from "./Appreciation";
import Compare from "./Compare";
import Premium from "./Premium";
import ValueCheck from "./ValueCheck";
import Calculator from "./Calculator";
import TenurePremium from "./TenurePremium";
import SizeBands from "./SizeBands";
import Budget from "./Budget";
import Momentum from "./Momentum";
import { Spinner } from "./ui";

type View =
  | "psf" | "momentum" | "tenure"
  | "appreciation" | "yield" | "sizebands" | "comps"
  | "premium"
  | "value" | "budget"
  | "calc";

interface Group {
  id: string;
  label: string;
  color: string;
  icon: React.ReactNode;
  views: { id: View; label: string; hint: string }[];
}

const IP = { width: 15, height: 15, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const GROUPS: Group[] = [
  {
    id: "trends", label: "Trends", color: "var(--color-amber)",
    icon: <svg {...IP} viewBox="0 0 24 24"><polyline points="3 17 9 11 13 15 21 7" /><polyline points="15 7 21 7 21 13" /></svg>,
    views: [
      { id: "psf", label: "Market Trends", hint: "Median $PSF and prices over time, for any slice of the market" },
      { id: "momentum", label: "District Momentum", hint: "Which districts heated up or cooled over the last 12 months" },
      { id: "tenure", label: "Freehold vs Leasehold", hint: "The premium buyers pay for freehold — and whether it's high or low vs history" },
    ],
  },
  {
    id: "projects", label: "Projects", color: "var(--color-emerald)",
    icon: <svg {...IP} viewBox="0 0 24 24"><rect x="4" y="8" width="7" height="12" /><rect x="13" y="4" width="7" height="16" /><line x1="2" y1="20" x2="22" y2="20" /></svg>,
    views: [
      { id: "appreciation", label: "Performance & Compare", hint: "Each project's price growth (CAGR), plus overlay projects or districts side by side" },
      { id: "yield", label: "Rental Yield", hint: "What rent brings in versus what units cost, by area and size" },
      { id: "sizebands", label: "Size Bands", hint: "Do bigger units really appreciate more? PSF and growth by unit size" },
      { id: "comps", label: "Past Transactions", hint: "Every recorded sale, filterable and exportable — the receipts" },
    ],
  },
  {
    id: "launches", label: "New Launches", color: "var(--color-plum)",
    icon: <svg {...IP} viewBox="0 0 24 24"><path d="M12 2l3 7h7l-5.5 4.5L18.5 21 12 16.5 5.5 21l2-7.5L2 9h7z" /></svg>,
    views: [
      { id: "premium", label: "Launch Premium", hint: "How much more new launches cost vs resale — and whether today's gap is high vs history" },
    ],
  },
  {
    id: "buyers", label: "Buyers & Sellers", color: "var(--color-gold)",
    icon: <svg {...IP} viewBox="0 0 24 24"><path d="M3 11l9-8 9 8" /><path d="M5 9v11h14V9" /><path d="M9 20v-6h6v6" /></svg>,
    views: [
      { id: "value", label: "Price Check", hint: "Is that asking price fair? See where it sits among recent comparable sales" },
      { id: "budget", label: "Budget Explorer", hint: "What can I get for $X? Real deals at your budget, district by district" },
    ],
  },
  {
    id: "calcs", label: "Calculators", color: "var(--color-clay)",
    icon: <svg {...IP} viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="9" y1="13" x2="9.01" y2="13" /><line x1="12" y1="13" x2="12.01" y2="13" /><line x1="15" y1="13" x2="15.01" y2="13" /><line x1="9" y1="17" x2="9.01" y2="17" /><line x1="12" y1="17" x2="12.01" y2="17" /><line x1="15" y1="17" x2="15.01" y2="17" /></svg>,
    views: [
      { id: "calc", label: "Calculators", hint: "Stamp duties, loans, max affordability, upgrade cash flow, breakeven" },
    ],
  },
];

const NO_FILTER_VIEWS: View[] = ["calc", "value", "budget"];

// Only the filters that make sense for each view — everything else is hidden.
const VIEW_FILTERS: Partial<Record<View, FilterField[]>> = {
  psf: ["district", "project", "propertyType", "saleType", "marketSegment", "tenureType", "size", "price"],
  momentum: ["propertyType", "saleType", "marketSegment"],
  tenure: ["district", "propertyType", "saleType", "marketSegment"],
  appreciation: ["project"],
  yield: ["district", "project", "propertyType"],
  sizebands: ["district", "propertyType", "saleType", "marketSegment"],
  comps: ["district", "project", "propertyType", "saleType", "marketSegment", "tenureType", "size", "price"],
  premium: ["district", "propertyType", "marketSegment", "size"],
};

// Colorful quick-start shortcuts for the landing view — the questions young
// buyers actually arrive with.
const QUICK_STARTS: { view: View; title: string; desc: string; color: string; icon: React.ReactNode }[] = [
  {
    view: "budget", title: "What can my budget buy?", desc: "Real deals at your price, district by district",
    color: "var(--color-gold)",
    icon: <svg {...IP} width={18} height={18} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v10M15 9.5c0-1-1.3-1.5-3-1.5s-3 .5-3 1.5 1 1.5 3 2 3 1 3 2-1.3 1.5-3 1.5-3-.5-3-1.5" /></svg>,
  },
  {
    view: "value", title: "Is this unit priced fairly?", desc: "Check an asking price against real sales",
    color: "var(--color-plum)",
    icon: <svg {...IP} width={18} height={18} viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16" y2="16" /><path d="M8.5 11l2 2 3.5-4" /></svg>,
  },
  {
    view: "momentum", title: "Which districts are heating up?", desc: "12-month price momentum, ranked",
    color: "var(--color-emerald)",
    icon: <svg {...IP} width={18} height={18} viewBox="0 0 24 24"><path d="M12 3c1 3-3 4-3 8a3 3 0 006 0c0-1-.5-2-1-3 2 1 4 3 4 6a6 6 0 01-12 0c0-5 5-7 6-11z" /></svg>,
  },
  {
    view: "calc", title: "How much can I afford?", desc: "Loans, stamp duty and your max price",
    color: "var(--color-clay)",
    icon: <svg {...IP} width={18} height={18} viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="9" y1="13" x2="9.01" y2="13" /><line x1="12" y1="13" x2="12.01" y2="13" /><line x1="15" y1="13" x2="15.01" y2="13" /></svg>,
  },
];

export default function Dashboard() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<TxnFilter>({});
  const [view, setView] = useState<View>("psf");
  const [greeting, setGreeting] = useState("Welcome back");

  const group = GROUPS.find((g) => g.views.some((v) => v.id === view))!;
  const activeView = group.views.find((v) => v.id === view)!;

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
  }, []);

  const loadMeta = useCallback(async () => {
    setMetaLoading(true);
    try {
      const res = await fetch("/api/meta");
      setMeta(await res.json());
    } finally {
      setMetaLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      setMeta(await res.json());
    } finally {
      setRefreshing(false);
    }
  };

  const v = activeView.id;

  return (
    <div className="relative z-10 flex min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col overflow-y-auto border-r border-line bg-card/60 px-4 py-6 lg:flex">
        <div className="flex items-center gap-2.5 px-2">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
            style={{ background: "linear-gradient(135deg, var(--color-plum), var(--color-amber) 60%, var(--color-emerald))" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-8 9 8" /><path d="M5 9v11h14V9" /></svg>
          </span>
          <div>
            <div className="text-[13px] font-bold leading-tight text-ink">Transaction<br />Intelligence</div>
          </div>
        </div>

        <nav className="mt-7 flex flex-col gap-5">
          {GROUPS.map((g) => (
            <div key={g.id}>
              <div className="flex items-center gap-1.5 px-2 text-[10.5px] font-bold uppercase tracking-[0.1em]" style={{ color: g.color }}>
                {g.icon}
                {g.label}
              </div>
              <div className="mt-1.5 flex flex-col gap-0.5">
                {g.views.map((sv) => {
                  const active = sv.id === view;
                  return (
                    <button
                      key={sv.id}
                      onClick={() => setView(sv.id)}
                      className="rounded-lg px-3 py-1.5 text-left text-[13px] font-medium transition"
                      style={
                        active
                          ? { background: `color-mix(in srgb, ${g.color} 14%, transparent)`, color: g.color, fontWeight: 700 }
                          : { color: "var(--color-ink-soft)" }
                      }
                    >
                      {sv.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto pt-6">
          <div className="rounded-2xl border border-line bg-card-2 px-3.5 py-3 text-[11px] leading-relaxed text-muted">
            <span className="font-semibold text-amber">Official URA data</span> — caveats refresh every
            Tue &amp; Fri. Research tool, not formal advice.
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-[1080px] px-5 pb-24 pt-6">
          {/* Greeting header with a pastel city skyline */}
          <header
            className="relative flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-2xl border border-line px-6 py-5"
            style={{ background: "linear-gradient(120deg, #fff8ec 0%, #fbf0dd 55%, #f4e6d0 100%)" }}
          >
            <svg
              className="pointer-events-none absolute bottom-0 right-0 h-[86px] w-[420px] max-w-[60%]"
              viewBox="0 0 420 86"
              preserveAspectRatio="xMaxYMax meet"
              aria-hidden
            >
              {/* back row */}
              <g opacity="0.35">
                <rect x="8" y="30" width="34" height="56" rx="3" fill="var(--color-plum)" />
                <rect x="70" y="18" width="30" height="68" rx="3" fill="var(--color-amber)" />
                <rect x="150" y="36" width="40" height="50" rx="3" fill="var(--color-emerald)" />
                <rect x="240" y="24" width="28" height="62" rx="3" fill="var(--color-gold)" />
                <rect x="330" y="14" width="34" height="72" rx="3" fill="var(--color-clay)" />
              </g>
              {/* front row */}
              <g opacity="0.55">
                <rect x="36" y="46" width="40" height="40" rx="3" fill="var(--color-emerald)" />
                <rect x="104" y="40" width="36" height="46" rx="3" fill="var(--color-plum)" />
                <rect x="190" y="52" width="44" height="34" rx="3" fill="var(--color-amber)" />
                <rect x="272" y="44" width="38" height="42" rx="3" fill="var(--color-emerald)" />
                <rect x="368" y="38" width="40" height="48" rx="3" fill="var(--color-gold)" />
                <polygon points="104,40 122,26 140,40" fill="var(--color-plum)" />
                <polygon points="368,38 388,24 408,38" fill="var(--color-gold)" />
              </g>
              {/* windows */}
              <g fill="#fffdf8" opacity="0.8">
                {[44, 56, 68].map((y) => (
                  <g key={y}>
                    <rect x="44" y={y + 8} width="6" height="6" rx="1" />
                    <rect x="58" y={y + 8} width="6" height="6" rx="1" />
                    <rect x="112" y={y} width="6" height="6" rx="1" />
                    <rect x="126" y={y} width="6" height="6" rx="1" />
                    <rect x="280" y={y + 6} width="6" height="6" rx="1" />
                    <rect x="294" y={y + 6} width="6" height="6" rx="1" />
                    <rect x="376" y={y} width="6" height="6" rx="1" />
                    <rect x="392" y={y} width="6" height="6" rx="1" />
                  </g>
                ))}
              </g>
            </svg>
            <div className="relative">
              <h1 className="text-[22px] font-bold tracking-tight text-ink">
                {greeting}! <span className="align-middle">🏠</span>
              </h1>
              <p className="mt-0.5 text-sm text-muted">
                Singapore private residential, from official URA caveats — here&apos;s the market today.
              </p>
            </div>
            <div className="relative flex flex-col items-end gap-2">
              {meta && <SourceBadge meta={meta} />}
              <button
                onClick={refresh}
                disabled={refreshing}
                className="rounded-lg border border-amber/40 bg-card px-3 py-1.5 text-xs font-medium text-amber shadow-sm transition hover:bg-amber hover:text-white disabled:opacity-50"
              >
                {refreshing ? "Refreshing…" : "Refresh data"}
              </button>
            </div>
          </header>

          {/* Quick starts — always visible so the main journeys are one tap away */}
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {QUICK_STARTS.map((q) => {
              const active = view === q.view;
              return (
                <button
                  key={q.view}
                  onClick={() => setView(q.view)}
                  className="group rounded-2xl border p-3.5 text-left transition hover:-translate-y-0.5"
                  style={{
                    background: `color-mix(in srgb, ${q.color} ${active ? 16 : 8}%, var(--color-card))`,
                    borderColor: `color-mix(in srgb, ${q.color} ${active ? 55 : 22}%, transparent)`,
                  }}
                >
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{ background: `color-mix(in srgb, ${q.color} 18%, transparent)`, color: q.color }}
                  >
                    {q.icon}
                  </span>
                  <div className="mt-2 text-[13px] font-bold leading-snug text-ink">{q.title}</div>
                  <div className="mt-0.5 hidden text-[11px] leading-snug text-muted sm:block">{q.desc}</div>
                  <div className="mt-1.5 text-[11px] font-semibold" style={{ color: q.color }}>
                    {active ? "You're here" : <>Open <span className="inline-block transition group-hover:translate-x-0.5">→</span></>}
                  </div>
                </button>
              );
            })}
          </div>

          {meta?.error && (
            <div className="mt-4 rounded-xl border border-clay/30 bg-clay/5 px-4 py-3 text-sm text-clay">
              URA fetch reported: {meta.error} — showing cached or sample data instead.
            </div>
          )}

          {/* Mobile nav */}
          <nav className="mt-5 flex flex-wrap gap-2 lg:hidden">
            {GROUPS.map((g) => {
              const active = g.id === group.id;
              return (
                <button
                  key={g.id}
                  onClick={() => setView(g.views[0].id)}
                  className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[13px] font-semibold transition"
                  style={active ? { background: g.color, borderColor: g.color, color: "#fffdf8" } : { background: "var(--color-card)", borderColor: "var(--color-line)", color: g.color }}
                >
                  {g.icon}
                  {g.label}
                </button>
              );
            })}
          </nav>
          {group.views.length > 1 && (
            <div className="mt-2 flex lg:hidden">
              <div className="inline-flex flex-wrap rounded-lg border border-line bg-card-2 p-0.5">
                {group.views.map((sv) => (
                  <button
                    key={sv.id}
                    onClick={() => setView(sv.id)}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${sv.id === view ? "bg-card shadow-sm" : "text-muted"}`}
                    style={sv.id === view ? { color: group.color } : undefined}
                  >
                    {sv.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* View title + hint */}
          <div className="mt-5 flex items-center gap-2.5">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-xl text-white"
              style={{ background: group.color }}
            >
              {group.icon}
            </span>
            <div>
              <h2 className="text-[16px] font-bold text-ink">{activeView.label}</h2>
              <p className="text-xs text-muted">{activeView.hint}</p>
            </div>
          </div>

          {/* Filters */}
          {!NO_FILTER_VIEWS.includes(v) && (
            <div className="mt-4">
              {metaLoading || !meta ? (
                <div className="rounded-2xl border border-line bg-card px-5 py-6">
                  <Spinner label="Loading dataset…" />
                </div>
              ) : (
                <FilterBar meta={meta} filters={filters} onChange={setFilters} fields={VIEW_FILTERS[v]} />
              )}
            </div>
          )}

          {/* Panel */}
          <main className="mt-5">
            {!meta ? null : v === "psf" ? (
              <PsfTrends filters={filters} meta={meta} onFiltersChange={setFilters} />
            ) : v === "comps" ? (
              <Comparables filters={filters} meta={meta} onFiltersChange={setFilters} />
            ) : v === "yield" ? (
              <RentalYield filters={filters} meta={meta} />
            ) : v === "appreciation" ? (
              <div className="space-y-5">
                <Appreciation filters={filters} />
                <Compare meta={meta} />
              </div>
            ) : v === "sizebands" ? (
              <SizeBands filters={filters} />
            ) : v === "momentum" ? (
              <Momentum filters={filters} />
            ) : v === "tenure" ? (
              <TenurePremium filters={filters} />
            ) : v === "premium" ? (
              <Premium filters={filters} />
            ) : v === "value" ? (
              <ValueCheck meta={meta} />
            ) : v === "budget" ? (
              <Budget meta={meta} />
            ) : (
              <Calculator />
            )}
          </main>

          <footer className="mt-16 border-t border-line pt-5 text-xs text-muted">
            Source: Urban Redevelopment Authority (URA) private residential caveats. Figures are as lodged and can
            revise. PSF uses net price where a caveat records one. URA publishes roughly the last 5 years; this app
            keeps older months as they age out, so its archive grows over time. This tool is for research, not formal
            valuation or advice.
          </footer>
        </div>
      </div>
    </div>
  );
}

function SourceBadge({ meta }: { meta: Meta }) {
  const isSample = meta.source === "SAMPLE";
  return (
    <div
      className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium ${
        isSample ? "border-clay/40 bg-clay/5 text-clay" : "border-sage/40 bg-sage/5 text-sage"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isSample ? "bg-clay" : "bg-sage"}`} />
      {isSample ? "SAMPLE DATA" : "LIVE · URA"}
      <span className="text-muted">·</span>
      <span className="text-muted">
        {meta.txnCount.toLocaleString()} caveats
        {meta.months ? ` · ${meta.months.min} → ${meta.months.max}` : ""}
      </span>
    </div>
  );
}
