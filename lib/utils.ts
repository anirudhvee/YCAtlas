import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SEASON_TO_SHORT: Record<string, string> = {
  Winter: "W",
  Spring: "X",
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

export function batchToSortKey(batch: string): number {
  if (batch === "Unspecified") return Number.POSITIVE_INFINITY;
  const [season, year] = batch.split(" ");
  const order = SEASON_ORDER[season];
  if (order === undefined || !/^\d{4}$/.test(year ?? "")) {
    return Number.POSITIVE_INFINITY;
  }
  return Number(year) * 10 + order;
}
