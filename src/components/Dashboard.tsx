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
import Absorption from "./Absorption";
import BentoHome from "./BentoHome";
import { Spinner } from "./ui";

// Optional "get full access" link shown on the trial banner (e.g. a wa.me
// WhatsApp link). Set NEXT_PUBLIC_CONTACT_URL in Vercel; hidden if unset.
const CONTACT_URL = process.env.NEXT_PUBLIC_CONTACT_URL || "";

type View =
  | "home"
  | "psf" | "momentum" | "tenure"
  | "appreciation" | "yield" | "sizebands" | "comps"
  | "premium"
  | "value" | "budget" | "absorption"
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
      { id: "absorption", label: "Sell Speed", hint: "How fast will it sell? Supply vs URA sales pace, and how price changes the wait" },
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

const NO_FILTER_VIEWS: View[] = ["home", "calc", "value", "budget", "absorption"];

// Views that are completely locked for trial visitors (server refuses the
// data too — this list only controls the UI).
const LOCKED_VIEWS: View[] = ["momentum", "tenure", "appreciation", "yield", "sizebands", "premium", "value", "absorption"];

// Only the filters that make sense for each view — everything else is hidden.
const VIEW_FILTERS: Partial<Record<View, FilterField[]>> = {
  psf: ["district", "project", "propertyType", "saleType", "marketSegment", "tenureType", "size", "price"],
  momentum: ["district", "propertyType", "saleType", "marketSegment"],
  tenure: ["district", "propertyType", "saleType", "marketSegment"],
  appreciation: ["project"],
  yield: ["district", "project", "propertyType"],
  sizebands: ["district", "propertyType", "saleType", "marketSegment"],
  comps: ["district", "project", "propertyType", "saleType", "marketSegment", "tenureType", "size", "price"],
  premium: ["district", "propertyType", "marketSegment", "size", "price"],
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
  const [view, setView] = useState<View>("home");

  const group = GROUPS.find((g) => g.views.some((sv) => sv.id === view)) ?? null;
  const activeView = group?.views.find((sv) => sv.id === view) ?? null;

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

  const v = view;
  const trial = meta?.access === "trial";
  const isLocked = (id: View) => trial && LOCKED_VIEWS.includes(id);

  return (
    <div className="relative z-10 flex min-h-screen overflow-x-clip">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col overflow-y-auto border-r border-line bg-card/60 px-4 py-6 lg:flex print:hidden">
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
          <button
            onClick={() => setView("home")}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-semibold transition"
            style={
              view === "home"
                ? { background: "color-mix(in srgb, var(--color-amber) 14%, transparent)", color: "var(--color-amber)" }
                : { color: "var(--color-ink-soft)" }
            }
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>
            Home
          </button>
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
                      {isLocked(sv.id) && <span className="ml-1 text-[10px] opacity-70">🔒</span>}
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
          {/* Header — banner sits BEHIND text on desktop, BELOW text on mobile (no overlap) */}
          <header
            className="relative flex min-h-0 flex-wrap items-center justify-between gap-4 overflow-hidden rounded-2xl border border-line px-6 py-5 md:min-h-[150px] print:hidden"
            style={{ backgroundColor: "#f5e9cf" }}
          >
            {/* desktop-only background artwork + cream wash for legibility */}
            <span
              className="pointer-events-none absolute inset-0 hidden md:block"
              style={{
                backgroundImage: "url(/header-banner.jpg)",
                backgroundSize: "auto 100%",
                backgroundPosition: "right center",
                backgroundRepeat: "no-repeat",
              }}
            />
            <span
              className="pointer-events-none absolute inset-0 hidden md:block"
              style={{ background: "linear-gradient(90deg, #f5e9cf 0%, rgba(245,233,207,0.92) 34%, rgba(245,233,207,0) 62%)" }}
            />
            <div className="relative max-w-[520px]">
              <h1 className="text-[22px] font-bold tracking-tight text-ink">
                Welcome, sharol.ai <span className="align-middle">🏠</span>
              </h1>
              <p className="mt-1 text-sm font-medium leading-snug text-ink-soft">
                Built for homeowners and home-seekers — official URA transaction data, decoded so you
                can make better-informed decisions.
              </p>
              <p className="mt-1.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-amber">
                built by Sharol
              </p>
            </div>
            <div className="relative flex flex-col items-start gap-2 rounded-xl p-2 md:items-end md:bg-[#f5e9cf]/90">
              {meta && <SourceBadge meta={meta} />}
              {meta?.access !== "trial" && (
                <button
                  onClick={refresh}
                  disabled={refreshing}
                  className="rounded-lg border border-amber/40 bg-card px-3 py-1.5 text-xs font-medium text-amber shadow-sm transition hover:bg-amber hover:text-white disabled:opacity-50"
                >
                  {refreshing ? "Refreshing…" : "Refresh data"}
                </button>
              )}
            </div>
            {/* mobile-only: banner shown below the text, full width, never overlapping */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/header-banner.jpg"
              alt="Hand-sketched Singapore shophouses"
              className="relative -mx-1 mt-1 w-full rounded-xl md:hidden"
            />
          </header>

          {meta?.access === "trial" && <TrialBanner meta={meta} />}

          {/* Quick starts — on inner views only (the Home tiles cover this on Home) */}
          {view !== "home" && (
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4 print:hidden">
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
                  <div className="mt-2 text-[13px] font-bold leading-snug text-ink">
                    {q.title}
                    {isLocked(q.view) && <span className="ml-1 text-[11px] opacity-70">🔒</span>}
                  </div>
                  <div className="mt-0.5 hidden text-[11px] leading-snug text-muted sm:block">{q.desc}</div>
                  <div className="mt-1.5 text-[11px] font-semibold" style={{ color: q.color }}>
                    {active ? "You're here" : <>Open <span className="inline-block transition group-hover:translate-x-0.5">→</span></>}
                  </div>
                </button>
              );
            })}
          </div>
          )}

          {meta?.error && (
            <div className="mt-4 rounded-xl border border-clay/30 bg-clay/5 px-4 py-3 text-sm text-clay">
              URA fetch reported: {meta.error} — showing cached or sample data instead.
            </div>
          )}

          {/* Mobile nav */}
          <nav className="mt-5 flex flex-wrap gap-2 lg:hidden print:hidden">
            <button
              onClick={() => setView("home")}
              className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[13px] font-semibold transition"
              style={
                view === "home"
                  ? {
                      background: "linear-gradient(135deg, var(--color-amber), color-mix(in srgb, var(--color-amber) 72%, #3a2c1a))",
                      borderColor: "var(--color-amber)",
                      color: "#fffdf8",
                    }
                  : { background: "var(--color-card)", borderColor: "var(--color-line)", color: "var(--color-amber)" }
              }
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>
              Home
            </button>
            {GROUPS.map((g) => {
              const active = g.id === group?.id;
              return (
                <button
                  key={g.id}
                  onClick={() => setView(g.views[0].id)}
                  className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[13px] font-semibold transition"
                  style={
                    active
                      ? {
                          background: `linear-gradient(135deg, ${g.color}, color-mix(in srgb, ${g.color} 72%, #3a2c1a))`,
                          borderColor: g.color,
                          color: "#fffdf8",
                          boxShadow: `0 6px 14px -6px color-mix(in srgb, ${g.color} 65%, transparent)`,
                        }
                      : { background: "var(--color-card)", borderColor: "var(--color-line)", color: g.color }
                  }
                >
                  {g.icon}
                  {g.label}
                </button>
              );
            })}
          </nav>
          {group && group.views.length > 1 && (
            <div className="mt-2 flex lg:hidden print:hidden">
              <div className="inline-flex flex-wrap rounded-lg border border-line bg-card-2 p-0.5">
                {group.views.map((sv) => (
                  <button
                    key={sv.id}
                    onClick={() => setView(sv.id)}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${sv.id === view ? "bg-card shadow-sm" : "text-muted"}`}
                    style={sv.id === view ? { color: group.color } : undefined}
                  >
                    {sv.label}
                    {isLocked(sv.id) && <span className="ml-1 text-[10px] opacity-70">🔒</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* View title + hint (not on Home — the tiles speak for themselves) */}
          {group && activeView && (
          <div className="mt-5 flex flex-wrap items-center gap-2.5 print:hidden">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-xl text-white"
              style={{
                background: `linear-gradient(135deg, ${group.color}, color-mix(in srgb, ${group.color} 70%, #3a2c1a))`,
                boxShadow: `0 5px 12px -5px color-mix(in srgb, ${group.color} 70%, transparent)`,
              }}
            >
              {group.icon}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[16px] font-bold text-ink">{activeView.label}</h2>
              <p className="text-xs text-muted">{activeView.hint}</p>
            </div>
            {v !== "calc" && !trial && (
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-medium text-ink-soft shadow-sm transition hover:border-amber hover:text-amber print:hidden"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V3h12v6" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><path d="M6 14h12v8H6z" /></svg>
                Export PDF
              </button>
            )}
          </div>
          )}

          {/* Print-only: standardized branded header for every PDF export */}
          <div className="mb-4 hidden border-b-2 border-amber pb-3 print:block">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber">sharol.ai</span>
              <span className="text-xs text-muted">{new Date().toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" })}</span>
            </div>
            <div className="mt-0.5 text-lg font-bold text-ink">Transaction Intelligence — {activeView?.label ?? "Overview"}</div>
            <p className="mt-1 text-xs text-ink-soft">
              Prepared by Sharol Pek · CEA Reg. No. R060616F · Source: URA private residential caveats
              {meta?.access === "trial" ? " (trial view — last 12 months)" : " (last 5 years)"} ·
              Estimates for discussion, not formal advice or valuation.
            </p>
          </div>

          {/* Print-only: faint diagonal watermark + slim running footer, repeated on every page */}
          <div className="print-watermark" aria-hidden>
            @sharol.ai
          </div>
          <div className="print-footer" aria-hidden>
            <span>@sharol.ai · Sharol Pek · CEA Reg. No. R060616F</span>
            <span>URA data · estimates only, not formal advice</span>
          </div>

          {/* Filters */}
          {!NO_FILTER_VIEWS.includes(v) && !isLocked(v) && (
            <div className="mt-4 print:hidden">
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
            {!meta ? null : v === "home" ? (
              <BentoHome trial={trial} onOpen={(x) => setView(x as View)} />
            ) : isLocked(v) ? (
              <LockedPanel label={activeView?.label ?? ""} />
            ) : v === "psf" ? (
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
            ) : v === "absorption" ? (
              <Absorption meta={meta} />
            ) : (
              <Calculator />
            )}
          </main>

          <footer className="mt-16 space-y-3 border-t border-line pt-5 text-xs text-muted">
            <p className="font-semibold text-ink-soft">
              Created by Sharol Pek · CEA Reg. No. R060616F · © {new Date().getFullYear()} All rights reserved.
            </p>
            <p>
              <b>Disclaimer.</b> This dashboard exists to make publicly available property data more transparent and
              easier to understand. All transaction figures are drawn from Urban Redevelopment Authority (URA) private
              residential caveats, presented as lodged; they may be revised by URA and can lag the market. PSF uses net
              price where a caveat records one. <b>All URA data shown covers up to the last 5 years of transactions</b> —
              URA does not publish further back; this app retains older months as they age out, so its archive grows
              over time. Calculator outputs use published IRAS/MAS
              rates current at the time of verification and are estimates only.
            </p>
            <p>
              Nothing on this site constitutes financial, investment or property advice, a recommendation to transact,
              or a formal valuation. Figures are market-level statistics, not assessments of any specific unit. Please
              verify independently and seek professional advice before making any property decision.
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}

function LockedPanel({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-card px-6 py-14 text-center">
      <span
        className="flex h-12 w-12 items-center justify-center rounded-2xl text-white"
        style={{ background: "linear-gradient(135deg, var(--color-amber), var(--color-gold))" }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 018 0v4" />
        </svg>
      </span>
      <div className="text-[15px] font-bold text-ink">{label} is in the full version</div>
      <p className="max-w-md text-sm text-ink-soft">
        The free preview covers Market Trends, Budget Explorer, Past Transactions and the Calculators.
        This tool — with up to 5 years of URA data behind it — opens with an access code.
      </p>
      {CONTACT_URL && (
        <a
          href={CONTACT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 rounded-lg px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:opacity-90"
          style={{ background: "linear-gradient(135deg, var(--color-amber), var(--color-gold))" }}
        >
          Message Sharol for full access
        </a>
      )}
    </div>
  );
}

function TrialBanner({ meta }: { meta: Meta }) {
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState("");
  const [state, setState] = useState<"idle" | "checking" | "wrong">("idle");

  const unlock = async () => {
    if (!code.trim()) return;
    setState("checking");
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.ok) window.location.reload();
      else setState("wrong");
    } catch {
      setState("wrong");
    }
  };

  return (
    <div
      className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-4 print:hidden"
      style={{
        borderColor: "color-mix(in srgb, var(--color-gold) 45%, transparent)",
        background: "linear-gradient(135deg, color-mix(in srgb, var(--color-gold) 14%, var(--color-card)), color-mix(in srgb, var(--color-amber) 7%, var(--color-card)))",
      }}
    >
      <div className="min-w-[240px] flex-1">
        <div className="text-[13px] font-bold text-ink">
          Free preview — last {meta.trialMonths ?? 12} months of URA data, capped results.
        </div>
        <p className="mt-0.5 text-xs text-ink-soft">
          The full version covers up to 5 years of transactions, every district, project names and full exports.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {CONTACT_URL && (
          <a
            href={CONTACT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg, var(--color-amber), var(--color-gold))" }}
          >
            Message Sharol for full access
          </a>
        )}
        {!showCode ? (
          <button
            onClick={() => setShowCode(true)}
            className="rounded-lg border border-line bg-card px-3 py-2 text-xs font-medium text-ink-soft transition hover:border-amber hover:text-amber"
          >
            Have an access code?
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (state === "wrong") setState("idle");
              }}
              onKeyDown={(e) => e.key === "Enter" && unlock()}
              placeholder="Access code"
              autoFocus
              className={`w-[130px] rounded-lg border bg-card px-2.5 py-2 text-xs text-ink outline-none transition focus:border-amber ${state === "wrong" ? "border-brick" : "border-line"}`}
            />
            <button
              onClick={unlock}
              disabled={state === "checking" || !code.trim()}
              className="rounded-lg border border-amber bg-amber px-3 py-2 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {state === "checking" ? "…" : "Unlock"}
            </button>
          </div>
        )}
      </div>
      {state === "wrong" && (
        <p className="w-full text-right text-[11px] font-medium text-brick">
          That code isn&apos;t right — check with Sharol.
        </p>
      )}
    </div>
  );
}

function SourceBadge({ meta }: { meta: Meta }) {
  const isSample = meta.source === "SAMPLE";
  return (
    <div
      className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium ${
        isSample ? "border-clay/40 bg-card text-clay" : "border-sage/40 bg-card text-sage"
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
