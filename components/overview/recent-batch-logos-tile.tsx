"use client";

import { useMemo } from "react";
import { useUi } from "@/lib/store";
import { findLatestBatch } from "@/lib/overview-data";
import { batchToShort } from "@/lib/utils";
import type { Company } from "@/lib/types";
import { Tile } from "./tile";

export function RecentBatchLogosTile({ companies }: { companies: Company[] }) {
  const setView = useUi((s) => s.setView);
  const setFilters = useUi((s) => s.setFilters);

  const { latestBatch, latestShort, logos, total } = useMemo(() => {
    const latest = findLatestBatch(companies);
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

  return (
    <Tile
      header={latestShort}
      footer={
        latestBatch ? `${total.toLocaleString()} from ${latestShort} →` : "—"
      }
      onClick={() => {
        if (latestBatch) {
          setFilters({ batches: [latestBatch] });
          setView("wall");
        }
      }}
    >
      {logos.length === 0 ? (
        <div className="font-mono text-[10px] text-muted-foreground">
          No companies
        </div>
      ) : (
        // 8×3 = 24 logos. Each cell is aspect-square so logos stay square at
        // any zoom; the grid lays out columns evenly across full body width.
        <div className="grid grid-cols-8 gap-1">
          {logos.map((c) => (
            <div
              key={c.id}
              className="aspect-square overflow-hidden rounded-sm bg-muted/40"
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
            </div>
          ))}
        </div>
      )}
    </Tile>
  );
}
