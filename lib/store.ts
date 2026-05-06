import { useMemo } from "react";
import { create } from "zustand";
import type { Company } from "./types";
import { decodeHash } from "./url-state";

export const VIEW_IDS = [
  "overview",
  "globe",
  "timeline",
  "wall",
  "heatmap",
  "boards",
  "buzzwords",
] as const;

export type ViewId = (typeof VIEW_IDS)[number];

export interface FilterState {
  status: string[];
  batches: string[];
  industries: string[];
  tags: string[];
  regions: string[];
  stage: string[];
  top_company: boolean | null;
  hasFormerNames: boolean | null;
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
  view: ViewId;
  filters: FilterState;
  filterRevision: number;
  phrases: string[];
  setView: (view: ViewId) => void;
  setFilters: (patch: Partial<FilterState>) => void;
  toggleArrayFilter: (key: ArrayFilterKey, value: string) => void;
  clearFilters: () => void;
  addPhrase: (p: string) => void;
  removePhrase: (p: string) => void;
  hydrateFromUrl: (next: {
    view?: ViewId;
    filters?: Partial<FilterState>;
    phrases?: string[];
  }) => void;
}

function isViewId(v: string): v is ViewId {
  return (VIEW_IDS as readonly string[]).includes(v);
}

function getInitialState(): {
  view: ViewId;
  filters: FilterState;
  phrases: string[];
} {
  if (typeof window === "undefined") {
    return { view: "overview", filters: defaultFilters, phrases: [] };
  }
  const decoded = decodeHash(window.location.hash.slice(1));
  const view: ViewId =
    decoded.view && isViewId(decoded.view) ? decoded.view : "overview";
  const filters: FilterState = {
    status: decoded.status ?? [],
    batches: decoded.batches ?? [],
    industries: decoded.industries ?? [],
    tags: decoded.tags ?? [],
    regions: decoded.regions ?? [],
    stage: decoded.stage ?? [],
    top_company: decoded.top_company ?? null,
    hasFormerNames: decoded.hasFormerNames ?? null,
    teamSizeMin: decoded.teamSizeMin ?? null,
    teamSizeMax: decoded.teamSizeMax ?? null,
    search: decoded.search ?? null,
  };
  return { view, filters, phrases: decoded.phrases ?? [] };
}

export const useUi = create<UiStore>((set) => ({
  ...getInitialState(),
  filterRevision: 0,
  setView: (view) => set({ view }),
  setFilters: (patch) =>
    set((state) => ({
      filters: { ...state.filters, ...patch },
      filterRevision: state.filterRevision + 1,
    })),
  toggleArrayFilter: (key, value) =>
    set((state) => {
      const current = state.filters[key];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return {
        filters: { ...state.filters, [key]: next },
        filterRevision: state.filterRevision + 1,
      };
    }),
  clearFilters: () =>
    set((state) => ({
      filters: defaultFilters,
      filterRevision: state.filterRevision + 1,
    })),
  addPhrase: (p) =>
    set((state) => {
      const trimmed = p.trim();
      if (!trimmed) return {};
      const key = trimmed.toLowerCase();
      if (state.phrases.some((x) => x.toLowerCase() === key)) return {};
      return { phrases: [...state.phrases, trimmed] };
    }),
  removePhrase: (p) =>
    set((state) => ({ phrases: state.phrases.filter((x) => x !== p) })),
  hydrateFromUrl: (next) =>
    set(() => ({
      view: next.view ?? "overview",
      filters: { ...defaultFilters, ...(next.filters ?? {}) },
      phrases: next.phrases ?? [],
      // intentionally do not bump filterRevision on hydration
    })),
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

export function useFilteredCompanies(companies: Company[]): Company[] {
  const filters = useUi((s) => s.filters);
  return useMemo(() => filterCompanies(companies, filters), [companies, filters]);
}
