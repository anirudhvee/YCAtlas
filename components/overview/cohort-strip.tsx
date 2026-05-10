"use client";

import { useMemo, useState } from "react";
import { useCompanies } from "@/components/companies-provider";
import { useFilters } from "@/lib/url-state";
import {
  aggregatesAboveMinSize,
  aggregatesExcludingUnspecified,
  aggregateByBatch,
  type BatchAggregate,
} from "@/lib/overview-data";
import { cn } from "@/lib/utils";
import { ChartCard, StatPill } from "./chart-card";

interface TooltipAnchor {
  agg: BatchAggregate;
  x: number;
  y: number;
  placement: "above" | "below";
}

const TOOLTIP_HEIGHT = 44;
const TOOLTIP_GAP = 8;

export function CohortStrip() {
  const all = useCompanies();
  const { filters, setFilters } = useFilters();
  const [anchor, setAnchor] = useState<TooltipAnchor | null>(null);

  const aggregates = useMemo(
    () =>
      aggregatesAboveMinSize(
        aggregatesExcludingUnspecified(aggregateByBatch(all)),
      ),
    [all],
  );

  const selected = new Set(filters.batches);
  const hasSelection = selected.size > 0;
  const selectedBatch =
    filters.batches.length === 1 ? filters.batches[0] : null;
  const selectedAgg = selectedBatch
    ? aggregates.find((a) => a.batch === selectedBatch)
    : null;

  if (aggregates.length === 0) {
    return (
      <ChartCard title="Batches" subtitle="Bar height = company count">
        <div className="flex h-20 items-center justify-center font-mono text-[10px] text-muted-foreground">
          Loading batches…
        </div>
      </ChartCard>
    );
  }

  const maxTotal = Math.max(...aggregates.map((a) => a.total));
  const first = aggregates[0];
  const last = aggregates[aggregates.length - 1];
  const totalAll = aggregates.reduce((s, a) => s + a.total, 0);

  const handleEnter = (
    agg: BatchAggregate,
    e: React.MouseEvent<HTMLButtonElement> | React.FocusEvent<HTMLButtonElement>,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const placement: "above" | "below" =
      rect.top - TOOLTIP_HEIGHT - TOOLTIP_GAP < 60 ? "below" : "above";
    setAnchor({
      agg,
      x: rect.left + rect.width / 2,
      y: placement === "above" ? rect.top - TOOLTIP_GAP : rect.bottom + TOOLTIP_GAP,
      placement,
    });
  };

  const handleLeave = () => setAnchor(null);

  const handleClick = (agg: BatchAggregate) => {
    setAnchor(null);
    const isSelected =
      filters.batches.length === 1 && filters.batches[0] === agg.batch;
    setFilters({ batches: isSelected ? [] : [agg.batch] });
  };

  return (
    <ChartCard
      title="Batches"
      subtitle="Bar height = company count · click to filter"
      headRight={
        <>
          <StatPill
            label={selectedAgg ? selectedAgg.short : "All-time"}
            value={(selectedAgg ? selectedAgg.total : totalAll).toLocaleString()}
            hint="companies"
          />
          <StatPill label="Batches" value={aggregates.length} />
        </>
      }
    >
      <div className="relative flex flex-col gap-2">
        <div
          className="flex h-20 items-end gap-px"
          onMouseLeave={handleLeave}
        >
          {aggregates.map((agg) => {
            const isSelected = selected.has(agg.batch);
            return (
              <button
                key={agg.batch}
                type="button"
                aria-label={`${agg.short}: ${agg.total} companies, ${agg.pctActive.toFixed(0)}% active${isSelected ? ", selected" : ""}`}
                aria-pressed={isSelected}
                onMouseEnter={(e) => handleEnter(agg, e)}
                onMouseLeave={handleLeave}
                onFocus={(e) => handleEnter(agg, e)}
                onBlur={handleLeave}
                onClick={() => handleClick(agg)}
                style={{ height: `${(agg.total / maxTotal) * 100}%` }}
                className={cn(
                  "flex-1 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                  isSelected
                    ? "bg-primary"
                    : hasSelection
                      ? "bg-primary/[0.18] hover:bg-primary/40"
                      : "bg-primary/60 hover:bg-primary/95",
                )}
              />
            );
          })}
        </div>
        <div className="flex items-center justify-between font-mono text-[10px] tabular-nums text-muted-foreground">
          <span>{first.short}</span>
          <span className="text-faint">{aggregates.length} batches</span>
          <span>{last.short}</span>
        </div>
      </div>
      {anchor && <CohortTooltip anchor={anchor} />}
    </ChartCard>
  );
}

function CohortTooltip({ anchor }: { anchor: TooltipAnchor }) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50 rounded border border-border bg-card px-2 py-1.5 font-mono text-[10px] leading-tight tabular-nums whitespace-nowrap"
      style={{
        left: anchor.x,
        top: anchor.y,
        transform:
          anchor.placement === "above"
            ? "translate(-50%, -100%)"
            : "translate(-50%, 0)",
      }}
    >
      <div className="text-foreground">{anchor.agg.short}</div>
      <div className="text-muted-foreground">
        {anchor.agg.total.toLocaleString()} ·{" "}
        {anchor.agg.pctActive.toFixed(0)}% active ·{" "}
        {anchor.agg.pctTopCompany.toFixed(1)}% top
      </div>
    </div>
  );
}
