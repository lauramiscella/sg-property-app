"use client";

import { useEffect, useState } from "react";
import { Txn, TxnFilter } from "@/lib/types";
import { ComparablesResult } from "@/lib/analysis";
import { toQuery } from "@/lib/query";
import { fmtNum, fmtSGD, districtLabel, dShort } from "@/lib/format";
import { Card, Kpi, Spinner, Empty, SegmentBadge } from "./ui";

const PAGE_SIZE = 50;

type SortKey = "date" | "price" | "psf" | "areaSqft";

export default function Comparables({ filters }: { filters: TxnFilter }) {
  const [sort, setSort] = useState<SortKey>("date");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ComparablesResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [filters, sort, dir]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const url = `/api/transactions${toQuery(filters, { sort, dir, page, pageSize: PAGE_SIZE })}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => !cancelled && setData(d))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filters, sort, dir, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const toggleSort = (k: SortKey) => {
    if (sort === k) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setSort(k);
      setDir("desc");
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows: Txn[] = [];
      const total = data?.total ?? 0;
      const cap = Math.min(total, 5000);
      let p = 1;
      while (rows.length < cap) {
        const url = `/api/transactions${toQuery(filters, { sort, dir, page: p, pageSize: 200 })}`;
        const res = await fetch(url);
        const j: ComparablesResult = await res.json();
        rows.push(...j.rows);
        if (j.rows.length < 200) break;
        p++;
      }
      const header = [
        "Date",
        "Project",
        "Street",
        "District",
        "Segment",
        "PropertyType",
        "SaleType",
        "Tenure",
        "Floor",
        "AreaSqft",
        "AreaSqm",
        "Price",
        "PSF",
      ];
      const lines = rows.map((r) =>
        [
          r.month,
          r.project,
          r.street,
          r.district,
          r.marketSegment,
          r.propertyType,
          r.saleType,
          r.tenure,
          r.floorRange ?? "",
          Math.round(r.areaSqft),
          r.areaSqm,
          r.price,
          Math.round(r.psf),
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      );
      const csv = [header.join(","), ...lines].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "sg-comparables.csv";
      link.click();
      URL.revokeObjectURL(link.href);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card
      title="Matching transactions"
      subtitle={data ? `${fmtNum(data.total)} caveats match your filters` : "—"}
      right={
        <button
          onClick={exportCsv}
          disabled={exporting || !data?.total}
          className="rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-amber hover:text-amber disabled:opacity-50"
        >
          {exporting ? "Preparing…" : "Export CSV"}
        </button>
      }
    >
      {data && data.total > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-3">
          <Kpi label="Median PSF" value={fmtSGD(data.summary.medianPsf)} accent="amber" />
          <Kpi label="Median price" value={fmtSGD(data.summary.medianPrice)} accent="plum" />
          <Kpi label="Avg size" value={`${fmtNum(data.summary.avgArea)} sqft`} accent="gold" />
        </div>
      )}

      {loading && !data ? (
        <div className="py-16">
          <Spinner />
        </div>
      ) : data && data.total === 0 ? (
        <Empty>No transactions match these filters. Widen the range or clear a filter.</Empty>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-line bg-card-2 text-left text-[11px] uppercase tracking-wide text-muted">
                  <Th onClick={() => toggleSort("date")} active={sort === "date"} dir={dir}>
                    Date
                  </Th>
                  <th className="px-3 py-2.5 font-medium">Project</th>
                  <th className="px-3 py-2.5 font-medium">District</th>
                  <th className="px-3 py-2.5 font-medium">Type / Sale</th>
                  <ThRight onClick={() => toggleSort("areaSqft")} active={sort === "areaSqft"} dir={dir}>
                    Size
                  </ThRight>
                  <ThRight onClick={() => toggleSort("price")} active={sort === "price"} dir={dir}>
                    Price
                  </ThRight>
                  <ThRight onClick={() => toggleSort("psf")} active={sort === "psf"} dir={dir}>
                    PSF
                  </ThRight>
                </tr>
              </thead>
              <tbody>
                {data?.rows.map((r) => (
                  <tr key={r.id} className="border-b border-line/60 last:border-0 hover:bg-card-2">
                    <td className="whitespace-nowrap px-3 py-2.5 text-ink-soft">{r.month}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-ink">{r.project}</div>
                      <div className="text-xs text-muted">
                        {r.street} · <SegmentBadge seg={String(r.marketSegment)} /> ·{" "}
                        {r.tenureType}
                        {r.floorRange ? ` · flr ${r.floorRange}` : ""}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-ink-soft">{dShort(r.district)}</td>
                    <td className="px-3 py-2.5 text-ink-soft">
                      <div>{r.propertyType}</div>
                      <div className="text-xs text-muted">{r.saleType}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-ink-soft">
                      {fmtNum(r.areaSqft)} sqft
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums font-medium text-ink">
                      {fmtSGD(r.price)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-amber">
                      {fmtSGD(r.psf)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted">
              Page {data?.page ?? 1} of {totalPages} · showing {district(filters)}
            </span>
            <div className="flex gap-2">
              <PageBtn disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                ← Prev
              </PageBtn>
              <PageBtn disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next →
              </PageBtn>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

function district(f: TxnFilter): string {
  if (f.project) return f.project;
  if (f.district) return districtLabel(f.district);
  return "whole market";
}

function Th({
  children,
  onClick,
  active,
  dir,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  dir: "asc" | "desc";
}) {
  return (
    <th className="px-3 py-2.5 font-medium">
      <button onClick={onClick} className={`inline-flex items-center gap-1 ${active ? "text-amber" : ""}`}>
        {children}
        {active && <span>{dir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </th>
  );
}
function ThRight(props: Parameters<typeof Th>[0]) {
  return (
    <th className="px-3 py-2.5 text-right font-medium">
      <button
        onClick={props.onClick}
        className={`inline-flex items-center gap-1 ${props.active ? "text-amber" : ""}`}
      >
        {props.children}
        {props.active && <span>{props.dir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </th>
  );
}

function PageBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-amber hover:text-amber disabled:opacity-40"
    >
      {children}
    </button>
  );
}
