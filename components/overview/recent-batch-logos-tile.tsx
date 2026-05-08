"use client";

import { useMemo } from "react";
import { useUi } from "@/lib/store";
import { findLatestBatch } from "@/lib/overview-data";
import { batchToShort } from "@/lib/utils";
import type { Company } from "@/lib/types";

export function RecentBatchLogosTile({ companies }: { companies: Company[] }) {
  const setView = useUi((s) => s.setView);
  const setFilters = useUi((s) => s.setFilters);
  const setSelectedCompany = useUi((s) => s.setSelectedCompany);

  const { latestBatch, latestShort, logos, total } = useMemo(() => {
    // Strict rule first; fall back to any batch with ≥1 company so a
    // narrow filter doesn't blank out the tile.
    const latest =
      findLatestBatch(companies) ?? findLatestBatch(companies, 1);
    if (!latest) {
      return { latestBatch: null, latestShort: "—", logos: [], total: 0 };
    }
    const inBatch = companies.filter((c) => c.batch === latest);
    return {
      latestBatch: latest,
      latestShort: batchToShort(latest),
      logos: inBatch.slice(0, 24),
      total: inBatch.length,
    };
  }, [companies]);

  // Inlined instead of using <Tile> because each logo is its own
  // <button>; nesting buttons under a role="button" tile is invalid.
  return (
    <div className="group/tile flex h-[160px] flex-col gap-2 rounded border border-border bg-card p-3 transition-colors hover:border-foreground/30">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground">
        {latestShort}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {logos.length === 0 ? (
          <div className="font-mono text-[10px] text-muted-foreground">
            No companies
          </div>
        ) : (
          <div className="grid grid-cols-8 gap-1">
            {logos.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-label={c.name}
                onClick={() => setSelectedCompany(c)}
                className="aspect-square overflow-hidden rounded-sm bg-muted/40 transition-transform hover:scale-110"
              >
                {c.small_logo_thumb_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.small_logo_thumb_url}
                    alt={c.name}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                ) : null}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        disabled={!latestBatch}
        onClick={() => {
          if (latestBatch) {
            setFilters({ batches: [latestBatch] });
            setView("wall");
          }
        }}
        className="self-start font-mono text-[9.5px] tracking-wider text-muted-foreground/70 transition-colors hover:text-primary disabled:pointer-events-none group-hover/tile:text-primary"
      >
        {latestBatch ? `${total.toLocaleString()} from ${latestShort} →` : "—"}
      </button>
    </div>
  );
}
