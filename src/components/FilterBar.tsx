"use client";

import { TxnFilter } from "@/lib/types";
import { Meta } from "@/lib/analysis";
import { districtLabel } from "@/lib/format";
import { Field, Select, TextInput } from "./ui";
import { useMemo } from "react";

export default function FilterBar({
  meta,
  filters,
  onChange,
}: {
  meta: Meta;
  filters: TxnFilter;
  onChange: (f: TxnFilter) => void;
}) {
  const set = (patch: Partial<TxnFilter>) => onChange({ ...filters, ...patch });

  const projectOptions = useMemo(() => {
    const list = filters.district
      ? meta.projects.filter((p) => p.district === filters.district)
      : meta.projects;
    return list.slice(0, 400);
  }, [meta.projects, filters.district]);

  const active =
    Object.values(filters).filter((v) => v !== undefined && v !== "").length;

  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Field label="District">
          <Select
            value={filters.district || ""}
            onChange={(v) => set({ district: v || undefined, project: undefined })}
            options={meta.districts.map((d) => ({ value: d, label: districtLabel(d) }))}
            placeholder="All districts"
          />
        </Field>

        <Field label="Project">
          <>
            <input
              list="project-list"
              value={filters.project || ""}
              onChange={(e) => set({ project: e.target.value || undefined })}
              placeholder="Any project"
              className="h-9 w-full rounded-lg border border-line bg-card px-2.5 text-sm text-ink outline-none placeholder:text-muted/70 focus:border-amber focus:ring-2 focus:ring-amber/20"
            />
            <datalist id="project-list">
              {projectOptions.map((p) => (
                <option key={p.name} value={p.name}>
                  {`D${p.district} · ${p.count} caveats`}
                </option>
              ))}
            </datalist>
          </>
        </Field>

        <Field label="Property type">
          <Select
            value={filters.propertyType || ""}
            onChange={(v) => set({ propertyType: v || undefined })}
            options={meta.propertyTypes.map((t) => ({ value: t, label: t }))}
            placeholder="All types"
          />
        </Field>

        <Field label="Sale type">
          <Select
            value={filters.saleType || ""}
            onChange={(v) => set({ saleType: v || undefined })}
            options={meta.saleTypes.map((t) => ({ value: t, label: t }))}
            placeholder="All sales"
          />
        </Field>

        <Field label="Market segment">
          <Select
            value={filters.marketSegment || ""}
            onChange={(v) => set({ marketSegment: v || undefined })}
            options={meta.marketSegments.map((t) => ({ value: t, label: t }))}
            placeholder="CCR / RCR / OCR"
          />
        </Field>

        <Field label="Tenure">
          <Select
            value={filters.tenureType || ""}
            onChange={(v) => set({ tenureType: v || undefined })}
            options={meta.tenureTypes.map((t) => ({ value: t, label: t }))}
            placeholder="Any tenure"
          />
        </Field>

        <Field label="From (YYYY-MM)">
          <TextInput
            value={filters.from || ""}
            onChange={(v) => set({ from: v || undefined })}
            placeholder={meta.months?.min || "2020-01"}
          />
        </Field>

        <Field label="To (YYYY-MM)">
          <TextInput
            value={filters.to || ""}
            onChange={(v) => set({ to: v || undefined })}
            placeholder={meta.months?.max || "2026-07"}
          />
        </Field>

        <Field label="Min size (sqft)">
          <TextInput
            type="number"
            value={filters.minArea != null ? String(filters.minArea) : ""}
            onChange={(v) => set({ minArea: v ? Number(v) : undefined })}
            placeholder="0"
          />
        </Field>

        <Field label="Max size (sqft)">
          <TextInput
            type="number"
            value={filters.maxArea != null ? String(filters.maxArea) : ""}
            onChange={(v) => set({ maxArea: v ? Number(v) : undefined })}
            placeholder="Any"
          />
        </Field>

        <Field label="Min price">
          <TextInput
            type="number"
            value={filters.minPrice != null ? String(filters.minPrice) : ""}
            onChange={(v) => set({ minPrice: v ? Number(v) : undefined })}
            placeholder="0"
          />
        </Field>

        <Field label="Max price">
          <TextInput
            type="number"
            value={filters.maxPrice != null ? String(filters.maxPrice) : ""}
            onChange={(v) => set({ maxPrice: v ? Number(v) : undefined })}
            placeholder="Any"
          />
        </Field>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-muted">
          {active ? `${active} filter${active > 1 ? "s" : ""} active` : "No filters — whole market"}
        </span>
        {active > 0 && (
          <button
            onClick={() => onChange({})}
            className="text-xs font-medium text-amber hover:underline"
          >
            Reset all
          </button>
        )}
      </div>
    </div>
  );
}
