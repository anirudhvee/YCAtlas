"use client";

import { useCompanies } from "@/components/companies-provider";
import {
  defaultFilters,
  isFilteringActive,
  useFilteredCompanies,
  useUi,
} from "@/lib/store";
import { useMounted } from "@/lib/use-mounted";
import { batchToShort, cn } from "@/lib/utils";

interface Chip {
  key: string;
  label: string;
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

  if (!active) return null;

  const chips: Chip[] = [];

  for (const s of effective.status) {
    chips.push({
      key: `s:${s}`,
      label: `status: ${s}`,
      onRemove: () => toggleArrayFilter("status", s),
    });
  }
  for (const b of effective.batches) {
    chips.push({
      key: `b:${b}`,
      label: `batches: ${batchToShort(b)}`,
      onRemove: () => toggleArrayFilter("batches", b),
    });
  }
  for (const i of effective.industries) {
    chips.push({
      key: `i:${i}`,
      label: `industries: ${i}`,
      onRemove: () => toggleArrayFilter("industries", i),
    });
  }
  for (const t of effective.tags) {
    chips.push({
      key: `t:${t}`,
      label: `tags: ${t}`,
      onRemove: () => toggleArrayFilter("tags", t),
    });
  }
  for (const r of effective.regions) {
    chips.push({
      key: `r:${r}`,
      label: `regions: ${r}`,
      onRemove: () => toggleArrayFilter("regions", r),
    });
  }
  for (const g of effective.stage) {
    chips.push({
      key: `g:${g}`,
      label: `stage: ${g}`,
      onRemove: () => toggleArrayFilter("stage", g),
    });
  }
  if (effective.top_company !== null) {
    chips.push({
      key: "top",
      label: `top: ${effective.top_company}`,
      onRemove: () => setFilters({ top_company: null }),
    });
  }
  if (effective.hasFormerNames !== null) {
    chips.push({
      key: "fn",
      label: `formerNames: ${effective.hasFormerNames}`,
      onRemove: () => setFilters({ hasFormerNames: null }),
    });
  }
  if (effective.teamSizeMin !== null) {
    chips.push({
      key: "tmin",
      label: `team ≥ ${effective.teamSizeMin}`,
      onRemove: () => setFilters({ teamSizeMin: null }),
    });
  }
  if (effective.teamSizeMax !== null) {
    chips.push({
      key: "tmax",
      label: `team ≤ ${effective.teamSizeMax}`,
      onRemove: () => setFilters({ teamSizeMax: null }),
    });
  }
  if (effective.search) {
    chips.push({
      key: "q",
      label: `search: ${effective.search}`,
      onRemove: () => setFilters({ search: null }),
    });
  }

  const total = mounted ? companies.length : 0;
  const filteredCount = mounted ? filtered.length : 0;

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-card/40 px-4 py-2 font-mono text-[11px]">
      {chips.map((c) => (
        <FilterChip key={c.key} label={c.label} onRemove={c.onRemove} />
      ))}
      <div className="ml-auto flex items-center gap-3">
        <span className="tabular-nums text-muted-foreground">
          {filteredCount.toLocaleString()} / {total.toLocaleString()} matching
        </span>
        <button
          type="button"
          onClick={clearFilters}
          className="text-primary transition-colors hover:underline"
        >
          clear all
        </button>
      </div>
    </div>
  );
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/10 px-2 py-0.5 text-primary",
      )}
    >
      <span>{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="text-primary/70 transition-colors hover:text-primary"
      >
        ×
      </button>
    </span>
  );
}
