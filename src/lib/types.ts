// Shared types for the SG private-property transaction app.

// Raw shapes returned by the URA data service ---------------------------------

export interface UraRawTransactionItem {
  area: string; // strata/land area in sqm (may be a single value or range)
  floorRange?: string; // e.g. "01-05"
  noOfUnits: string; // number of units in this caveat line
  contractDate: string; // "MMYY" e.g. "0324" = Mar 2024
  typeOfSale: string; // "1" New Sale, "2" Sub Sale, "3" Resale
  price: string; // transacted price in SGD
  propertyType: string; // e.g. "Condominium", "Apartment", "Terrace"
  district: string; // postal district "01".."28"
  typeOfArea: string; // "Strata" | "Land"
  tenure: string; // e.g. "Freehold" | "99 yrs lease commencing from 2015"
  nettPrice?: string; // present only when there is a discount
}

export interface UraRawTransactionGroup {
  project: string;
  street: string;
  marketSegment: string; // CCR | RCR | OCR
  x?: string;
  y?: string;
  transaction: UraRawTransactionItem[];
}

export interface UraRawRentalItem {
  areaSqft?: string; // range e.g. "700 to 800"
  areaSqm?: string; // range e.g. "70 to 80"
  leaseDate: string; // "MMYY"
  propertyType: string;
  district: string;
  noOfBedRoom?: string; // "0" for studio / unknown
  rent: string; // monthly gross rent SGD
}

export interface UraRawRentalGroup {
  project: string;
  street: string;
  x?: string;
  y?: string;
  rental: UraRawRentalItem[];
}

// Normalised, analysis-friendly shapes ----------------------------------------

export type MarketSegment = "CCR" | "RCR" | "OCR";
export type SaleType = "New Sale" | "Sub Sale" | "Resale";
export type TenureType = "Freehold" | "Leasehold";

export interface Txn {
  id: string;
  project: string;
  street: string;
  marketSegment: MarketSegment | string;
  district: string; // "01".."28"
  propertyType: string;
  saleType: SaleType;
  tenure: string; // raw tenure string
  tenureType: TenureType;
  leaseYears: number | null; // e.g. 99, 999, or null for freehold
  leaseStartYear: number | null;
  floorRange: string | null;
  areaSqm: number;
  areaSqft: number;
  price: number; // transacted price
  nettPrice: number | null;
  psf: number; // price per sqft (uses nett price if present)
  psm: number; // price per sqm
  contractDate: string; // "MMYY"
  date: string; // ISO "YYYY-MM-01"
  year: number;
  quarter: string; // "2024-Q1"
  month: string; // "2024-03"
}

export interface Rental {
  id: string;
  project: string;
  street: string;
  district: string;
  propertyType: string;
  bedrooms: number | null;
  areaSqftMid: number | null;
  rent: number; // monthly gross
  leaseDate: string;
  date: string;
  year: number;
  quarter: string;
}

export interface Dataset {
  txns: Txn[];
  rentals: Rental[];
  source: "URA" | "SAMPLE";
  fetchedAt: string; // ISO
  transactionMonths: { min: string; max: string } | null;
  rentalQuarters: string[];
}

// Filter object shared by API routes ------------------------------------------
export interface TxnFilter {
  district?: string;
  project?: string;
  propertyType?: string;
  saleType?: string;
  marketSegment?: string;
  tenureType?: string;
  minArea?: number;
  maxArea?: number;
  minPrice?: number;
  maxPrice?: number;
  from?: string; // "YYYY-MM"
  to?: string; // "YYYY-MM"
  leaseFrom?: number; // lease start year (built-era proxy, leasehold only)
  leaseTo?: number;
}
