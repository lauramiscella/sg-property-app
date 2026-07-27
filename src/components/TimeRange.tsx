"use client";

import { TxnFilter } from "@/lib/types";
import { Meta } from "@/lib/analysis";

// Compact time-window control shown next to charts (not in the property filters,
// since the timeline belongs to the chart). Presets + free from/to.

const PRESETS: { label: string; years: number | null }[] = [
  { label: "1Y", years: 1 },
  { label: "3Y", years: 3 },
  { label: "5Y", years: 5 },
];

function shiftMonth(maxMonth: string, yearsBack: number): string {
  const [y, m] = maxMonth.split("-").map(Number);
  return `${y - yearsBack}-${String(m).padStart(2, "0")}`;
}

export default function TimeRange({
  meta,
  filters,
  onChange,
}: {
  meta: Meta;
  filters: TxnFilter;
  onChange: (f: TxnFilter) => void;
}) {
  const maxMonth = meta.months?.max;
  const activePreset = (() => {
    // No explicit window = everything URA serves (~5 years), so 5Y is the default.
    if (!filters.from && !filters.to) return "5Y";
    if (!maxMonth || filters.to) return null;
    for (const p of PRESETS) {
      if (p.years && filters.from === shiftMonth(maxMonth, p.years)) return p.label;
    }
    return null;
  })();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-lg border border-line bg-card-2 p-0.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() =>
              onChange({
                ...filters,
                from: p.years && maxMonth ? shiftMonth(maxMonth, p.years) : undefined,
                to: undefined,
              })
            }
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              activePreset === p.label ? "bg-card text-amber shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted">
        <input
          value={filters.from || ""}
          onChange={(e) => onChange({ ...filters, from: e.target.value || undefined })}
          placeholder={meta.months?.min || "YYYY-MM"}
          className="h-7 w-[86px] rounded-md border border-line bg-card px-2 text-xs text-ink outline-none placeholder:text-muted/60 focus:border-amber"
        />
        →
        <input
          value={filters.to || ""}
          onChange={(e) => onChange({ ...filters, to: e.target.value || undefined })}
          placeholder={meta.months?.max || "YYYY-MM"}
          className="h-7 w-[86px] rounded-md border border-line bg-card px-2 text-xs text-ink outline-none placeholder:text-muted/60 focus:border-amber"
        />
      </div>
    </div>
  );
}
