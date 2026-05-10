import { COMPOSITION_TAG_GROUPS, primaryRegion } from "./overview-data";
import type { Company, CompanyStatus } from "./types";
import { batchToShort } from "./utils";

// Tunable thresholds for compare-flavoured analyses. Centralised here
// so the rationale lives in one place — every consumer (the Compare
// view, the Buzzwords noise filter) imports from this block.
export const THRESHOLDS = {
  // Maturity advisory shows when cohorts span this many years AND
  // any cohort is younger than YOUNG_COHORT_YEARS. Outcome metrics
  // settle around year 5, so a 3-year span with a fresh batch is
  // already apples-to-oranges.
  COMPARE_AGE_SPAN_YEARS: 3,
  YOUNG_COHORT_YEARS: 2,

  // Median team size is meaningful only when enough of the batch
  // has reported headcount. Both checks must pass: a small absolute
  // sample (Sxx) AND a small share of the cohort (Wxx) are noise.
  MEDIAN_TEAM_MIN_SAMPLE: 5,
  MEDIAN_TEAM_MIN_COVERAGE: 0.3,

  // Buzzwords "passed 5%" subtitle: a phrase only "took off" when
  // the crossing batch is large enough to mean something AND has at
  // least a few real matches (single-mention noise on tiny early
  // batches looked like trends).
  BUZZ_MIN_BATCH_SIZE: 30,
  BUZZ_MIN_MATCHES: 3,
} as const;

// Country → continent bucket. Unmapped countries fall into "Other".
const CONTINENT: Record<string, string> = {
  "United States of America": "USA",
  USA: "USA",
  "United States": "USA",
  Canada: "USA & Canada",
  Mexico: "Latin America",
  Brazil: "Latin America",
  Argentina: "Latin America",
  Chile: "Latin America",
  Colombia: "Latin America",
  Peru: "Latin America",
  Ecuador: "Latin America",
  Venezuela: "Latin America",
  Uruguay: "Latin America",
  Bolivia: "Latin America",
  "Costa Rica": "Latin America",
  Panama: "Latin America",
  Guatemala: "Latin America",
  "Dominican Republic": "Latin America",
  "United Kingdom": "Europe",
  UK: "Europe",
  Ireland: "Europe",
  Germany: "Europe",
  France: "Europe",
  Spain: "Europe",
  Italy: "Europe",
  Netherlands: "Europe",
  Belgium: "Europe",
  Switzerland: "Europe",
  Austria: "Europe",
  Portugal: "Europe",
  Sweden: "Europe",
  Norway: "Europe",
  Denmark: "Europe",
  Finland: "Europe",
  Poland: "Europe",
  "Czech Republic": "Europe",
  Czechia: "Europe",
  Hungary: "Europe",
  Romania: "Europe",
  Greece: "Europe",
  Estonia: "Europe",
  Latvia: "Europe",
  Lithuania: "Europe",
  Ukraine: "Europe",
  India: "Asia",
  Pakistan: "Asia",
  Bangladesh: "Asia",
  "Sri Lanka": "Asia",
  China: "Asia",
  "Hong Kong": "Asia",
  Taiwan: "Asia",
  Japan: "Asia",
  "South Korea": "Asia",
  Singapore: "Asia",
  Malaysia: "Asia",
  Indonesia: "Asia",
  Thailand: "Asia",
  Vietnam: "Asia",
  Philippines: "Asia",
  Israel: "Middle East",
  "United Arab Emirates": "Middle East",
  "Saudi Arabia": "Middle East",
  Turkey: "Middle East",
  Egypt: "Africa",
  Nigeria: "Africa",
  Kenya: "Africa",
  "South Africa": "Africa",
  Ghana: "Africa",
  Morocco: "Africa",
  Australia: "Oceania",
  "New Zealand": "Oceania",
};

export const REGION_BUCKETS = [
  "USA",
  "USA & Canada",
  "Europe",
  "Asia",
  "Latin America",
  "Middle East",
  "Africa",
  "Oceania",
  "Other",
] as const;
export type RegionBucket = (typeof REGION_BUCKETS)[number];

export const STAGE_BUCKETS = ["Seed", "Early", "Growth", "Public"] as const;
export type StageBucket = (typeof STAGE_BUCKETS)[number];

const AI_RE = /\b(ai|agents?)\b/i;

function bucketRegion(country: string | null): RegionBucket {
  if (!country) return "Other";
  return (CONTINENT[country] as RegionBucket) ?? "Other";
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export interface CohortMetrics {
  batch: string;
  short: string;
  ageYears: number;
  ageLabel: string;
  total: number;
  pctActive: number;
  pctTopCompany: number;
  medianTeamSize: number;
  // Number of companies whose team_size was non-null and > 0. When
  // this is small (young batches barely report headcount) the median
  // becomes noise and should not be compared cohort-to-cohort.
  medianTeamSampleSize: number;
  pctExited: number;
  aiShare: number;
  byStatus: Record<CompanyStatus, number>;
  outcomeMix: Record<CompanyStatus, number>;
  themeMix: Record<string, number>;
  regionMix: Record<RegionBucket, number>;
  industryMix: Record<string, number>;
  stageMix: Record<StageBucket | "Other", number>;
  topIndustries: string[];
}

const EMPTY_OUTCOME = (): Record<CompanyStatus, number> => ({
  Active: 0,
  Acquired: 0,
  Inactive: 0,
  Public: 0,
});

const EMPTY_REGION = (): Record<RegionBucket, number> =>
  Object.fromEntries(REGION_BUCKETS.map((r) => [r, 0])) as Record<
    RegionBucket,
    number
  >;

const EMPTY_THEME = (): Record<string, number> =>
  Object.fromEntries(COMPOSITION_TAG_GROUPS.map((g) => [g.label, 0]));

const EMPTY_STAGE = (): Record<StageBucket | "Other", number> => ({
  Seed: 0,
  Early: 0,
  Growth: 0,
  Public: 0,
  Other: 0,
});

function themeMatch(c: Company, label: string): boolean {
  const group = COMPOSITION_TAG_GROUPS.find((g) => g.label === label);
  if (!group) return false;
  for (const m of group.match) if (c.tags.includes(m)) return true;
  return false;
}

function aiMatch(c: Company): boolean {
  if (themeMatch(c, "AI")) return true;
  const text = `${c.name} ${c.one_liner} ${c.long_description ?? ""}`;
  return AI_RE.test(text);
}

// Latest batch year in the dataset — used as "now" for age math so
// rendering stays cache-components-safe (no `new Date()` reads). Pass
// the result into cohortMetrics so a single dataset scan covers every
// cohort instead of one scan per call.
export function referenceYear(companies: Company[]): number {
  let max = 0;
  for (const c of companies) {
    if (c.batch === "Unspecified") continue;
    const y = Number(c.batch.split(" ")[1]);
    if (Number.isFinite(y) && y > max) max = y;
  }
  return max || new Date().getFullYear();
}

function ageOf(batch: string, refYear: number): { years: number; label: string } {
  const y = Number(batch.split(" ")[1]);
  if (!Number.isFinite(y)) return { years: 0, label: "—" };
  const years = Math.max(0, refYear - y);
  if (years === 0) return { years: 0, label: "just started" };
  if (years === 1) return { years, label: "1 yr old" };
  return { years, label: `${years} yrs old` };
}

export function cohortMetrics(
  companies: Company[],
  batch: string,
  refYear: number,
): CohortMetrics | null {
  const cohort = companies.filter((c) => c.batch === batch);
  if (cohort.length === 0) return null;

  const age = ageOf(batch, refYear);

  const byStatus = EMPTY_OUTCOME();
  const themeCounts = EMPTY_THEME();
  const regionCounts = EMPTY_REGION();
  const stageCounts = EMPTY_STAGE();
  const industryCounts = new Map<string, number>();
  const teamSizes: number[] = [];
  let topCount = 0;
  let aiCount = 0;

  for (const c of cohort) {
    byStatus[c.status]++;
    if (c.top_company === true) topCount++;
    if (typeof c.team_size === "number" && c.team_size > 0) {
      teamSizes.push(c.team_size);
    }
    if (aiMatch(c)) aiCount++;
    for (const g of COMPOSITION_TAG_GROUPS) {
      if (themeMatch(c, g.label)) themeCounts[g.label]++;
    }
    regionCounts[bucketRegion(primaryRegion(c))]++;
    if ((STAGE_BUCKETS as readonly string[]).includes(c.stage)) {
      stageCounts[c.stage as StageBucket]++;
    } else if (c.stage) {
      stageCounts.Other++;
    }
    const ind = c.industry || "Unknown";
    industryCounts.set(ind, (industryCounts.get(ind) ?? 0) + 1);
  }

  const total = cohort.length;
  const pct = (n: number) => (total === 0 ? 0 : (n / total) * 100);

  const outcomeMix = {
    Active: pct(byStatus.Active),
    Acquired: pct(byStatus.Acquired),
    Public: pct(byStatus.Public),
    Inactive: pct(byStatus.Inactive),
  };
  const themeMix: Record<string, number> = {};
  for (const k of Object.keys(themeCounts)) themeMix[k] = pct(themeCounts[k]);
  const regionMix = Object.fromEntries(
    REGION_BUCKETS.map((r) => [r, pct(regionCounts[r])]),
  ) as Record<RegionBucket, number>;
  const stageMix = {
    Seed: pct(stageCounts.Seed),
    Early: pct(stageCounts.Early),
    Growth: pct(stageCounts.Growth),
    Public: pct(stageCounts.Public),
    Other: pct(stageCounts.Other),
  };
  const industryMix: Record<string, number> = {};
  for (const [k, v] of industryCounts) industryMix[k] = pct(v);
  const topIndustries = [...industryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k]) => k);

  return {
    batch,
    short: batchToShort(batch),
    ageYears: age.years,
    ageLabel: age.label,
    total,
    pctActive: pct(byStatus.Active),
    pctTopCompany: pct(topCount),
    medianTeamSize: median(teamSizes),
    medianTeamSampleSize: teamSizes.length,
    pctExited: pct(byStatus.Acquired + byStatus.Public),
    aiShare: pct(aiCount),
    byStatus,
    outcomeMix,
    themeMix,
    regionMix,
    industryMix,
    stageMix,
    topIndustries,
  };
}

export function unionTopIndustries(
  cohorts: CohortMetrics[],
  perCohort = 5,
): string[] {
  const out: string[] = [];
  for (const c of cohorts) {
    for (const ind of c.topIndustries.slice(0, perCohort)) {
      if (!out.includes(ind)) out.push(ind);
    }
  }
  return out;
}
