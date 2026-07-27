"use client";

// Custom project autocomplete that renders identically on every browser —
// replaces the native <datalist>, whose UI is inconsistent (arrow on some
// phones, invisible on others).

import { useEffect, useRef, useState } from "react";
import { dShort } from "@/lib/format";

export interface ProjectOption {
  name: string;
  district: string;
  count: number;
}

export default function ProjectSearch({
  projects,
  value,
  onChange,
  onSelect,
  placeholder = "Type a project name",
}: {
  projects: ProjectOption[];
  value: string;
  onChange: (v: string) => void;
  onSelect?: (name: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const q = value.trim().toLowerCase();
  const matches = (q ? projects.filter((p) => p.name.toLowerCase().includes(q)) : projects).slice(0, 8);

  const pick = (name: string) => {
    onChange(name);
    onSelect?.(name);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && matches.length > 0) {
            e.preventDefault();
            pick(matches[0].name);
          }
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-line bg-card px-2.5 pr-8 text-sm text-ink outline-none placeholder:text-muted/70 focus:border-amber focus:ring-2 focus:ring-amber/20"
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            onChange("");
            setOpen(false);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-1 text-sm text-muted hover:text-clay"
          aria-label="Clear project"
        >
          ✕
        </button>
      ) : (
        <svg
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      )}
      {open && matches.length > 0 && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-line bg-card shadow-lg">
          {matches.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => pick(p.name)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-card-2"
            >
              <span className="truncate font-medium text-ink">{p.name}</span>
              <span className="shrink-0 text-[11px] text-muted">
                {dShort(p.district)} · {p.count}
              </span>
            </button>
          ))}
        </div>
      )}
      {open && q.length > 1 && matches.length === 0 && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-xs text-muted shadow-lg">
          No project found with that name in the data.
        </div>
      )}
    </div>
  );
}
