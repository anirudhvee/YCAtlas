"use client";

import { useMemo } from "react";
import { useCompanies } from "@/components/companies-provider";
import { useUi } from "@/lib/store";
import { useMounted } from "@/lib/use-mounted";
import {
  STATUS_COLORS,
  aggregateByBatch,
  aggregatesAboveMinSize,
  aggregatesExcludingUnspecified,
  primaryRegion,
  topBatchesByPctTopCompany,
} from "@/lib/overview-data";
import type { Company, CompanyStatus } from "@/lib/types";
import { batchToShort, batchToSortKey, cn } from "@/lib/utils";

const TAG_ALIAS: Record<string, string> = {
  "Artificial Intelligence": "AI",
  "Generative AI": "AI",
  "Machine Learning": "AI",
  AIOps: "AI",
  ML: "AI",
  DevTools: "Developer Tools",
  "Climate Tech": "Climate",
  Web3: "Crypto / Web3",
  Crypto: "Crypto / Web3",
  Blockchain: "Crypto / Web3",
};
const aliasTag = (t: string) => TAG_ALIAS[t] ?? t;

export function Boards() {
  const all = useCompanies();
  const filters = useUi((s) => s.filters);
  const setFilters = useUi((s) => s.setFilters);
  const toggleArrayFilter = useUi((s) => s.toggleArrayFilter);
  const mounted = useMounted();

  const data = useMemo(() => {
    const activeBatches = mounted
      ? new Set(filters.batches)
      : new Set<string>();
    const activeRegions = mounted
      ? new Set(filters.regions)
      : new Set<string>();
    const activeTags = mounted ? new Set(filters.tags) : new Set<string>();

    const topBatches = topBatchesByPctTopCompany(all, 8);

    const largest = all
      .filter((c) => typeof c.team_size === "number" && c.team_size > 0)
      .sort((a, b) => (b.team_size ?? 0) - (a.team_size ?? 0))
      .slice(0, 8);

    const regionMap = new Map<string, number>();
    for (const c of all) {
      const r = primaryRegion(c);
      if (!r) continue;
      regionMap.set(r, (regionMap.get(r) ?? 0) + 1);
    }
    const regions = [...regionMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    // yc-oss lists the current name in `former_names` for ~350 cos;
    // skip the self-reference or the row reads "Wave → Wave".
    const pivots = all
      .filter((c) => {
        const real = c.former_names.find(
          (n) => n.trim().toLowerCase() !== c.name.trim().toLowerCase(),
        );
        return Boolean(real);
      })
      .map((c) => ({
        ...c,
        firstFormerName:
          c.former_names.find(
            (n) => n.trim().toLowerCase() !== c.name.trim().toLowerCase(),
          ) ?? c.former_names[0],
      }))
      .sort((a, b) => (b.team_size ?? 0) - (a.team_size ?? 0))
      .slice(0, 8);

    const aggs = aggregatesAboveMinSize(
      aggregatesExcludingUnspecified(aggregateByBatch(all)),
    );
    const latest =
      aggs.length === 0
        ? null
        : aggs.reduce((best, a) =>
            batchToSortKey(a.batch) > batchToSortKey(best.batch) ? a : best,
          );
    const tagCounts = new Map<string, number>();
    if (latest) {
      for (const c of all) {
        if (c.batch !== latest.batch) continue;
        const seen = new Set<string>();
        for (const t of c.tags) {
          const a = aliasTag(t);
          if (seen.has(a)) continue;
          seen.add(a);
          tagCounts.set(a, (tagCounts.get(a) ?? 0) + 1);
        }
      }
    }
    const tags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);

    // 12 oldest still-active batches, then top 8 by survival rate
    // so rank order matches bar length.
    const longestRunning = aggregatesAboveMinSize(
      aggregatesExcludingUnspecified(aggregateByBatch(all)),
    )
      .filter((a) => a.byStatus.Active >= 1)
      .sort((a, b) => batchToSortKey(a.batch) - batchToSortKey(b.batch))
      .slice(0, 12)
      .sort((a, b) => b.byStatus.Active / b.total - a.byStatus.Active / a.total)
      .slice(0, 8);

    return {
      topBatches,
      largest,
      regions,
      pivots,
      tags,
      latest,
      longestRunning,
      activeBatches,
      activeRegions,
      activeTags,
    };
  }, [all, mounted, filters]);

  return (
    <div className="h-full overflow-y-auto" style={{ paddingBottom: "60px" }}>
      <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2 lg:grid-cols-3">
        <TopBatchesBoard
          rows={data.topBatches}
          activeBatches={data.activeBatches}
          onToggle={(b) => toggleArrayFilter("batches", b)}
        />
        <LargestBoard rows={data.largest} />
        <RegionsBoard
          rows={data.regions}
          activeRegions={data.activeRegions}
          onToggle={(r) => toggleArrayFilter("regions", r)}
        />
        <PivotsBoard rows={data.pivots} />
        <TagsBoard
          rows={data.tags}
          latestBatch={data.latest?.batch ?? null}
          activeTags={data.activeTags}
          onToggle={(t) => toggleArrayFilter("tags", t)}
        />
        <LongestRunningBoard
          rows={data.longestRunning}
          activeBatches={data.activeBatches}
          onSelect={(b) => setFilters({ batches: [b] })}
        />
      </div>
    </div>
  );
}

function BoardCard({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-[280px] flex-col rounded border border-border bg-card p-3.5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground">
          {title}
        </div>
        {caption && (
          <div className="font-mono text-[9px] tabular-nums text-muted-foreground">
            {caption}
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

function GaugeRow({
  rank,
  label,
  rightLabel,
  ratio,
  isActive,
  onClick,
  anchor = "left",
}: {
  rank: number;
  label: string;
  rightLabel: string;
  ratio: number; // 0..1
  isActive: boolean;
  onClick: () => void;
  anchor?: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group/row grid w-full grid-cols-[18px_minmax(56px,140px)_1fr_auto] items-center gap-2 rounded-sm py-1.5 pl-1 pr-2 text-left font-mono text-[11px] tabular-nums transition-colors",
        isActive ? "bg-primary/10" : "hover:bg-muted/50",
      )}
    >
      <span
        className={cn(
          "text-right",
          isActive ? "text-primary" : "text-muted-foreground/60",
        )}
      >
        {String(rank).padStart(2, "0")}
      </span>
      <span
        className={cn(
          "truncate",
          isActive ? "text-primary" : "text-foreground",
        )}
        title={label}
      >
        {label}
      </span>
      <span className="relative h-1.5 w-full overflow-hidden rounded-sm bg-muted/60">
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-0 transition-colors",
            anchor === "right" ? "right-0" : "left-0",
            isActive
              ? "bg-primary"
              : "bg-primary/50 group-hover/row:bg-primary",
          )}
          style={{ width: `${Math.max(2, ratio * 100)}%` }}
        />
      </span>
      <span className="text-foreground">{rightLabel}</span>
    </button>
  );
}

function TopBatchesBoard({
  rows,
  activeBatches,
  onToggle,
}: {
  rows: ReturnType<typeof topBatchesByPctTopCompany>;
  activeBatches: Set<string>;
  onToggle: (batch: string) => void;
}) {
  const max = rows[0]?.pctTopCompany ?? 1;
  return (
    <BoardCard
      title="Top batches by % top companies"
      caption={`top ${rows.length}`}
    >
      <div className="flex flex-col gap-px">
        {rows.length === 0 ? (
          <Empty msg="Not enough data" />
        ) : (
          rows.map((a, i) => (
            <GaugeRow
              key={a.batch}
              rank={i + 1}
              label={a.short}
              rightLabel={`${a.pctTopCompany.toFixed(1)}%`}
              ratio={max > 0 ? a.pctTopCompany / max : 0}
              isActive={activeBatches.has(a.batch)}
              onClick={() => onToggle(a.batch)}
            />
          ))
        )}
      </div>
    </BoardCard>
  );
}

function LargestBoard({ rows }: { rows: Company[] }) {
  const max = rows[0]?.team_size ?? 1;
  return (
    <BoardCard title="Largest companies by team size" caption="• by status">
      <div className="flex flex-col gap-1">
        {rows.length === 0 ? (
          <Empty msg="No companies match" />
        ) : (
          rows.map((c, i) => {
            const team = c.team_size ?? 0;
            const t = max > 0 ? team / max : 0;
            const dotPx = 10 + Math.sqrt(t) * 22;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  // TODO(detail-drawer): open detail drawer.
                }}
                className="group/row flex w-full items-center gap-3 rounded-sm py-1 pl-1 pr-2 text-left font-mono text-[11px] tabular-nums transition-colors hover:bg-muted/50"
              >
                <span className="w-4 text-right text-muted-foreground/60">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  aria-hidden
                  className="grid w-9 shrink-0 place-items-center"
                >
                  <span
                    className="block rounded-full transition-transform group-hover/row:scale-110"
                    style={{
                      width: dotPx,
                      height: dotPx,
                      backgroundColor: STATUS_COLORS[c.status as CompanyStatus],
                      boxShadow: `0 0 0 1px ${STATUS_COLORS[c.status as CompanyStatus]}40`,
                    }}
                  />
                </span>
                {c.small_logo_thumb_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.small_logo_thumb_url}
                    alt=""
                    loading="lazy"
                    className="size-5 shrink-0 rounded-sm object-contain"
                  />
                ) : (
                  <span className="size-5 shrink-0 rounded-sm bg-muted/40" />
                )}
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {c.name}
                </span>
                <span className="text-foreground">
                  {team.toLocaleString()}
                </span>
              </button>
            );
          })
        )}
      </div>
    </BoardCard>
  );
}

function RegionsBoard({
  rows,
  activeRegions,
  onToggle,
}: {
  rows: [string, number][];
  activeRegions: Set<string>;
  onToggle: (region: string) => void;
}) {
  const max = rows[0]?.[1] ?? 1;
  return (
    <BoardCard title="Top regions by company count" caption={`top ${rows.length}`}>
      <div className="flex flex-col gap-px">
        {rows.length === 0 ? (
          <Empty msg="No regions match" />
        ) : (
          rows.map(([name, count], i) => (
            <GaugeRow
              key={name}
              rank={i + 1}
              label={name}
              rightLabel={count.toLocaleString()}
              ratio={max > 0 ? count / max : 0}
              isActive={activeRegions.has(name)}
              onClick={() => onToggle(name)}
            />
          ))
        )}
      </div>
    </BoardCard>
  );
}

type PivotRow = Company & { firstFormerName: string };

function PivotsBoard({ rows }: { rows: PivotRow[] }) {
  return (
    <BoardCard title="Notable pivots" caption="renamed">
      <div className="flex flex-col gap-1">
        {rows.length === 0 ? (
          <Empty msg="No pivots match" />
        ) : (
          rows.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                // TODO(detail-drawer): open detail drawer.
              }}
              className="group/row grid w-full grid-cols-[18px_1fr_12px_1fr_auto] items-center gap-2 rounded-sm py-1.5 pl-1 pr-2 text-left font-mono text-[10.5px] tabular-nums transition-colors hover:bg-muted/50"
            >
              <span className="text-right text-muted-foreground/60">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 truncate text-muted-foreground">
                {c.firstFormerName}
              </span>
              <span className="text-center text-muted-foreground/40">→</span>
              <span className="flex min-w-0 items-center gap-1.5">
                {c.small_logo_thumb_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.small_logo_thumb_url}
                    alt=""
                    loading="lazy"
                    className="size-4 shrink-0 rounded-sm object-contain"
                  />
                ) : null}
                <span className="truncate text-foreground">{c.name}</span>
              </span>
              <span className="text-muted-foreground">
                {batchToShort(c.batch)}
              </span>
            </button>
          ))
        )}
      </div>
    </BoardCard>
  );
}

function TagsBoard({
  rows,
  latestBatch,
  activeTags,
  onToggle,
}: {
  rows: [string, number][];
  latestBatch: string | null;
  activeTags: Set<string>;
  onToggle: (tag: string) => void;
}) {
  const max = rows[0]?.[1] ?? 1;
  return (
    <BoardCard
      title={`Top tags${latestBatch ? ` · ${batchToShort(latestBatch)}` : ""}`}
      caption="latest batch"
    >
      {rows.length === 0 ? (
        <Empty msg="No tags match" />
      ) : (
        <div className="flex flex-wrap content-start gap-1.5">
          {rows.map(([t, count]) => {
            const filterTag = t === "AI" ? "Artificial Intelligence" : t;
            const isActive = activeTags.has(filterTag);
            const ratio = max > 0 ? count / max : 0;
            const px = 11 + Math.sqrt(ratio) * 5;
            return (
              <button
                key={t}
                type="button"
                onClick={() => onToggle(filterTag)}
                className={cn(
                  "rounded border px-2 py-0.5 font-mono leading-tight tabular-nums transition-colors",
                  isActive
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-muted/40 text-foreground hover:border-foreground/30",
                )}
                style={{ fontSize: `${px}px` }}
              >
                <span>{t}</span>
                <span className="ml-1.5 text-muted-foreground">
                  {count.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </BoardCard>
  );
}

function LongestRunningBoard({
  rows,
  activeBatches,
  onSelect,
}: {
  rows: ReturnType<typeof aggregateByBatch>;
  activeBatches: Set<string>;
  onSelect: (batch: string) => void;
}) {
  const survivalPcts = rows.map((a) => (a.byStatus.Active / a.total) * 100);
  const maxSurvival = Math.max(1, ...survivalPcts);
  return (
    <BoardCard
      title="Old batches · survival rate"
      caption="oldest 12 cohorts"
    >
      <div className="flex flex-col gap-px">
        {rows.length === 0 ? (
          <Empty msg="No batches match" />
        ) : (
          rows.map((a, i) => {
            const survivalPct = survivalPcts[i];
            const ratio = survivalPct / maxSurvival;
            return (
              <GaugeRow
                key={a.batch}
                rank={i + 1}
                label={a.short}
                rightLabel={`${a.byStatus.Active} of ${a.total} · ${survivalPct.toFixed(0)}%`}
                ratio={ratio}
                isActive={activeBatches.has(a.batch)}
                onClick={() => onSelect(a.batch)}
              />
            );
          })
        )}
      </div>
    </BoardCard>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="grid h-full place-items-center font-mono text-[10px] text-muted-foreground">
      {msg}
    </div>
  );
}
