"use client";

import { X } from "lucide-react";
import { useCompanies } from "@/components/companies-provider";
import { useMemo } from "react";
import { isFilteringActive } from "@/lib/store";
import { useFilters, useFilteredCompanies } from "@/lib/url-state";
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
  const { filters, setFilters, toggleArrayFilter, clearFilters } = useFilters();
  const companies = useCompanies();
  const filtered = useFilteredCompanies(companies);

  const effective = filters;
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
  for (const ct of effective.cities) {
    chips.push({
      key: `city:${ct}`,
      k: "city",
      v: ct,
      onRemove: () => toggleArrayFilter("cities", ct),
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

  const total = canonical.length;
  const filteredCount = filtered.filter((c) => canonicalKeys.has(c.id)).length;

  return (
    <div className="border-b border-border bg-card font-mono text-[11.5px]">
      <div className="flex items-center justify-between gap-2 px-3 pt-2 sm:hidden">
        <span className="tabular-nums text-foreground/70">
          <span className="text-foreground">{filteredCount.toLocaleString()}</span>
          <span className="text-faint"> / {total.toLocaleString()}</span>
          <span className="text-faint"> matching</span>
        </span>
        <button
          type="button"
          onClick={clearFilters}
          aria-label={`Clear all ${chips.length} active filter${chips.length === 1 ? "" : "s"}`}
          className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-destructive/35 bg-destructive/10 px-2.5 text-[11px] text-destructive transition-colors hover:bg-destructive/20"
        >
          <X className="size-3" strokeWidth={2.25} />
          <span>Clear all ({chips.length})</span>
        </button>
      </div>

      <div className="flex items-center gap-1.5 sm:flex-wrap sm:px-4 sm:py-2">
        <div className="relative min-w-0 flex-1 sm:flex-none">
          <div className="scroll-x-hidden flex items-center gap-1.5 overflow-x-auto px-3 pb-2 pt-1.5 sm:overflow-visible sm:px-0 sm:py-0">
            {chips.map((c) => (
              <span
                key={c.key}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-background py-[3px] pl-[10px] pr-1 leading-none sm:py-[2px] sm:pl-[9px]",
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
                  className="grid size-[18px] place-items-center rounded-full text-faint transition-colors hover:bg-[color:var(--bg-soft)] hover:text-foreground sm:size-4"
                >
                  <X className="size-2.5" strokeWidth={2.25} />
                </button>
              </span>
            ))}
            <span className="hidden tabular-nums text-muted-foreground sm:ml-auto sm:inline-flex">
              {filteredCount.toLocaleString()} / {total.toLocaleString()} matching
            </span>
            <button
              type="button"
              onClick={clearFilters}
              aria-label={`Clear all ${chips.length} active filter${chips.length === 1 ? "" : "s"}`}
              className="hidden h-[22px] shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--primary-line)] bg-[color:var(--primary-soft)] px-2 text-primary transition-colors hover:bg-primary hover:text-primary-foreground sm:inline-flex"
            >
              <X className="size-2.5" strokeWidth={2.25} />
              <span>clear ({chips.length})</span>
            </button>
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card to-transparent sm:hidden"
          />
        </div>
      </div>
    </div>
  );
}
