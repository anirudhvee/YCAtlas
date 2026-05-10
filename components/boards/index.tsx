"use client";

import { useMemo } from "react";
import { useCompanies } from "@/components/companies-provider";
import { useUi } from "@/lib/store";
import { useFilters } from "@/lib/url-state";
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
  const { filters, setFilters, toggleArrayFilter } = useFilters();
  const setSelectedCompany = useUi((s) => s.setSelectedCompany);

  const data = useMemo(() => {
    const activeBatches = new Set(filters.batches);
    const activeRegions = new Set(filters.regions);
    const activeTags = new Set(filters.tags);

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

    const publicCompanies = all
      .filter(
        (c) =>
          c.status === "Public" &&
          typeof c.team_size === "number" &&
          c.team_size > 0,
      );

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
      publicCompanies,
      tags,
      latest,
      longestRunning,
      activeBatches,
      activeRegions,
      activeTags,
    };
  }, [all, filters]);

  return (
    <div className="scroll-fine h-full overflow-x-hidden overflow-y-auto">
      <div className="mx-auto max-w-[1480px] px-4 pb-7 pt-4 sm:px-5 sm:pt-5">
        <div className="page-head">
          <div>
            <div className="eyebrow">Boards · all-time leaderboards</div>
            <h1>Who&apos;s on top</h1>
            <div className="sub">
              Six all-time leaderboards. They ignore the active filters; click
              a row to filter the rest of Atlas.
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-[14px] md:grid-cols-2 lg:grid-cols-3">
        <TopBatchesBoard
          rows={data.topBatches}
          activeBatches={data.activeBatches}
          onToggle={(b) => toggleArrayFilter("batches", b)}
        />
        <LargestBoard
          rows={data.largest}
          onSelect={(c) => setSelectedCompany(c)}
        />
        <RegionsBoard
          rows={data.regions}
          activeRegions={data.activeRegions}
          onToggle={(r) => toggleArrayFilter("regions", r)}
        />
        <IpoWallBoard
          companies={data.publicCompanies}
          onSelect={(c) => setSelectedCompany(c)}
        />
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
    <div className="flex h-[290px] flex-col rounded-[10px] border border-border bg-card p-3 transition-colors hover:border-[color:var(--border-strong)] sm:p-3.5">
      <div className="mb-2.5 flex items-baseline justify-between gap-2 sm:mb-3">
        <div className="min-w-0 flex-1 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-foreground sm:tracking-[0.18em]">
          {title}
        </div>
        {caption && (
          <div className="shrink-0 font-mono text-[9px] tabular-nums text-muted-foreground">
            {caption}
          </div>
        )}
      </div>
      <div className="scroll-fine min-h-0 flex-1 overflow-y-auto">{children}</div>
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
      title="Most decorated batches · % top company"
      caption="batches ≥5y old"
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

function LargestBoard({
  rows,
  onSelect,
}: {
  rows: Company[];
  onSelect: (c: Company) => void;
}) {
  const max = rows[0]?.team_size ?? 1;
  return (
    <BoardCard title="Largest companies by team size" caption="dot color = status">
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
                onClick={() => onSelect(c)}
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

function IpoWallBoard({
  companies,
  onSelect,
}: {
  companies: Company[];
  onSelect: (c: Company) => void;
}) {
  const rows = useMemo(
    () =>
      [...companies]
        .sort((a, b) => (b.team_size ?? 0) - (a.team_size ?? 0))
        .slice(0, 8),
    [companies],
  );

  const totalPublic = companies.length;
  const max = rows[0]?.team_size ?? 1;

  return (
    <BoardCard
      title="YC IPO wall · public companies"
      caption={`${totalPublic} all-time · by team size`}
    >
      <div className="flex flex-col gap-1">
        {rows.length === 0 ? (
          <Empty msg="No companies match" />
        ) : (
          rows.map((c, i) => {
            const team = c.team_size ?? 0;
            const t = max > 0 ? team / max : 0;
            const dotPx = Math.min(16, 6 + Math.sqrt(Math.max(0, t)) * 10);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(c)}
                className="group/row flex w-full items-center gap-2 rounded-sm py-1 pl-1 pr-2 text-left font-mono text-[11px] tabular-nums transition-colors hover:bg-muted/50"
              >
                <span className="w-4 text-right text-muted-foreground/60">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  aria-hidden
                  className="grid w-5 shrink-0 place-items-center"
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
                    className="size-4 shrink-0 rounded-sm object-contain"
                  />
                ) : (
                  <span className="size-4 shrink-0 rounded-sm bg-muted/40" />
                )}
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {c.name}
                </span>
                <span className="text-muted-foreground">
                  {batchToShort(c.batch)}
                </span>
                <span className="w-10 text-right text-foreground">
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
      title="Mature batches · survival rate"
      caption="oldest 12 batches"
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
