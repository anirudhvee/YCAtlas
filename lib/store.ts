import { create } from "zustand";
import type { Company } from "./types";

export const VIEW_IDS = [
  "overview",
  "globe",
  "timeline",
  "compare",
  "wall",
  "heatmap",
  "boards",
  "buzzwords",
] as const;

export type ViewId = (typeof VIEW_IDS)[number];

// Kept in this non-"use client" module so the [view] route's
// `generateStaticParams` can import it at build time.
export const NON_OVERVIEW_VIEWS: readonly Exclude<ViewId, "overview">[] = [
  "globe",
  "timeline",
  "compare",
  "wall",
  "heatmap",
  "boards",
  "buzzwords",
];

export const TIMELINE_METRICS = [
  "status",
  "stage",
  "top_company",
  "industry",
  "region",
  "intl",
  "team_size",
  "country_diversity",
] as const;

export type TimelineMetric = (typeof TIMELINE_METRICS)[number];

export interface FilterState {
  status: string[];
  batches: string[];
  industries: string[];
  tags: string[];
  regions: string[];
  stage: string[];
  top_company: boolean | null;
  hasFormerNames: boolean | null;
  isHiring: boolean | null;
  teamSizeMin: number | null;
  teamSizeMax: number | null;
  search: string | null;
}

export const defaultFilters: FilterState = {
  status: [],
  batches: [],
  industries: [],
  tags: [],
  regions: [],
  stage: [],
  top_company: null,
  hasFormerNames: null,
  isHiring: null,
  teamSizeMin: null,
  teamSizeMax: null,
  search: null,
};

export type ArrayFilterKey =
  | "status"
  | "batches"
  | "industries"
  | "tags"
  | "regions"
  | "stage";

interface UiStore {
  selectedCompany: Company | null;
  askOpen: boolean;
  timelineMetric: TimelineMetric;
  setTimelineMetric: (m: TimelineMetric) => void;
  setSelectedCompany: (c: Company | null) => void;
  setAskOpen: (open: boolean) => void;
  toggleAsk: () => void;
}

export const useUi = create<UiStore>((set) => ({
  selectedCompany: null,
  askOpen: false,
  timelineMetric: "status",
  setTimelineMetric: (m) => set({ timelineMetric: m }),
  setAskOpen: (open) => set({ askOpen: open }),
  toggleAsk: () => set((state) => ({ askOpen: !state.askOpen })),
  setSelectedCompany: (c) => set({ selectedCompany: c }),
}));

export function isFilteringActive(filters: FilterState): boolean {
  return (
    filters.status.length > 0 ||
    filters.batches.length > 0 ||
    filters.industries.length > 0 ||
    filters.tags.length > 0 ||
    filters.regions.length > 0 ||
    filters.stage.length > 0 ||
    filters.top_company !== null ||
    filters.hasFormerNames !== null ||
    filters.isHiring !== null ||
    filters.teamSizeMin !== null ||
    filters.teamSizeMax !== null ||
    filters.search !== null
  );
}

export function filterCompanies(
  companies: Company[],
  filters: FilterState,
): Company[] {
  if (!isFilteringActive(filters)) return companies;
  const search = filters.search?.toLowerCase() ?? null;
  return companies.filter((c) => {
    if (filters.status.length && !filters.status.includes(c.status)) return false;
    if (filters.batches.length && !filters.batches.includes(c.batch)) return false;
    if (filters.industries.length && !filters.industries.includes(c.industry))
      return false;
    if (filters.stage.length && !filters.stage.includes(c.stage)) return false;
    if (filters.tags.length && !filters.tags.some((t) => c.tags.includes(t)))
      return false;
    if (
      filters.regions.length &&
      !filters.regions.some((r) => c.regions.includes(r))
    )
      return false;
    if (filters.top_company !== null) {
      const flag = c.top_company ?? false;
      if (flag !== filters.top_company) return false;
    }
    if (filters.hasFormerNames !== null) {
      const has = c.former_names.length > 0;
      if (has !== filters.hasFormerNames) return false;
    }
    if (filters.isHiring !== null) {
      if ((c.isHiring ?? false) !== filters.isHiring) return false;
    }
    if (filters.teamSizeMin !== null) {
      if ((c.team_size ?? 0) < filters.teamSizeMin) return false;
    }
    if (filters.teamSizeMax !== null) {
      if ((c.team_size ?? Number.POSITIVE_INFINITY) > filters.teamSizeMax)
        return false;
    }
    if (search) {
      const haystack = `${c.name} ${c.one_liner} ${c.long_description ?? ""}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}
