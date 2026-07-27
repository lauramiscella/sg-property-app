"use client";

import { useCallback, useEffect, useState } from "react";
import { TxnFilter } from "@/lib/types";
import { Meta } from "@/lib/analysis";
import FilterBar from "./FilterBar";
import PsfTrends from "./PsfTrends";
import Comparables from "./Comparables";
import RentalYield from "./RentalYield";
import Appreciation from "./Appreciation";
import Compare from "./Compare";
import Premium from "./Premium";
import ValueCheck from "./ValueCheck";
import Calculator from "./Calculator";
import { Spinner } from "./ui";

type Tab = "psf" | "comps" | "yield" | "appreciation" | "premium" | "value" | "compare" | "calc";

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: "psf", label: "Price / PSF Trends", hint: "How pricing has moved over time" },
  { id: "comps", label: "Comparables", hint: "Every matching caveat, filterable" },
  { id: "yield", label: "Rental Yield", hint: "Gross yield by area & unit type" },
  { id: "appreciation", label: "Appreciation", hint: "Project-level growth & CAGR" },
  { id: "premium", label: "New vs Resale", hint: "New-launch premium over resale" },
  { id: "value", label: "Value Check", hint: "Am I overpaying for this unit?" },
  { id: "compare", label: "Compare", hint: "Overlay projects & districts side by side" },
  { id: "calc", label: "Calculator", hint: "Buyer costs & asset-progression math" },
];

const NO_FILTER_TABS: Tab[] = ["calc", "compare", "value"];

export default function Dashboard() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<TxnFilter>({});
  const [tab, setTab] = useState<Tab>("psf");

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

  return (
    <div className="relative z-10 mx-auto w-full max-w-[1220px] px-5 pb-24 pt-6">
      {/* Header */}
      <header
        className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-line px-6 py-5"
        style={{
          background:
            "linear-gradient(135deg, #fff8ec 0%, #fbf0dd 45%, #f4e6d0 100%)",
        }}
      >
        <div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ background: "linear-gradient(135deg, var(--color-plum), var(--color-amber) 55%, var(--color-emerald))" }}
            />
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber">
              Singapore · Private Residential
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-[29px]">
            Transaction Intelligence
          </h1>
          <p className="mt-1 max-w-xl text-sm text-ink-soft">
            URA caveat data across the whole island — price movement, rental yield, project
            appreciation, comparables, and the buyer maths, in one place.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
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

      {meta?.error && (
        <div className="mt-4 rounded-xl border border-clay/30 bg-clay/5 px-4 py-3 text-sm text-clay">
          URA fetch reported: {meta.error} — showing cached or sample data instead.
        </div>
      )}

      {/* Filters — hidden on tabs that carry their own selection */}
      {!NO_FILTER_TABS.includes(tab) && (
        <div className="mt-6">
          {metaLoading || !meta ? (
            <div className="rounded-2xl border border-line bg-card px-5 py-6">
              <Spinner label="Loading dataset…" />
            </div>
          ) : (
            <FilterBar meta={meta} filters={filters} onChange={setFilters} />
          )}
        </div>
      )}

      {/* Tabs */}
      <nav className="mt-6 flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative -mb-px rounded-t-lg px-3.5 py-2.5 text-sm font-medium transition ${
              tab === t.id
                ? "text-ink"
                : "text-muted hover:text-ink-soft"
            }`}
          >
            {t.label}
            {tab === t.id && (
              <span
                className="absolute inset-x-2 -bottom-px h-[3px] rounded-full"
                style={{ background: "linear-gradient(90deg, var(--color-amber), var(--color-plum))" }}
              />
            )}
          </button>
        ))}
      </nav>

      {/* Panel */}
      <main className="mt-6">
        {!meta ? null : tab === "psf" ? (
          <PsfTrends filters={filters} />
        ) : tab === "comps" ? (
          <Comparables filters={filters} />
        ) : tab === "yield" ? (
          <RentalYield filters={filters} meta={meta} />
        ) : tab === "appreciation" ? (
          <Appreciation filters={filters} />
        ) : tab === "premium" ? (
          <Premium filters={filters} />
        ) : tab === "value" ? (
          <ValueCheck meta={meta} />
        ) : tab === "compare" ? (
          <Compare meta={meta} />
        ) : (
          <Calculator />
        )}
      </main>

      <footer className="mt-16 border-t border-line pt-5 text-xs text-muted">
        Source: Urban Redevelopment Authority (URA) private residential caveats. Figures are as
        lodged and can revise. PSF uses net price where a caveat records one. This tool is for
        research, not formal valuation or advice.
      </footer>
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
