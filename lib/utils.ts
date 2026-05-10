import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SEASON_TO_SHORT: Record<string, string> = {
  Winter: "W",
  Spring: "P",
  Summer: "S",
  Fall: "F",
};

const SEASON_ORDER: Record<string, number> = {
  Winter: 0,
  Spring: 1,
  Summer: 2,
  Fall: 3,
};

export function batchToShort(batch: string): string {
  if (batch === "Unspecified") return "—";
  const [season, year] = batch.split(" ");
  const code = SEASON_TO_SHORT[season];
  if (!code || !/^\d{4}$/.test(year ?? "")) return batch;
  return `${code}${year.slice(2)}`;
}

const SHORT_TO_SEASON: Record<string, string> = {
  W: "Winter",
  P: "Spring",
  S: "Summer",
  F: "Fall",
};

export function batchFromShort(short: string): string {
  const m = /^([WPSF])(\d{2})$/.exec(short);
  if (!m) return short;
  return `${SHORT_TO_SEASON[m[1]]} ${2000 + Number(m[2])}`;
}

export function batchToSortKey(batch: string): number {
  if (batch === "Unspecified") return Number.POSITIVE_INFINITY;
  const [season, year] = batch.split(" ");
  const order = SEASON_ORDER[season];
  if (order === undefined || !/^\d{4}$/.test(year ?? "")) {
    return Number.POSITIVE_INFINITY;
  }
  return Number(year) * 10 + order;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev: number[] = new Array(b.length + 1);
  const curr: number[] = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

// yc-oss `former_names` is messy: leading whitespace, casing variants,
// and the current name listed alongside genuine prior names. Trim,
// dedupe case-insensitively, and drop anything within Levenshtein 2 of
// the current name (catches "MatterPort" ↔ "Matterport").
export function cleanFormerNames(
  currentName: string,
  formerNames: string[],
): string[] {
  const target = currentName.trim().toLowerCase();
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of formerNames) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    if (levenshtein(key, target) <= 2) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}
