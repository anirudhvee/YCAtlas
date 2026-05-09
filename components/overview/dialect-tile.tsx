"use client";

import { useMemo } from "react";
import { useUi } from "@/lib/store";
import { latestCohortDialect } from "@/lib/overview-data";
import type { Company } from "@/lib/types";
import { batchToShort, cn } from "@/lib/utils";

export function DialectTile({ companies }: { companies: Company[] }) {
  const setView = useUi((s) => s.setView);
  const addPhrase = useUi((s) => s.addPhrase);

  const { batch, words, total } = useMemo(
    () => latestCohortDialect(companies, 6),
    [companies],
  );
  const maxRatio = words[0]?.ratio ?? 1;
  const short = batch ? batchToShort(batch) : "—";

  const open = (word: string) => {
    addPhrase(word);
    setView("buzzwords");
  };

  return (
    <div className="group/tile flex h-[160px] flex-col gap-2 rounded border border-border bg-card p-3 transition-colors hover:border-foreground/30">
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground">
          Pitch dialect · {short}
        </div>
        <div className="font-mono text-[9px] tabular-nums text-muted-foreground">
          {total} cos
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {words.length === 0 ? (
          <div className="grid h-full place-items-center font-mono text-[10px] text-muted-foreground">
            No data
          </div>
        ) : (
          <div className="flex h-full flex-col justify-around">
            {words.map((w) => {
              const fill = maxRatio > 0 ? w.ratio / maxRatio : 0;
              return (
                <button
                  key={w.word}
                  type="button"
                  onClick={() => open(w.word)}
                  className="group/row flex w-full items-center gap-2 rounded-sm py-0.5 pl-0.5 pr-1 text-left font-mono text-[10px] tabular-nums transition-colors hover:bg-muted/40"
                  title={`${w.word}: ${w.latestPct.toFixed(1)}% of ${short} vs ${w.priorPct.toFixed(2)}% historically`}
                >
                  <span className="w-[68px] truncate text-foreground">
                    {w.word}
                  </span>
                  <span className="relative h-1 flex-1 overflow-hidden rounded bg-muted/40">
                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-y-0 left-0 transition-colors",
                        "bg-primary/65 group-hover/row:bg-primary",
                      )}
                      style={{ width: `${Math.max(4, fill * 100)}%` }}
                    />
                  </span>
                  <span className="w-9 text-right text-muted-foreground">
                    {w.ratio >= 10
                      ? `${Math.round(w.ratio)}×`
                      : `${w.ratio.toFixed(1)}×`}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => setView("buzzwords")}
        className="self-start font-mono text-[9.5px] tracking-wider text-muted-foreground/70 transition-colors hover:text-primary group-hover/tile:text-primary"
      >
        buzzwords →
      </button>
    </div>
  );
}
