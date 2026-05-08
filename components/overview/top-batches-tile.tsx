"use client";

import { useMemo } from "react";
import { useUi } from "@/lib/store";
import { topBatchesByPctTopCompany } from "@/lib/overview-data";
import { cn } from "@/lib/utils";
import type { Company } from "@/lib/types";
import { Tile } from "./tile";

interface Props {
  companies: Company[];
  selectedBatch: string | null;
}

export function TopBatchesTile({ companies, selectedBatch }: Props) {
  const setView = useUi((s) => s.setView);
  const setFilters = useUi((s) => s.setFilters);

  const rows = useMemo(
    () => topBatchesByPctTopCompany(companies, 5),
    [companies],
  );

  const max = rows.length > 0 ? rows[0].pctTopCompany : 1;

  return (
    <Tile
      header="Top batches"
      footer="boards →"
      onClick={() => setView("boards")}
    >
      <div className="flex h-full flex-col justify-between">
        {rows.length === 0 && (
          <div className="font-mono text-[10px] text-muted-foreground">
            Not enough data
          </div>
        )}
        {rows.map((r) => {
          const isSelected = r.batch === selectedBatch;
          return (
            <button
              key={r.batch}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setFilters({ batches: isSelected ? [] : [r.batch] });
              }}
              className={cn(
                "group/row flex w-full items-center gap-2 rounded font-mono text-[10px] leading-none tabular-nums transition-colors",
                isSelected
                  ? "text-foreground"
                  : "hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "w-7 transition-colors",
                  isSelected
                    ? "text-primary"
                    : "text-muted-foreground group-hover/row:text-foreground",
                )}
              >
                {r.short}
              </span>
              <span className="relative h-1 flex-1 overflow-hidden rounded bg-muted/40">
                <span
                  className={cn(
                    "absolute inset-y-0 left-0 transition-colors",
                    isSelected
                      ? "bg-primary"
                      : "bg-primary/50 group-hover/row:bg-primary",
                  )}
                  style={{ width: `${(r.pctTopCompany / max) * 100}%` }}
                />
              </span>
              <span className="w-9 text-right text-foreground">
                {r.pctTopCompany.toFixed(0)}%
              </span>
            </button>
          );
        })}
      </div>
    </Tile>
  );
}
