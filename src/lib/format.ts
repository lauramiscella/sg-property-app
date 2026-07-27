// Formatting + shared math helpers.

export const SQM_TO_SQFT = 10.76391041671;

export function sqmToSqft(sqm: number): number {
  return sqm * SQM_TO_SQFT;
}

export function fmtSGD(n: number | null | undefined, dp = 0): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    maximumFractionDigits: dp,
    minimumFractionDigits: dp,
  }).format(n);
}

export function fmtNum(n: number | null | undefined, dp = 0): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-SG", {
    maximumFractionDigits: dp,
    minimumFractionDigits: dp,
  }).format(n);
}

export function fmtPct(n: number | null | undefined, dp = 1): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toFixed(dp)}%`;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function quantile(values: number[], q: number): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return s[base + 1] !== undefined
    ? s[base] + rest * (s[base + 1] - s[base])
    : s[base];
}

// Parse URA "MMYY" contract date to a JS-friendly ISO month.
export function parseMMYY(mmyy: string): { iso: string; year: number; quarter: string; month: string } | null {
  if (!mmyy || mmyy.length !== 4) return null;
  const mm = parseInt(mmyy.slice(0, 2), 10);
  const yy = parseInt(mmyy.slice(2, 4), 10);
  if (Number.isNaN(mm) || Number.isNaN(yy) || mm < 1 || mm > 12) return null;
  const year = 2000 + yy;
  const q = Math.floor((mm - 1) / 3) + 1;
  const mmStr = String(mm).padStart(2, "0");
  return {
    iso: `${year}-${mmStr}-01`,
    year,
    quarter: `${year}-Q${q}`,
    month: `${year}-${mmStr}`,
  };
}

// Midpoint of a range string like "700 to 800" or "70-80" or a single value.
export function rangeMidpoint(raw: string | undefined): number | null {
  if (!raw) return null;
  const nums = raw.match(/\d+(?:\.\d+)?/g);
  if (!nums || !nums.length) return null;
  const vals = nums.map(Number);
  if (vals.length === 1) return vals[0];
  return (vals[0] + vals[vals.length - 1]) / 2;
}

export const DISTRICT_NAMES: Record<string, string> = {
  "01": "Raffles Place, Marina, Cecil",
  "02": "Tanjong Pagar, Anson",
  "03": "Tiong Bahru, Alexandra, Queenstown",
  "04": "Sentosa, Harbourfront, Telok Blangah",
  "05": "Buona Vista, Pasir Panjang, Clementi",
  "06": "City Hall, Clarke Quay",
  "07": "Bugis, Beach Road, Golden Mile",
  "08": "Little India, Farrer Park",
  "09": "Orchard, River Valley",
  "10": "Tanglin, Holland, Bukit Timah",
  "11": "Novena, Newton, Thomson",
  "12": "Balestier, Toa Payoh, Serangoon",
  "13": "Macpherson, Braddell, Potong Pasir",
  "14": "Geylang, Eunos, Paya Lebar",
  "15": "Katong, Joo Chiat, Marine Parade, East Coast",
  "16": "Bedok, Upper East Coast, Siglap",
  "17": "Changi, Loyang, Flora",
  "18": "Tampines, Pasir Ris",
  "19": "Serangoon Gardens, Hougang, Punggol",
  "20": "Bishan, Ang Mo Kio, Thomson",
  "21": "Upper Bukit Timah, Clementi Park",
  "22": "Jurong, Boon Lay, Tuas",
  "23": "Bukit Panjang, Choa Chu Kang, Hillview",
  "24": "Lim Chu Kang, Tengah",
  "25": "Kranji, Woodgrove, Woodlands",
  "26": "Upper Thomson, Springleaf, Mandai",
  "27": "Yishun, Sembawang",
  "28": "Seletar, Yio Chu Kang",
};

export function pad2(d: string | number): string {
  return String(d).padStart(2, "0");
}

// Short display like "D9" (URA stores "09"; Singapore convention drops the zero).
export function dShort(d: string): string {
  const n = parseInt(d, 10);
  return Number.isNaN(n) ? `D${d}` : `D${n}`;
}

export function districtLabel(d: string): string {
  const key = pad2(d);
  const name = DISTRICT_NAMES[key];
  return name ? `${dShort(d)} · ${name}` : dShort(d);
}
