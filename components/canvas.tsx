"use client";

import { cn } from "@/lib/utils";
import { useCompanies } from "@/components/companies-provider";
import { defaultFilters, useFilteredCompanies, useUi } from "@/lib/store";
import { useMounted } from "@/lib/use-mounted";
import { VIEWS } from "@/lib/views";

const STATUS_OPTIONS = ["Active", "Inactive", "Acquired", "Public"] as const;

export function Canvas() {
  const view = useUi((s) => s.view);
  const mounted = useMounted();
  const effectiveView = mounted ? view : "overview";
  const meta = VIEWS.find((v) => v.id === effectiveView);
  const Icon = meta?.icon;

  return (
    <div className="flex h-full flex-col">
      <DebugStrip />
      <div className="grid flex-1 place-items-center px-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            View
          </span>
          <div className="flex items-center gap-3">
            {Icon && <Icon className="size-7 text-primary" strokeWidth={1.5} />}
            <h2 className="text-3xl font-medium tracking-tight">{meta?.label}</h2>
          </div>
          <span className="font-mono text-[10px] tracking-wider text-muted-foreground/60">
            ── placeholder ──
          </span>
        </div>
      </div>
    </div>
  );
}

function DebugStrip() {
  const filters = useUi((s) => s.filters);
  const toggleArrayFilter = useUi((s) => s.toggleArrayFilter);
  const setFilters = useUi((s) => s.setFilters);
  const clearFilters = useUi((s) => s.clearFilters);

  const companies = useCompanies();
  const filtered = useFilteredCompanies(companies);
  const mounted = useMounted();

  // Server + first hydrated render: use defaults so HTML matches.
  // Post-mount: use real store state.
  const effectiveFilters = mounted ? filters : defaultFilters;
  const total = mounted ? companies.length : 0;
  const filteredCount = mounted ? filtered.length : 0;

  const cycleTopCompany = () => {
    const next: boolean | null =
      filters.top_company === null
        ? true
        : filters.top_company
          ? false
          : null;
    setFilters({ top_company: next });
  };

  const topLabel =
    effectiveFilters.top_company === null
      ? "any"
      : effectiveFilters.top_company
        ? "true"
        : "false";

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card/50 px-4 py-2 font-mono text-[11px]">
      <span className="text-muted-foreground/70">Debug ·</span>
      <span className="text-muted-foreground">status:</span>
      {STATUS_OPTIONS.map((s) => {
        const active = effectiveFilters.status.includes(s);
        return (
          <DebugButton
            key={s}
            active={active}
            onClick={() => toggleArrayFilter("status", s)}
          >
            {s}
          </DebugButton>
        );
      })}
      <span className="h-3 w-px bg-border" />
      <span className="text-muted-foreground">top:</span>
      <DebugButton
        active={effectiveFilters.top_company !== null}
        onClick={cycleTopCompany}
      >
        {topLabel}
      </DebugButton>
      <span className="h-3 w-px bg-border" />
      <DebugButton onClick={clearFilters}>clear all</DebugButton>
      <span className="ml-auto tabular-nums text-muted-foreground">
        {filteredCount.toLocaleString()} / {total.toLocaleString()}
      </span>
    </div>
  );
}

function DebugButton({
  children,
  active = false,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded border px-2 py-0.5 text-[11px] transition-colors",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
