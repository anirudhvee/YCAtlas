"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  createParser,
  createSerializer,
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  useQueryState,
  useQueryStates,
  type Nullable,
  type Values,
} from "nuqs";

import {
  defaultFilters,
  filterCompanies,
  type ArrayFilterKey,
  type FilterState,
  type ViewId,
} from "./store";
import type { Company } from "./types";
import { batchFromShort, batchToShort } from "./utils";

const VIEW_TO_PATH: Record<ViewId, string> = {
  overview: "/",
  globe: "/globe",
  timeline: "/timeline",
  compare: "/compare",
  buzzwords: "/buzzwords",
  wall: "/wall",
  heatmap: "/heatmap",
  boards: "/boards",
};

const PATH_TO_VIEW = new Map<string, ViewId>(
  Object.entries(VIEW_TO_PATH).map(([id, path]) => [path, id as ViewId]),
);

export function pathToView(pathname: string): ViewId {
  return PATH_TO_VIEW.get(pathname) ?? "overview";
}

export function viewToPath(view: ViewId): string {
  return VIEW_TO_PATH[view] ?? "/";
}

export function useView(): [ViewId, (next: ViewId) => void] {
  const pathname = usePathname();
  const router = useRouter();
  const view = pathToView(pathname);
  const setView = useCallback(
    (next: ViewId) => {
      const target = viewToPath(next);
      const search =
        typeof window !== "undefined" ? window.location.search : "";
      router.push(`${target}${search}`, { scroll: false });
    },
    [router],
  );
  return [view, setView];
}

// No `withDefault` — absence ⇒ null, giving the tri-state
// (true | false | null) that filter consumers rely on.
const boolParser = createParser<boolean>({
  parse: (v) => (v === "1" ? true : v === "0" ? false : null),
  serialize: (v) => (v ? "1" : "0"),
  eq: (a, b) => a === b,
});

const stringCsv = parseAsArrayOf(parseAsString).withDefault([] as string[]);

const batchItemParser = createParser<string>({
  parse: (v) => batchFromShort(v),
  serialize: (v) => batchToShort(v),
  eq: (a, b) => a === b,
});

const batchCsv = parseAsArrayOf(batchItemParser).withDefault([] as string[]);

const filterParsers = {
  s: stringCsv,
  b: batchCsv,
  i: stringCsv,
  t: stringCsv,
  r: stringCsv,
  g: stringCsv,
  top: boolParser,
  fn: boolParser,
  h: boolParser,
  tmin: parseAsInteger,
  tmax: parseAsInteger,
  q: parseAsString,
};

// Single source of truth: FilterState key → URL search key.
const FILTER_KEY_TO_URL = {
  status: "s",
  batches: "b",
  industries: "i",
  tags: "t",
  regions: "r",
  stage: "g",
  top_company: "top",
  hasFormerNames: "fn",
  isHiring: "h",
  teamSizeMin: "tmin",
  teamSizeMax: "tmax",
  search: "q",
} as const satisfies Record<keyof FilterState, keyof typeof filterParsers>;

type FilterUrlPatch = Partial<Nullable<Values<typeof filterParsers>>>;

const FILTER_KEYS = Object.keys(FILTER_KEY_TO_URL) as (keyof FilterState)[];

export interface UseFiltersReturn {
  filters: FilterState;
  setFilters: (patch: Partial<FilterState>) => void;
  toggleArrayFilter: (key: ArrayFilterKey, value: string) => void;
  clearFilters: () => void;
}

export function useFilters(): UseFiltersReturn {
  const [u, setU] = useQueryStates(filterParsers);

  const filters: FilterState = useMemo(() => {
    const result: Record<string, unknown> = {};
    for (const fKey of FILTER_KEYS) {
      result[fKey] = u[FILTER_KEY_TO_URL[fKey]];
    }
    return result as unknown as FilterState;
  }, [u]);

  const setFilters = useCallback(
    (patch: Partial<FilterState>) => {
      const urlPatch = {} as Record<string, unknown>;
      for (const fKey of FILTER_KEYS) {
        if (fKey in patch) {
          urlPatch[FILTER_KEY_TO_URL[fKey]] = patch[fKey] ?? null;
        }
      }
      void setU(urlPatch as FilterUrlPatch);
    },
    [setU],
  );

  const toggleArrayFilter = useCallback(
    (key: ArrayFilterKey, value: string) => {
      const urlKey = FILTER_KEY_TO_URL[key];
      const current = u[urlKey];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      void setU({ [urlKey]: next.length ? next : null });
    },
    [u, setU],
  );

  const clearFilters = useCallback(() => {
    const cleared = Object.fromEntries(
      Object.values(FILTER_KEY_TO_URL).map((uKey) => [uKey, null]),
    ) as FilterUrlPatch;
    void setU(cleared);
  }, [setU]);

  return { filters, setFilters, toggleArrayFilter, clearFilters };
}

// Lives outside FilterState so clearFilters() doesn't wipe phrases.
export interface UsePhrasesReturn {
  phrases: string[];
  addPhrase: (p: string) => void;
  removePhrase: (p: string) => void;
}

export function usePhrases(): UsePhrasesReturn {
  const [phrases, setPhrases] = useQueryState("bw", stringCsv);

  const addPhrase = useCallback(
    (p: string) => {
      const trimmed = p.trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      if (phrases.some((x) => x.toLowerCase() === key)) return;
      void setPhrases([...phrases, trimmed]);
    },
    [phrases, setPhrases],
  );

  const removePhrase = useCallback(
    (p: string) => {
      const next = phrases.filter((x) => x !== p);
      void setPhrases(next.length ? next : null);
    },
    [phrases, setPhrases],
  );

  return { phrases, addPhrase, removePhrase };
}

export interface UseCompareBatchesReturn {
  compareBatches: string[];
  setCompareBatches: (batches: string[]) => void;
  toggleCompareBatch: (batch: string) => void;
}

export function useCompareBatches(): UseCompareBatchesReturn {
  const [compareBatches, setRaw] = useQueryState("cmp", batchCsv);

  const setCompareBatches = useCallback(
    (batches: string[]) => {
      const next = batches.slice(0, 4);
      void setRaw(next.length ? next : null);
    },
    [setRaw],
  );

  const toggleCompareBatch = useCallback(
    (batch: string) => {
      const idx = compareBatches.indexOf(batch);
      let next: string[];
      if (idx >= 0) {
        next = compareBatches.filter((b) => b !== batch);
      } else if (compareBatches.length >= 4) {
        // Cap at 4: keep the baseline (index 0) and drop the oldest peer.
        next = [compareBatches[0], ...compareBatches.slice(2), batch];
      } else {
        next = [...compareBatches, batch];
      }
      void setRaw(next.length ? next : null);
    },
    [compareBatches, setRaw],
  );

  return { compareBatches, setCompareBatches, toggleCompareBatch };
}

export function useFilteredCompanies(companies: Company[]): Company[] {
  const { filters } = useFilters();
  return useMemo(() => filterCompanies(companies, filters), [companies, filters]);
}

const navParsers = {
  ...filterParsers,
  bw: stringCsv,
  cmp: batchCsv,
};

const serializeNavSearch = createSerializer(navParsers);

type NavValues = Partial<Nullable<Values<typeof navParsers>>>;

export interface NavigatePatch {
  filters?: Partial<FilterState>;
  phrases?: string[];
  compareBatches?: string[];
}

function patchToNavValues(patch: NavigatePatch): NavValues {
  const out = {} as Record<string, unknown>;
  const f = patch.filters;
  if (f) {
    for (const fKey of FILTER_KEYS) {
      if (fKey in f) {
        out[FILTER_KEY_TO_URL[fKey]] = f[fKey] ?? null;
      }
    }
  }
  if (patch.phrases !== undefined) {
    out.bw = patch.phrases.length ? patch.phrases : null;
  }
  if (patch.compareBatches !== undefined) {
    out.cmp = patch.compareBatches.length ? patch.compareBatches : null;
  }
  return out as NavValues;
}

// Pushes the full target URL in one shot, sidestepping nuqs's
// microtask-scheduled URL writes (which would otherwise race a
// preceding `setFilters` against `setView`).
//
// FOOTGUN: the base is read from `window.location.search`, so a
// `setFilters` call in the same tick may not have landed yet and
// will be silently dropped. Fold every change into the patch, or
// `await` the prior `setFilters` promise before navigating.
export function useNavigateToView(): (
  view: ViewId,
  patch?: NavigatePatch,
) => void {
  const router = useRouter();
  return useCallback(
    (view, patch) => {
      const path = viewToPath(view);
      const base =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search)
          : new URLSearchParams();
      const search = serializeNavSearch(base, patch ? patchToNavValues(patch) : {});
      router.push(`${path}${search}`, { scroll: false });
    },
    [router],
  );
}

export { defaultFilters };
