"use client";

import { ReactNode } from "react";

export function Card({
  children,
  className = "",
  title,
  subtitle,
  right,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border border-line bg-card shadow-[0_1px_2px_rgba(70,55,35,0.04),0_8px_24px_-16px_rgba(70,55,35,0.18)] ${className}`}
    >
      {(title || right) && (
        <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-line">
          <div>
            {title && <h3 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

export type Accent = "amber" | "emerald" | "plum" | "gold" | "brick" | "olive";

const ACCENT_VAR: Record<Accent, string> = {
  amber: "var(--color-amber)",
  emerald: "var(--color-emerald)",
  plum: "var(--color-plum)",
  gold: "var(--color-gold)",
  brick: "var(--color-brick)",
  olive: "var(--color-olive)",
};

export function Kpi({
  label,
  value,
  sub,
  tone = "default",
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "up" | "down";
  accent?: Accent;
}) {
  const toneClass = tone === "up" ? "text-emerald" : tone === "down" ? "text-brick" : "text-ink";
  const barColor = accent ? ACCENT_VAR[accent] : "var(--color-line-strong)";
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-line bg-card-2 px-4 py-3 pl-[15px]"
      style={{ boxShadow: `inset 3px 0 0 ${barColor}` }}
    >
      <div className="text-[11px] uppercase tracking-wide" style={accent ? { color: barColor } : { color: "var(--color-muted)" }}>
        {label}
      </div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

export function Select({
  value,
  onChange,
  options,
  placeholder = "Any",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border border-line bg-card px-2.5 text-sm text-ink outline-none focus:border-amber focus:ring-2 focus:ring-amber/20"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-9 w-full rounded-lg border border-line bg-card px-2.5 text-sm text-ink outline-none placeholder:text-muted/70 focus:border-amber focus:ring-2 focus:ring-amber/20"
    />
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-card-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
            value === o.value ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-line border-t-amber" />
      {label || "Loading…"}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong bg-card-2 px-5 py-10 text-center text-sm text-muted">
      {children}
    </div>
  );
}

export function SegmentBadge({ seg }: { seg: string }) {
  const color = seg === "CCR" ? "var(--color-ccr)" : seg === "OCR" ? "var(--color-ocr)" : "var(--color-rcr)";
  if (!seg) return <span className="text-[11px] font-semibold text-muted">—</span>;
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      {seg}
    </span>
  );
}
