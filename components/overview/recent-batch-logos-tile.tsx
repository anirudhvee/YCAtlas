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

  return (
    <div className="group flex h-[168px] flex-col gap-2.5 rounded-[10px] border border-border bg-card p-3.5 transition-colors hover:border-[color:var(--border-strong)]">
      <div className="flex items-baseline justify-between gap-2">
        <div className="cap-label">{latestShort}</div>
        <div className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {total} companies
        </div>
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
                className="aspect-square overflow-hidden rounded-sm bg-[color:var(--bg-soft)] transition-transform duration-150 ease-out hover:-translate-y-0.5 hover:shadow-[0_4px_16px_-8px_rgba(255,102,0,0.55)]"
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
        className="self-start font-mono text-[10px] tracking-[0.04em] text-muted-foreground transition-colors hover:text-primary group-hover:text-primary disabled:pointer-events-none"
      >
        {latestBatch ? `${total.toLocaleString()} from ${latestShort} →` : "—"}
      </button>
    </div>
  );
}
