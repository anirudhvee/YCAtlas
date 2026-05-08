"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useCompanies } from "@/components/companies-provider";
import { useFilteredCompanies, useUi } from "@/lib/store";
import { useMounted } from "@/lib/use-mounted";
import { batchToShort, batchToSortKey, cn } from "@/lib/utils";
import type { Company } from "@/lib/types";

const MAX_CELLS = 300;

type SortKey = "top_company" | "team_size" | "batch" | "status";

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: "top_company", label: "top company" },
  { id: "team_size", label: "team size" },
  { id: "batch", label: "batch" },
  { id: "status", label: "status" },
];

const STATUS_RANK: Record<string, number> = {
  Public: 0,
  Acquired: 1,
  Active: 2,
  Inactive: 3,
};

function compareCompanies(a: Company, b: Company, sort: SortKey): number {
  switch (sort) {
    case "top_company": {
      const ta = a.top_company === true ? 1 : 0;
      const tb = b.top_company === true ? 1 : 0;
      if (tb !== ta) return tb - ta;
      const sa = a.team_size ?? 0;
      const sb = b.team_size ?? 0;
      if (sb !== sa) return sb - sa;
      return batchToSortKey(b.batch) - batchToSortKey(a.batch);
    }
    case "team_size":
      return (b.team_size ?? 0) - (a.team_size ?? 0);
    case "batch":
      return batchToSortKey(b.batch) - batchToSortKey(a.batch);
    case "status": {
      const ra = STATUS_RANK[a.status] ?? 9;
      const rb = STATUS_RANK[b.status] ?? 9;
      if (ra !== rb) return ra - rb;
      return batchToSortKey(b.batch) - batchToSortKey(a.batch);
    }
  }
}

export function Wall() {
  const all = useCompanies();
  const filtered = useFilteredCompanies(all);
  const filters = useUi((s) => s.filters);
  const setFilters = useUi((s) => s.setFilters);
  const clearFilters = useUi((s) => s.clearFilters);
  const mounted = useMounted();

  const [sort, setSort] = useState<SortKey>("top_company");

  const latestBatch = useMemo(() => {
    let best: { key: number; batch: string } | null = null;
    const counts = new Map<string, number>();
    for (const c of all) {
      if (c.batch === "Unspecified") continue;
      counts.set(c.batch, (counts.get(c.batch) ?? 0) + 1);
    }
    for (const [batch, count] of counts) {
      if (count < 20) continue;
      const key = batchToSortKey(batch);
      if (!Number.isFinite(key)) continue;
      if (!best || key > best.key) best = { key, batch };
    }
    return best?.batch ?? null;
  }, [all]);

  const allBatches = useMemo(() => {
    const set = new Set<string>();
    for (const c of all) if (c.batch !== "Unspecified") set.add(c.batch);
    return [...set].sort((a, b) => batchToSortKey(b) - batchToSortKey(a));
  }, [all]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => compareCompanies(a, b, sort));
    return arr;
  }, [filtered, sort]);

  const total = sorted.length;
  const cells = total > MAX_CELLS ? sorted.slice(0, MAX_CELLS) : sorted;

  const selectedBatch =
    mounted && filters.batches.length === 1 ? filters.batches[0] : null;
  const allBatchesActive = mounted && filters.batches.length === 0;
  const latestActive =
    mounted && selectedBatch !== null && selectedBatch === latestBatch;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card/40 px-4 py-2 font-mono text-[11px]">
        <span className="text-muted-foreground">sort:</span>
        {SORT_OPTIONS.map((opt) => {
          const active = sort === opt.id;
          return (
            <PillButton
              key={opt.id}
              active={active}
              onClick={() => setSort(opt.id)}
            >
              {opt.label}
            </PillButton>
          );
        })}

        <span className="mx-1 h-3 w-px bg-border" />
        <span className="text-muted-foreground">batch:</span>
        <PillButton
          active={allBatchesActive}
          onClick={() => setFilters({ batches: [] })}
        >
          all
        </PillButton>
        <PillButton
          active={latestActive}
          onClick={() => {
            if (latestBatch) setFilters({ batches: [latestBatch] });
          }}
        >
          latest{latestBatch ? ` · ${batchToShort(latestBatch)}` : ""}
        </PillButton>
        <select
          value={selectedBatch ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            setFilters({ batches: v ? [v] : [] });
          }}
          className="rounded border border-border bg-card px-2 py-0.5 text-[11px] text-foreground outline-none transition-colors hover:border-foreground/30 focus:border-primary/40"
          aria-label="Pick batch"
        >
          <option value="">pick batch</option>
          {allBatches.map((b) => (
            <option key={b} value={b}>
              {batchToShort(b)}
            </option>
          ))}
        </select>

        <span className="ml-auto tabular-nums text-muted-foreground">
          {total.toLocaleString()} companies
        </span>
      </div>

      <div
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{ paddingBottom: "60px" }}
      >
        {total === 0 ? (
          <div className="grid h-full place-items-center font-mono text-[11px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>No companies match</span>
              <button
                type="button"
                onClick={clearFilters}
                className="text-primary hover:underline"
              >
                clear filters →
              </button>
            </div>
          </div>
        ) : (
          <>
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(48px, 1fr))",
              }}
            >
              {cells.map((c) => (
                <WallCell key={c.id} company={c} />
              ))}
            </div>
            {total > MAX_CELLS && (
              <div className="mt-6 text-center font-mono text-[10px] text-muted-foreground">
                showing {MAX_CELLS} of {total.toLocaleString()} · refine filter
                to see more
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PillButton({
  children,
  active,
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
        "rounded border px-2 py-0.5 transition-colors",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

interface TipPos {
  left: number;
  top: number;
  flip: boolean; // true → place tooltip to the LEFT of the cell
}

const TOOLTIP_W = 224;
// Cell scales to 1.5x on hover (origin: center). Half of growth is 12px on
// each side at 48px cell size, so we need at least 12px gap to clear it.
const TOOLTIP_GAP = 18;

function WallCell({ company }: { company: Company }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [tip, setTip] = useState<TipPos | null>(null);

  const open = () => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const roomRight = window.innerWidth - rect.right;
    const flip = roomRight < TOOLTIP_W + TOOLTIP_GAP + 8;
    const left = flip
      ? Math.max(8, rect.left - TOOLTIP_GAP - TOOLTIP_W)
      : rect.right + TOOLTIP_GAP;
    const top = Math.min(
      Math.max(8, rect.top),
      window.innerHeight - 8 - 140,
    );
    setTip({ left, top, flip });
  };
  const close = () => setTip(null);

  return (
    <>
      <button
        ref={ref}
        type="button"
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={close}
        onClick={() => {
          // TODO(Prompt 7): open the company detail drawer for `company`.
        }}
        className={cn(
          "group/cell relative block size-12 origin-center rounded-sm",
          // No bg when there's an image; transparent PNGs sit directly
          // on canvas so non-square logos don't show a phantom square.
          !company.small_logo_thumb_url && "bg-muted/40",
          "transition-transform duration-150 ease-out",
          "hover:z-20 hover:scale-[1.5]",
        )}
        aria-label={`${company.name} · ${batchToShort(company.batch)}`}
      >
        {company.small_logo_thumb_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={company.small_logo_thumb_url}
            alt={company.name}
            loading="lazy"
            // drop-shadow follows the image's alpha mask so transparent
            // PNGs get an outline that traces the logo silhouette.
            className={cn(
              "size-full rounded-sm object-contain",
              "transition-[filter] duration-150",
              "group-hover/cell:[filter:drop-shadow(0_0_2px_var(--primary))_drop-shadow(0_0_4px_var(--primary))]",
            )}
          />
        ) : (
          <span className="grid size-full place-items-center font-mono text-[10px] text-muted-foreground transition-[filter] duration-150 group-hover/cell:[filter:drop-shadow(0_0_3px_var(--primary))]">
            {company.name.slice(0, 2)}
          </span>
        )}
      </button>
      {tip &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-[100] rounded border border-border bg-card p-2 font-mono text-[10px]"
            style={{ left: tip.left, top: tip.top, width: TOOLTIP_W }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-foreground">{company.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {batchToShort(company.batch)}
              </span>
            </div>
            {company.one_liner && (
              <div className="mt-1 line-clamp-3 leading-snug text-muted-foreground">
                {company.one_liner}
              </div>
            )}
            {company.tags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {company.tags.slice(0, 5).map((t) => (
                  <span
                    key={t}
                    className="rounded border border-border bg-muted/40 px-1 py-px text-[9px] text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
