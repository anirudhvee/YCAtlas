"use client";

import { X } from "lucide-react";
import { useCompanies } from "@/components/companies-provider";
import { useMemo } from "react";
import {
  defaultFilters,
  isFilteringActive,
  useFilteredCompanies,
  useUi,
} from "@/lib/store";
import { useMounted } from "@/lib/use-mounted";
import { canonicalCompanies } from "@/lib/overview-data";
import { batchToShort, cn } from "@/lib/utils";

interface Chip {
  key: string;
  k: string;
  v: string;
  marker?: boolean;
  onRemove: () => void;
}

export function FilterChipBar() {
  const filters = useUi((s) => s.filters);
  const setFilters = useUi((s) => s.setFilters);
  const toggleArrayFilter = useUi((s) => s.toggleArrayFilter);
  const clearFilters = useUi((s) => s.clearFilters);
  const companies = useCompanies();
  const filtered = useFilteredCompanies(companies);
  const mounted = useMounted();

  const effective = mounted ? filters : defaultFilters;
  const active = isFilteringActive(effective);

  const canonical = useMemo(() => canonicalCompanies(companies), [companies]);
  const canonicalKeys = useMemo(
    () => new Set(canonical.map((c) => c.id)),
    [canonical],
  );

  if (!active) return null;

  const chips: Chip[] = [];

  for (const s of effective.status) {
    chips.push({
      key: `s:${s}`,
      k: "status",
      v: s,
      onRemove: () => toggleArrayFilter("status", s),
    });
  }
  for (const b of effective.batches) {
    chips.push({
      key: `b:${b}`,
      k: "batch",
      v: batchToShort(b),
      marker: true,
      onRemove: () => toggleArrayFilter("batches", b),
    });
  }
  for (const i of effective.industries) {
    chips.push({
      key: `i:${i}`,
      k: "industry",
      v: i,
      onRemove: () => toggleArrayFilter("industries", i),
    });
  }
  for (const t of effective.tags) {
    chips.push({
      key: `t:${t}`,
      k: "tag",
      v: t,
      onRemove: () => toggleArrayFilter("tags", t),
    });
  }
  for (const r of effective.regions) {
    chips.push({
      key: `r:${r}`,
      k: "region",
      v: r,
      onRemove: () => toggleArrayFilter("regions", r),
    });
  }
  for (const g of effective.stage) {
    chips.push({
      key: `g:${g}`,
      k: "stage",
      v: g,
      onRemove: () => toggleArrayFilter("stage", g),
    });
  }
  if (effective.top_company !== null) {
    chips.push({
      key: "top",
      k: "top",
      v: String(effective.top_company),
      onRemove: () => setFilters({ top_company: null }),
    });
  }
  if (effective.hasFormerNames !== null) {
    chips.push({
      key: "fn",
      k: "renamed",
      v: String(effective.hasFormerNames),
      onRemove: () => setFilters({ hasFormerNames: null }),
    });
  }
  if (effective.isHiring !== null) {
    chips.push({
      key: "h",
      k: "hiring",
      v: String(effective.isHiring),
      onRemove: () => setFilters({ isHiring: null }),
    });
  }
  if (effective.teamSizeMin !== null) {
    chips.push({
      key: "tmin",
      k: "team ≥",
      v: String(effective.teamSizeMin),
      onRemove: () => setFilters({ teamSizeMin: null }),
    });
  }
  if (effective.teamSizeMax !== null) {
    chips.push({
      key: "tmax",
      k: "team ≤",
      v: String(effective.teamSizeMax),
      onRemove: () => setFilters({ teamSizeMax: null }),
    });
  }
  if (effective.search) {
    chips.push({
      key: "q",
      k: "search",
      v: effective.search,
      onRemove: () => setFilters({ search: null }),
    });
  }

  const total = mounted ? canonical.length : 0;
  const filteredCount = mounted
    ? filtered.filter((c) => canonicalKeys.has(c.id)).length
    : 0;

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-card px-4 py-2 font-mono text-[11.5px]">
      {chips.map((c) => (
        <span
          key={c.key}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border bg-background py-[2px] pl-[9px] pr-1 leading-none",
            c.marker
              ? "border-[color:var(--primary-line)]"
              : "border-border",
          )}
        >
          <span className={c.marker ? "text-primary" : "text-faint"}>{c.k}</span>
          <span className="text-foreground">{c.v}</span>
          <button
            type="button"
            onClick={c.onRemove}
            aria-label={`Remove ${c.k}: ${c.v}`}
            className="grid size-4 place-items-center rounded-full text-faint transition-colors hover:bg-[color:var(--bg-soft)] hover:text-foreground"
          >
            <X className="size-2.5" strokeWidth={2.25} />
          </button>
        </span>
      ))}
      <div className="ml-auto flex items-center gap-2.5 text-muted-foreground">
        <span className="tabular-nums">
          {filteredCount.toLocaleString()} / {total.toLocaleString()} matching
        </span>
        <button
          type="button"
          onClick={clearFilters}
          aria-label={`Clear all ${chips.length} active filter${chips.length === 1 ? "" : "s"}`}
          className="inline-flex h-[22px] items-center gap-1.5 rounded-full border border-border px-2 text-muted-foreground transition-colors hover:border-[color:var(--border-strong)] hover:bg-[color:var(--bg-soft)] hover:text-foreground"
        >
          <X className="size-2.5" strokeWidth={2.25} />
          <span>clear ({chips.length})</span>
        </button>
      </div>
    </div>
  );
}
