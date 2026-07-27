import { TxnFilter } from "./types";

export function parseFilter(sp: URLSearchParams): TxnFilter {
  const num = (v: string | null) => (v != null && v !== "" ? Number(v) : undefined);
  const str = (v: string | null) => (v != null && v !== "" ? v : undefined);
  return {
    district: str(sp.get("district")),
    project: str(sp.get("project")),
    propertyType: str(sp.get("propertyType")),
    saleType: str(sp.get("saleType")),
    marketSegment: str(sp.get("marketSegment")),
    tenureType: str(sp.get("tenureType")),
    minArea: num(sp.get("minArea")),
    maxArea: num(sp.get("maxArea")),
    minPrice: num(sp.get("minPrice")),
    maxPrice: num(sp.get("maxPrice")),
    from: str(sp.get("from")),
    to: str(sp.get("to")),
  };
}
