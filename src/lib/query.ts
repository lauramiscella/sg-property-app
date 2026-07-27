import { TxnFilter } from "./types";

export function toQuery(filter: TxnFilter, extra: Record<string, string | number | undefined> = {}): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...filter, ...extra })) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
