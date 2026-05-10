"use client";

import { useMemo } from "react";
import { useNavigateToView, usePhrases, useView } from "@/lib/url-state";
import { latestCohortDialect } from "@/lib/overview-data";
import type { Company } from "@/lib/types";
import { batchToShort, cn } from "@/lib/utils";

export function DialectTile({ companies }: { companies: Company[] }) {
  const [, setView] = useView();
  const { phrases } = usePhrases();
  const navigateToView = useNavigateToView();

  const { batch, words, total } = useMemo(
    () => latestCohortDialect(companies, 6),
    [companies],
  );
  const maxRatio = words[0]?.ratio ?? 1;
  const short = batch ? batchToShort(batch) : "—";

  const open = (word: string) => {
    const trimmed = word.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    const nextPhrases = phrases.some((p) => p.toLowerCase() === key)
      ? phrases
      : [...phrases, trimmed];
    navigateToView("buzzwords", { phrases: nextPhrases });
  };

  return (
    <div className="group flex h-[168px] flex-col gap-2 rounded-[10px] border border-border bg-card p-3.5 transition-colors hover:border-[color:var(--border-strong)]">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[13px] font-medium tracking-[-0.005em] text-foreground">
          Pitch dialect
        </div>
        <div className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {short} · {total} companies
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
                  className="grid w-full grid-cols-[70px_1fr_38px] items-center gap-2 rounded-sm py-px font-mono text-[10.5px] tabular-nums transition-colors hover:bg-[color:var(--bg-soft)]"
                  title={`${w.word}: ${w.latestPct.toFixed(1)}% of ${short} vs ${w.priorPct.toFixed(2)}% historically`}
                >
                  <span className="truncate text-left text-foreground">
                    {w.word}
                  </span>
                  <span className="relative h-1 overflow-hidden rounded-sm bg-[color:var(--bg-soft)]">
                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-y-0 left-0 rounded-sm bg-primary/60 transition-colors",
                        "group-hover:bg-primary/60 [&:hover]:bg-primary",
                      )}
                      style={{
                        width: `${Math.max(6, fill * 100)}%`,
                      }}
                    />
                  </span>
                  <span className="text-right text-muted-foreground">
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
        className="self-start font-mono text-[10px] tracking-[0.04em] text-muted-foreground transition-colors hover:text-primary group-hover:text-primary"
      >
        buzzwords →
      </button>
    </div>
  );
}
