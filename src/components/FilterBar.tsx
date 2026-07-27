"use client";

import { TxnFilter } from "@/lib/types";
import { Meta } from "@/lib/analysis";
import { districtLabel } from "@/lib/format";
import { Field, Select, TextInput } from "./ui";
import { useMemo } from "react";

export type FilterField =
  | "district" | "project" | "propertyType" | "saleType"
  | "marketSegment" | "tenureType" | "size" | "price";

const ALL_FIELDS: FilterField[] = [
  "district", "project", "propertyType", "saleType", "marketSegment", "tenureType", "size", "price",
];

// Renders only the filters relevant to the current view — less noise, clearer UI.
export default function FilterBar({
  meta,
  filters,
  onChange,
  fields = ALL_FIELDS,
}: {
  meta: Meta;
  filters: TxnFilter;
  onChange: (f: TxnFilter) => void;
  fields?: FilterField[];
}) {
  const set = (patch: Partial<TxnFilter>) => onChange({ ...filters, ...patch });
  const has = (f: FilterField) => fields.includes(f);

  const projectOptions = useMemo(() => {
    const list = filters.district
      ? meta.projects.filter((p) => p.district === filters.district)
      : meta.projects;
    return list.slice(0, 400);
  }, [meta.projects, filters.district]);

  const active = Object.values(filters).filter((v) => v !== undefined && v !== "").length;

  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {has("district") && (
          <Field label="District">
            <Select
              value={filters.district || ""}
              onChange={(v) => set({ district: v || undefined, project: undefined })}
              options={meta.districts.map((d) => ({ value: d, label: districtLabel(d) }))}
              placeholder="All districts"
            />
          </Field>
        )}

        {has("project") && (
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
                  <option key={p.name} value={p.name}>{`D${parseInt(p.district, 10)} · ${p.count} caveats`}</option>
                ))}
              </datalist>
            </>
          </Field>
        )}

        {has("propertyType") && (
          <Field label="Property type">
            <Select
              value={filters.propertyType || ""}
              onChange={(v) => set({ propertyType: v || undefined })}
              options={meta.propertyTypes.map((t) => ({ value: t, label: t }))}
              placeholder="All types"
            />
          </Field>
        )}

        {has("saleType") && (
          <Field label="Sale type">
            <Select
              value={filters.saleType || ""}
              onChange={(v) => set({ saleType: v || undefined })}
              options={meta.saleTypes.map((t) => ({ value: t, label: t }))}
              placeholder="All sales"
            />
          </Field>
        )}

        {has("marketSegment") && (
          <Field label="Market segment">
            <Select
              value={filters.marketSegment || ""}
              onChange={(v) => set({ marketSegment: v || undefined })}
              options={meta.marketSegments.map((t) => ({ value: t, label: t }))}
              placeholder="CCR / RCR / OCR"
            />
          </Field>
        )}

        {has("tenureType") && (
          <Field label="Tenure">
            <Select
              value={filters.tenureType || ""}
              onChange={(v) => set({ tenureType: v || undefined })}
              options={meta.tenureTypes.map((t) => ({ value: t, label: t }))}
              placeholder="Any tenure"
            />
          </Field>
        )}

        {has("size") && (
          <>
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
          </>
        )}

        {has("price") && (
          <>
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
          </>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs text-muted">
          {active ? `${active} filter${active > 1 ? "s" : ""} active` : "No filters — whole market"}
        </span>
        {active > 0 && (
          <button onClick={() => onChange({})} className="text-xs font-medium text-amber hover:underline">
            Reset all
          </button>
        )}
      </div>
    </div>
  );
}
