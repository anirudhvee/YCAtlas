import type { Company, CompanyStatus } from "./types";
import { batchToShort, batchToSortKey } from "./utils";

export const STATUS_KEYS: CompanyStatus[] = [
  "Active",
  "Inactive",
  "Acquired",
  "Public",
];

// Threshold below which a batch is treated as partial/future/deferral
// noise. Applied across cohort strip, growth, and composition.
export const MIN_BATCH_SIZE = 5;

export const STATUS_COLORS: Record<CompanyStatus, string> = {
  Active: "#0891b2",
  Inactive: "#64748b",
  Acquired: "#10b981",
  Public: "#a855f7",
};

export interface BatchAggregate {
  batch: string;
  short: string;
  total: number;
  byStatus: Record<CompanyStatus, number>;
  topCount: number;
  pctActive: number;
  pctTopCompany: number;
}

function emptyByStatus(): Record<CompanyStatus, number> {
  return { Active: 0, Inactive: 0, Acquired: 0, Public: 0 };
}

export function aggregateByBatch(companies: Company[]): BatchAggregate[] {
  const map = new Map<string, BatchAggregate>();
  for (const c of companies) {
    let agg = map.get(c.batch);
    if (!agg) {
      agg = {
        batch: c.batch,
        short: batchToShort(c.batch),
        total: 0,
        byStatus: emptyByStatus(),
        topCount: 0,
        pctActive: 0,
        pctTopCompany: 0,
      };
      map.set(c.batch, agg);
    }
    agg.total++;
    agg.byStatus[c.status] = (agg.byStatus[c.status] ?? 0) + 1;
    if (c.top_company === true) agg.topCount++;
  }
  const arr = [...map.values()];
  for (const a of arr) {
    a.pctActive = a.total ? (a.byStatus.Active / a.total) * 100 : 0;
    a.pctTopCompany = a.total ? (a.topCount / a.total) * 100 : 0;
  }
  arr.sort((x, y) => batchToSortKey(x.batch) - batchToSortKey(y.batch));
  return arr;
}

export function aggregatesExcludingUnspecified(
  aggregates: BatchAggregate[],
): BatchAggregate[] {
  return aggregates.filter((a) => a.batch !== "Unspecified");
}

export function aggregatesAboveMinSize(
  aggregates: BatchAggregate[],
  minSize = MIN_BATCH_SIZE,
): BatchAggregate[] {
  return aggregates.filter((a) => a.total >= minSize);
}

export function findLatestBatch(
  companies: Company[],
  minSize = 20,
): string | null {
  const counts = new Map<string, number>();
  for (const c of companies) {
    if (c.batch === "Unspecified") continue;
    counts.set(c.batch, (counts.get(c.batch) ?? 0) + 1);
  }
  let best: { key: number; batch: string } | null = null;
  for (const [batch, count] of counts) {
    if (count < minSize) continue;
    const key = batchToSortKey(batch);
    if (!Number.isFinite(key)) continue;
    if (!best || key > best.key) best = { key, batch };
  }
  return best?.batch ?? null;
}

// `top_company` is awarded post-hoc, so recent batches are 0% by
// default. Anything ranking by this field needs a maturity gate.
export const MATURITY_YEARS = 5;

export function isMatureBatch(batch: string, now: Date = new Date()): boolean {
  if (batch === "Unspecified") return false;
  const yearStr = batch.split(" ")[1];
  if (!yearStr || !/^\d{4}$/.test(yearStr)) return false;
  return Number(yearStr) <= now.getFullYear() - MATURITY_YEARS;
}

export function topBatchesByPctTopCompany(
  companies: Company[],
  n: number,
  minBatchSize = MIN_BATCH_SIZE,
): BatchAggregate[] {
  return aggregatesExcludingUnspecified(aggregateByBatch(companies))
    .filter((a) => a.total >= minBatchSize && isMatureBatch(a.batch))
    .sort((x, y) => y.pctTopCompany - x.pctTopCompany)
    .slice(0, n);
}

// Non-geographic tags that yc-oss ships in `regions`. Skipping them so
// "Top regions" reads as actual countries, not work-mode flags or
// continent rollups.
const META_REGIONS = new Set([
  "Remote",
  "Fully Remote",
  "Partly Remote",
  "Unspecified",
  "Worldwide",
  "Global",
  "America / Canada",
  "Europe",
  "Asia",
  "Africa",
  "Oceania",
  "Latin America",
  "Middle East",
]);

export function primaryRegion(c: Company): string | null {
  return c.regions.find((r) => !META_REGIONS.has(r)) ?? null;
}

export function topRegion(
  companies: Company[],
): { name: string; count: number } | null {
  const map = new Map<string, number>();
  for (const c of companies) {
    const r = primaryRegion(c);
    if (!r) continue;
    map.set(r, (map.get(r) ?? 0) + 1);
  }
  let best: { name: string; count: number } | null = null;
  for (const [name, count] of map) {
    if (!best || count > best.count) best = { name, count };
  }
  return best;
}

const NON_CITY_TOKENS = new Set([
  "",
  "Remote",
  "Partly Remote",
  "Worldwide",
  "Global",
]);

export function extractCity(allLocations: string): string | null {
  if (!allLocations) return null;
  const first = allLocations.split(",")[0]?.trim();
  if (!first) return null;
  if (NON_CITY_TOKENS.has(first)) return null;
  return first;
}

export function topCity(
  companies: Company[],
): { name: string; count: number } | null {
  const map = new Map<string, number>();
  for (const c of companies) {
    const city = extractCity(c.all_locations);
    if (!city) continue;
    map.set(city, (map.get(city) ?? 0) + 1);
  }
  let best: { name: string; count: number } | null = null;
  for (const [name, count] of map) {
    if (!best || count > best.count) best = { name, count };
  }
  return best;
}

export function regionAggregates(
  companies: Company[],
): Array<{ name: string; count: number; dominantStatus: CompanyStatus }> {
  const buckets = new Map<
    string,
    { count: number; byStatus: Record<CompanyStatus, number> }
  >();
  for (const c of companies) {
    const r = primaryRegion(c);
    if (!r) continue;
    let b = buckets.get(r);
    if (!b) {
      b = { count: 0, byStatus: emptyByStatus() };
      buckets.set(r, b);
    }
    b.count++;
    b.byStatus[c.status]++;
  }
  return [...buckets.entries()].map(([name, b]) => {
    let dominant: CompanyStatus = "Active";
    let max = -1;
    for (const k of STATUS_KEYS) {
      if (b.byStatus[k] > max) {
        max = b.byStatus[k];
        dominant = k;
      }
    }
    return { name, count: b.count, dominantStatus: dominant };
  });
}

export interface TagGroup {
  label: string;
  match: string[];
}

export const COMPOSITION_TAG_GROUPS: TagGroup[] = [
  // AI is broad on purpose: YC fragments AI tagging across many sub-tags;
  // collapsing them avoids missing batches tagged only "Generative AI".
  {
    label: "AI",
    match: [
      "AI",
      "Artificial Intelligence",
      "Machine Learning",
      "Generative AI",
      "AIOps",
      "ML",
    ],
  },
  { label: "SaaS", match: ["SaaS"] },
  { label: "Fintech", match: ["Fintech"] },
  { label: "Crypto / Web3", match: ["Crypto", "Web3", "Blockchain"] },
  { label: "Marketplace", match: ["Marketplace"] },
  { label: "Climate", match: ["Climate", "Climate Tech"] },
  { label: "Developer Tools", match: ["Developer Tools", "DevTools"] },
];

export const COMPOSITION_COLORS: Record<string, string> = {
  AI: "#8a8df0",
  SaaS: "#33b1ff",
  Fintech: "#5cc8a8",
  "Crypto / Web3": "#d4a93c",
  Marketplace: "#e87aa8",
  Climate: "#9bd16a",
  "Developer Tools": "#b483e8",
};

function companyMatchesTagGroup(c: Company, group: TagGroup): boolean {
  for (const m of group.match) {
    if (c.tags.includes(m)) return true;
  }
  return false;
}

export interface CompositionRow {
  short: string;
  batch: string;
  total: number;
  [tagLabel: string]: string | number;
}

export function compositionSeries(
  companies: Company[],
  minSize = MIN_BATCH_SIZE,
): CompositionRow[] {
  const buckets = new Map<
    string,
    { total: number; tagged: number; counts: Record<string, number> }
  >();
  for (const c of companies) {
    if (c.batch === "Unspecified") continue;
    let b = buckets.get(c.batch);
    if (!b) {
      const counts: Record<string, number> = {};
      for (const g of COMPOSITION_TAG_GROUPS) counts[g.label] = 0;
      b = { total: 0, tagged: 0, counts };
      buckets.set(c.batch, b);
    }
    b.total++;
    if (c.tags.length > 0) b.tagged++;
    for (const g of COMPOSITION_TAG_GROUPS) {
      if (companyMatchesTagGroup(c, g)) b.counts[g.label]++;
    }
  }
  const rows: CompositionRow[] = [];
  for (const [batch, { total, tagged, counts }] of buckets) {
    if (total < minSize) continue;
    // Skip batches YC hasn't tagged yet; otherwise every series collapses
    // to near-zero and the chart shows a misleading cliff at the right.
    if (tagged / total < 0.5) continue;
    const row: CompositionRow = {
      short: batchToShort(batch),
      batch,
      total,
    };
    for (const g of COMPOSITION_TAG_GROUPS) {
      row[g.label] = total ? (counts[g.label] / total) * 100 : 0;
    }
    rows.push(row);
  }
  rows.sort(
    (x, y) =>
      batchToSortKey(x.batch as string) - batchToSortKey(y.batch as string),
  );
  return rows;
}

const DIALECT_STOPWORDS = new Set([
  "the","and","for","with","that","this","you","your","our","their","they",
  "are","was","were","has","have","had","not","but","from","into","over",
  "any","all","can","its","one","two","also","than","then","there","here",
  "company","companies","platform","service","services","based","help",
  "helps","using","used","make","makes","making","more","most","new",
  "people","every","just","like","work","works","working","time","times",
  "year","years","day","days","first","other","each","when","where","what",
  "how","who","while","because","without","through","about","across","via",
  "users","user","build","built","building","need","needs","want","wants",
]);

function dialectTokens(text: string): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const out: string[] = [];
  const re = /[a-z][a-z0-9-]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(lower))) {
    const w = m[0];
    if (w.length < 3) continue;
    if (DIALECT_STOPWORDS.has(w)) continue;
    out.push(w);
  }
  return out;
}

export interface DialectWord {
  word: string;
  latestCount: number;
  latestPct: number;
  priorPct: number;
  ratio: number;
}

export interface DialectResult {
  batch: string | null;
  total: number;
  words: DialectWord[];
}

// Words disproportionately common in the latest batch's pitches vs
// all prior. Min support: 4% of cohort or 8 companies.
export function latestCohortDialect(
  companies: Company[],
  n: number = 6,
  minBatchSize: number = 20,
): DialectResult {
  const counts = new Map<string, number>();
  for (const c of companies) {
    if (c.batch === "Unspecified") continue;
    counts.set(c.batch, (counts.get(c.batch) ?? 0) + 1);
  }
  const eligible = [...counts.entries()]
    .filter(([, total]) => total >= minBatchSize)
    .sort((a, b) => batchToSortKey(b[0]) - batchToSortKey(a[0]));
  if (eligible.length === 0) return { batch: null, total: 0, words: [] };

  const latestBatch = eligible[0][0];
  const priorBatches = new Set(eligible.slice(1).map(([b]) => b));

  const latestSet: Company[] = [];
  const priorSet: Company[] = [];
  for (const c of companies) {
    if (c.batch === latestBatch) latestSet.push(c);
    else if (priorBatches.has(c.batch)) priorSet.push(c);
  }

  const docFreq = (set: Company[]): Map<string, number> => {
    const out = new Map<string, number>();
    for (const c of set) {
      const seen = new Set<string>();
      const text = `${c.one_liner ?? ""} ${c.long_description ?? ""}`;
      for (const w of dialectTokens(text)) seen.add(w);
      for (const w of seen) out.set(w, (out.get(w) ?? 0) + 1);
    }
    return out;
  };

  const dL = docFreq(latestSet);
  const dP = docFreq(priorSet);
  const nL = latestSet.length;
  const nP = priorSet.length;
  const minSupport = Math.max(8, Math.floor(nL * 0.04));

  const scored: DialectWord[] = [];
  for (const [word, cl] of dL) {
    if (cl < minSupport) continue;
    const priorCount = dP.get(word) ?? 0;
    const latestPct = (cl / nL) * 100;
    // +1/+1 smoothing avoids infinite ratios for zero-prior words.
    const smoothPriorPct = (priorCount + 1) / (nP + 1);
    const ratio = cl / nL / smoothPriorPct;
    const rawPriorPct = nP > 0 ? (priorCount / nP) * 100 : 0;
    scored.push({ word, latestCount: cl, latestPct, priorPct: rawPriorPct, ratio });
  }
  scored.sort((a, b) => b.ratio - a.ratio);
  return { batch: latestBatch, total: nL, words: scored.slice(0, n) };
}

const AI_RE = /\b(ai|agents?)\b/i;

export interface AiShareRow {
  short: string;
  batch: string;
  pct: number;
  total: number;
  matches: number;
}

export function aiShareSeries(
  companies: Company[],
  minSize = MIN_BATCH_SIZE,
): AiShareRow[] {
  const buckets = new Map<string, { total: number; matches: number }>();
  for (const c of companies) {
    if (c.batch === "Unspecified") continue;
    const haystack = `${c.name} ${c.one_liner} ${c.long_description ?? ""}`;
    let b = buckets.get(c.batch);
    if (!b) {
      b = { total: 0, matches: 0 };
      buckets.set(c.batch, b);
    }
    b.total++;
    if (AI_RE.test(haystack)) b.matches++;
  }
  return [...buckets.entries()]
    .filter(([, { total }]) => total >= minSize)
    .sort((a, b) => batchToSortKey(a[0]) - batchToSortKey(b[0]))
    .map(([batch, { total, matches }]) => ({
      batch,
      short: batchToShort(batch),
      total,
      matches,
      pct: total ? (matches / total) * 100 : 0,
    }));
}

export function findAiInflection(rows: AiShareRow[]): AiShareRow | null {
  if (rows.length < 2) return null;
  let best: { row: AiShareRow; delta: number } | null = null;
  for (let i = 1; i < rows.length; i++) {
    const delta = rows[i].pct - rows[i - 1].pct;
    if (!best || delta > best.delta) best = { row: rows[i], delta };
  }
  return best?.row ?? null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function phraseSeries(
  companies: Company[],
  phrase: string,
  minSize = MIN_BATCH_SIZE,
): Array<{ short: string; pct: number; batch: string }> {
  const re = new RegExp(`\\b${escapeRegex(phrase.toLowerCase())}\\b`);
  const buckets = new Map<string, { total: number; matches: number }>();
  for (const c of companies) {
    if (c.batch === "Unspecified") continue;
    const haystack =
      `${c.name} ${c.one_liner} ${c.long_description ?? ""}`.toLowerCase();
    const matched = re.test(haystack);
    let b = buckets.get(c.batch);
    if (!b) {
      b = { total: 0, matches: 0 };
      buckets.set(c.batch, b);
    }
    b.total++;
    if (matched) b.matches++;
  }
  return [...buckets.entries()]
    .filter(([, { total }]) => total >= minSize)
    .sort((a, b) => batchToSortKey(a[0]) - batchToSortKey(b[0]))
    .map(([batch, { total, matches }]) => ({
      batch,
      short: batchToShort(batch),
      pct: total ? (matches / total) * 100 : 0,
    }));
}

// [lat, lng] tuples covering ~95% of YC companies, with spelling aliases.
export const CITY_COORDS: Record<string, [number, number]> = {
  // United States, Bay Area
  "San Francisco": [37.77, -122.42],
  "Mountain View": [37.39, -122.08],
  "Palo Alto": [37.44, -122.14],
  Berkeley: [37.87, -122.27],
  Oakland: [37.8, -122.27],
  "Menlo Park": [37.45, -122.18],
  "San Mateo": [37.56, -122.32],
  "Redwood City": [37.49, -122.24],
  Sunnyvale: [37.37, -122.04],
  "San Jose": [37.34, -121.89],
  Burlingame: [37.58, -122.36],
  "South San Francisco": [37.65, -122.41],
  // United States, other
  "New York": [40.71, -74.0],
  "New York City": [40.71, -74.0],
  Brooklyn: [40.68, -73.94],
  Manhattan: [40.78, -73.97],
  "Los Angeles": [34.05, -118.24],
  "Santa Monica": [34.02, -118.49],
  Pasadena: [34.15, -118.14],
  "San Diego": [32.72, -117.16],
  Seattle: [47.61, -122.33],
  Boston: [42.36, -71.06],
  Cambridge: [42.37, -71.11],
  Somerville: [42.39, -71.1],
  Austin: [30.27, -97.74],
  Chicago: [41.88, -87.63],
  Denver: [39.74, -104.99],
  Boulder: [40.01, -105.27],
  Portland: [45.51, -122.68],
  Miami: [25.76, -80.19],
  Houston: [29.76, -95.37],
  Atlanta: [33.75, -84.39],
  Minneapolis: [44.98, -93.27],
  Washington: [38.91, -77.04],
  "Salt Lake City": [40.76, -111.89],
  Detroit: [42.33, -83.05],
  Philadelphia: [39.95, -75.16],
  Nashville: [36.16, -86.78],
  Phoenix: [33.45, -112.07],
  Dallas: [32.78, -96.8],
  // Canada
  Toronto: [43.65, -79.38],
  Vancouver: [49.28, -123.12],
  Montreal: [45.5, -73.57],
  Waterloo: [43.46, -80.52],
  Ottawa: [45.42, -75.7],
  Calgary: [51.05, -114.07],
  // Mexico / LatAm
  "Mexico City": [19.43, -99.13],
  "São Paulo": [-23.55, -46.63],
  "Sao Paulo": [-23.55, -46.63],
  "Rio de Janeiro": [-22.91, -43.17],
  "Buenos Aires": [-34.61, -58.4],
  Santiago: [-33.45, -70.67],
  "Bogotá": [4.71, -74.07],
  Bogota: [4.71, -74.07],
  Lima: [-12.05, -77.04],
  "Medellín": [6.25, -75.57],
  Medellin: [6.25, -75.57],
  // Europe
  London: [51.51, -0.13],
  Manchester: [53.48, -2.24],
  Edinburgh: [55.95, -3.19],
  Dublin: [53.35, -6.26],
  Paris: [48.85, 2.35],
  Lyon: [45.76, 4.84],
  Berlin: [52.52, 13.41],
  Munich: [48.14, 11.58],
  Hamburg: [53.55, 10.0],
  Amsterdam: [52.37, 4.9],
  Madrid: [40.42, -3.7],
  Barcelona: [41.39, 2.16],
  Stockholm: [59.33, 18.07],
  Copenhagen: [55.68, 12.57],
  Helsinki: [60.17, 24.94],
  Oslo: [59.91, 10.75],
  Warsaw: [52.23, 21.01],
  Vienna: [48.21, 16.37],
  Lisbon: [38.72, -9.13],
  Tallinn: [59.44, 24.75],
  Zurich: [47.38, 8.54],
  Milan: [45.46, 9.19],
  Rome: [41.9, 12.5],
  // Middle East
  "Tel Aviv": [32.08, 34.78],
  Dubai: [25.2, 55.27],
  Riyadh: [24.71, 46.68],
  Istanbul: [41.01, 28.98],
  // Africa
  Lagos: [6.52, 3.38],
  Nairobi: [-1.29, 36.82],
  Cairo: [30.04, 31.24],
  "Cape Town": [-33.92, 18.42],
  Johannesburg: [-26.2, 28.05],
  Accra: [5.6, -0.19],
  // South Asia
  Bangalore: [12.97, 77.59],
  Bengaluru: [12.97, 77.59],
  Mumbai: [19.08, 72.88],
  Delhi: [28.61, 77.21],
  "New Delhi": [28.61, 77.21],
  Hyderabad: [17.39, 78.49],
  Pune: [18.52, 73.86],
  Chennai: [13.08, 80.27],
  Gurgaon: [28.46, 77.03],
  Gurugram: [28.46, 77.03],
  Noida: [28.58, 77.32],
  Ahmedabad: [23.03, 72.59],
  Kolkata: [22.57, 88.36],
  Karachi: [24.86, 67.01],
  Lahore: [31.55, 74.34],
  Islamabad: [33.69, 73.05],
  Dhaka: [23.81, 90.41],
  // East Asia
  Singapore: [1.35, 103.82],
  "Hong Kong": [22.32, 114.17],
  Tokyo: [35.68, 139.65],
  Beijing: [39.9, 116.4],
  Shanghai: [31.23, 121.47],
  Shenzhen: [22.54, 114.06],
  Seoul: [37.57, 126.98],
  Taipei: [25.03, 121.57],
  Bangkok: [13.76, 100.5],
  Jakarta: [-6.21, 106.85],
  Manila: [14.6, 120.98],
  "Ho Chi Minh City": [10.78, 106.7],
  Hanoi: [21.03, 105.85],
  // Oceania
  Sydney: [-33.87, 151.21],
  Melbourne: [-37.81, 144.96],
  Brisbane: [-27.47, 153.03],
  Auckland: [-36.85, 174.76],
  Wellington: [-41.29, 174.78],
};

export interface CityAggregate {
  name: string;
  count: number;
  dominantStatus: CompanyStatus;
}

export function cityAggregates(companies: Company[]): CityAggregate[] {
  const buckets = new Map<
    string,
    { count: number; byStatus: Record<CompanyStatus, number> }
  >();
  for (const c of companies) {
    const city = extractCity(c.all_locations);
    if (!city) continue;
    let b = buckets.get(city);
    if (!b) {
      b = { count: 0, byStatus: emptyByStatus() };
      buckets.set(city, b);
    }
    b.count++;
    b.byStatus[c.status]++;
  }
  return [...buckets.entries()].map(([name, b]) => {
    let dominant: CompanyStatus = "Active";
    let max = -1;
    for (const k of STATUS_KEYS) {
      if (b.byStatus[k] > max) {
        max = b.byStatus[k];
        dominant = k;
      }
    }
    return { name, count: b.count, dominantStatus: dominant };
  });
}

export const REGION_COORDS: Record<string, [number, number]> = {
  "United States of America": [39, -98],
  Canada: [60, -100],
  Mexico: [23, -102],
  "United Kingdom": [54, -2],
  Germany: [51, 10],
  France: [46, 2],
  Spain: [40, -3],
  Italy: [42, 12],
  Netherlands: [52, 6],
  Sweden: [60, 18],
  Switzerland: [47, 8],
  Ireland: [53, -8],
  Poland: [52, 19],
  Ukraine: [49, 32],
  Russia: [60, 100],
  Israel: [31, 35],
  "United Arab Emirates": [24, 54],
  Turkey: [39, 35],
  Egypt: [27, 30],
  Nigeria: [10, 8],
  Kenya: [0, 37],
  "South Africa": [-30, 25],
  India: [22, 79],
  Pakistan: [30, 70],
  Bangladesh: [24, 90],
  China: [35, 104],
  "Hong Kong": [22, 114],
  Taiwan: [24, 121],
  Japan: [36, 138],
  "South Korea": [37, 128],
  Singapore: [1, 104],
  Indonesia: [-2, 118],
  Thailand: [15, 100],
  Vietnam: [16, 108],
  Philippines: [13, 122],
  Australia: [-25, 134],
  "New Zealand": [-41, 174],
  Brazil: [-14, -52],
  Argentina: [-38, -64],
  Chile: [-30, -71],
  Colombia: [4, -74],
};
