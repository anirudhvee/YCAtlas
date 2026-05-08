"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { useCompanies } from "@/components/companies-provider";
import { filterCompanies, useUi } from "@/lib/store";
import { useMounted } from "@/lib/use-mounted";
import {
  MIN_BATCH_SIZE,
  STATUS_COLORS,
  STATUS_KEYS,
  primaryRegion,
} from "@/lib/overview-data";
import type { Company, CompanyStatus } from "@/lib/types";
import { batchToShort, batchToSortKey, cn } from "@/lib/utils";

type Metric =
  | "status"
  | "stage"
  | "industry"
  | "team_size"
  | "top_company"
  | "region";

const METRIC_OPTIONS: {
  id: Metric;
  label: string;
  hint: string;
}[] = [
  {
    id: "status",
    label: "by status",
    hint: "alive vs failed vs exited per batch",
  },
  {
    id: "stage",
    label: "by stage",
    hint: "Seed / Early / Growth / Public per batch",
  },
  {
    id: "industry",
    label: "by industry",
    hint: "industry mix per batch",
  },
  {
    id: "team_size",
    label: "team size",
    hint: "total employees added per batch",
  },
  {
    id: "top_company",
    label: "% top",
    hint: "share of each batch flagged top-company",
  },
  {
    id: "region",
    label: "by region",
    hint: "country mix per batch",
  },
];

const STAGE_KEYS = ["Seed", "Early", "Growth", "Public"] as const;
const STAGE_COLORS: Record<string, string> = {
  Seed: "#33b1ff",
  Early: "#5cc8a8",
  Growth: "#d4a93c",
  Public: "#a855f7",
};

const SERIES_COLORS = [
  "#8a8df0",
  "#33b1ff",
  "#5cc8a8",
  "#d4a93c",
  "#e87aa8",
  "#9bd16a",
  "#b483e8",
  "#64748b",
  "#0891b2",
];

interface BatchBucket {
  batch: string;
  short: string;
  total: number;
  companies: Company[];
}

function buildBatchBuckets(companies: Company[]): BatchBucket[] {
  const map = new Map<string, BatchBucket>();
  for (const c of companies) {
    if (c.batch === "Unspecified") continue;
    let b = map.get(c.batch);
    if (!b) {
      b = {
        batch: c.batch,
        short: batchToShort(c.batch),
        total: 0,
        companies: [],
      };
      map.set(c.batch, b);
    }
    b.companies.push(c);
    b.total++;
  }
  return [...map.values()]
    .filter((b) => b.total >= MIN_BATCH_SIZE)
    .sort((a, b) => batchToSortKey(a.batch) - batchToSortKey(b.batch));
}

interface BuiltSeries {
  rows: Record<string, string | number>[];
  keys: string[];
  colors: Record<string, string>;
  stacked: boolean;
  yLabel: string;
}

function buildSeries(buckets: BatchBucket[], metric: Metric): BuiltSeries {
  if (metric === "status") {
    const keys = [...STATUS_KEYS];
    const rows = buckets.map((b) => {
      const counts = { Active: 0, Inactive: 0, Acquired: 0, Public: 0 };
      for (const c of b.companies) counts[c.status]++;
      return { short: b.short, batch: b.batch, ...counts };
    });
    const colors: Record<string, string> = {};
    for (const k of keys) colors[k] = STATUS_COLORS[k as CompanyStatus];
    return { rows, keys, colors, stacked: true, yLabel: "companies" };
  }

  if (metric === "stage") {
    const seen = new Set<string>();
    for (const b of buckets) for (const c of b.companies) seen.add(c.stage);
    const keys: string[] = STAGE_KEYS.filter((k) => seen.has(k));
    for (const s of seen) if (!keys.includes(s)) keys.push(s);
    const rows = buckets.map((b) => {
      const row: Record<string, string | number> = {
        short: b.short,
        batch: b.batch,
      };
      for (const k of keys) row[k] = 0;
      for (const c of b.companies) {
        if (keys.includes(c.stage)) {
          row[c.stage] = (row[c.stage] as number) + 1;
        }
      }
      return row;
    });
    const colors: Record<string, string> = {};
    keys.forEach((k, i) => {
      colors[k] = STAGE_COLORS[k] ?? SERIES_COLORS[i % SERIES_COLORS.length];
    });
    return { rows, keys, colors, stacked: true, yLabel: "companies" };
  }

  if (metric === "industry" || metric === "region") {
    const totals = new Map<string, number>();
    for (const b of buckets) {
      for (const c of b.companies) {
        const v = metric === "industry" ? c.industry || "Unknown" : primaryRegion(c);
        if (!v) continue;
        totals.set(v, (totals.get(v) ?? 0) + 1);
      }
    }
    const top = [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([k]) => k);
    const topSet = new Set(top);
    const keys = [...top, "Other"];
    const rows = buckets.map((b) => {
      const row: Record<string, string | number> = {
        short: b.short,
        batch: b.batch,
      };
      for (const k of keys) row[k] = 0;
      for (const c of b.companies) {
        const v = metric === "industry" ? c.industry || "Unknown" : primaryRegion(c);
        if (!v) continue;
        const bucket = topSet.has(v) ? v : "Other";
        row[bucket] = (row[bucket] as number) + 1;
      }
      return row;
    });
    const colors: Record<string, string> = {};
    keys.forEach((k, i) => {
      colors[k] = k === "Other" ? "#64748b" : SERIES_COLORS[i % SERIES_COLORS.length];
    });
    return { rows, keys, colors, stacked: true, yLabel: "companies" };
  }

  if (metric === "team_size") {
    const rows = buckets.map((b) => {
      let total = 0;
      for (const c of b.companies) total += c.team_size ?? 0;
      return { short: b.short, batch: b.batch, total };
    });
    return {
      rows,
      keys: ["total"],
      colors: { total: "#33b1ff" },
      stacked: false,
      yLabel: "headcount",
    };
  }

  const rows = buckets.map((b) => {
    let n = 0;
    for (const c of b.companies) if (c.top_company === true) n++;
    const pct = b.total > 0 ? (n / b.total) * 100 : 0;
    return { short: b.short, batch: b.batch, pct };
  });
  return {
    rows,
    keys: ["pct"],
    colors: { pct: "var(--primary)" },
    stacked: false,
    yLabel: "% top company",
  };
}

const FATE_ORDER: CompanyStatus[] = [
  "Inactive",
  "Acquired",
  "Public",
  "Active",
];

interface FateRow {
  short: string;
  batch: string;
  total: number;
  Active: number;
  Inactive: number;
  Acquired: number;
  Public: number;
  exitPct: number;
  activePct: number;
}

function buildFates(buckets: BatchBucket[]): FateRow[] {
  return buckets.map((b) => {
    const counts = { Active: 0, Inactive: 0, Acquired: 0, Public: 0 };
    for (const c of b.companies) counts[c.status]++;
    const t = b.total || 1;
    return {
      short: b.short,
      batch: b.batch,
      total: b.total,
      Active: (counts.Active / t) * 100,
      Inactive: (counts.Inactive / t) * 100,
      Acquired: (counts.Acquired / t) * 100,
      Public: (counts.Public / t) * 100,
      exitPct: ((counts.Acquired + counts.Public) / t) * 100,
      activePct: (counts.Active / t) * 100,
    };
  });
}

export function Timeline() {
  const all = useCompanies();
  const filters = useUi((s) => s.filters);
  const mounted = useMounted();

  const [metric, setMetric] = useState<Metric>("status");

  // Time-series view: strip the batches filter so the selected
  // batch shows as a ReferenceLine instead of collapsing the chart.
  const filteredForTimeline = useMemo(
    () => filterCompanies(all, { ...filters, batches: [] }),
    [all, filters],
  );

  const buckets = useMemo(
    () => buildBatchBuckets(filteredForTimeline),
    [filteredForTimeline],
  );
  const series = useMemo(() => buildSeries(buckets, metric), [buckets, metric]);
  const fates = useMemo(() => buildFates(buckets), [buckets]);

  const selectedBatch =
    mounted && filters.batches.length === 1 ? filters.batches[0] : null;

  const tickInterval = Math.max(0, Math.floor(series.rows.length / 10) - 1);

  const totals = useMemo(() => {
    let active = 0;
    let inactive = 0;
    let acquired = 0;
    let pub = 0;
    let topCo = 0;
    for (const c of filteredForTimeline) {
      if (c.status === "Active") active++;
      else if (c.status === "Inactive") inactive++;
      else if (c.status === "Acquired") acquired++;
      else if (c.status === "Public") pub++;
      if (c.top_company === true) topCo++;
    }
    return {
      total: filteredForTimeline.length,
      active,
      inactive,
      acquired,
      pub,
      topCo,
    };
  }, [filteredForTimeline]);

  const insights = useMemo(() => {
    if (fates.length === 0) {
      return { bestActive: null, mostExits: null } as const;
    }
    // Drop the 3 most recent batches; too immature for honest claims.
    const matureCutoff = Math.max(0, fates.length - 3);
    const mature = fates.slice(0, matureCutoff);
    const pool = mature.length > 0 ? mature : fates;
    const bestActive = pool.reduce((a, b) =>
      a.activePct > b.activePct ? a : b,
    );
    const mostExits = pool.reduce((a, b) => (a.exitPct > b.exitPct ? a : b));
    return { bestActive, mostExits };
  }, [fates]);

  const firstBatch = buckets[0]?.short ?? "—";
  const lastBatch = buckets[buckets.length - 1]?.short ?? "—";
  const activeMetric = METRIC_OPTIONS.find((o) => o.id === metric)!;

  return (
    <div className="flex h-full flex-col" style={{ paddingBottom: "60px" }}>
      <div className="border-b border-border bg-card/40 px-6 py-3">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Timeline
            </div>
            <div className="mt-1 text-sm text-foreground">
              How YC has grown across{" "}
              <span className="font-mono tabular-nums">
                {buckets.length}
              </span>{" "}
              batches ·{" "}
              <span className="font-mono tabular-nums text-muted-foreground">
                {firstBatch} → {lastBatch}
              </span>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-baseline gap-x-3 gap-y-0.5 font-mono text-[10px] tabular-nums">
            <Stat label="total" value={totals.total} />
            <StatColored
              color={STATUS_COLORS.Active}
              label="active"
              value={totals.active}
            />
            <StatColored
              color={STATUS_COLORS.Acquired}
              label="acquired"
              value={totals.acquired}
            />
            <StatColored
              color={STATUS_COLORS.Public}
              label="public"
              value={totals.pub}
            />
            <StatColored
              color={STATUS_COLORS.Inactive}
              label="inactive"
              value={totals.inactive}
            />
            <Stat label="top YC" value={totals.topCo} />
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div className="flex min-h-[280px] flex-[3] flex-col rounded border border-border bg-card p-3">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground">
                Companies per batch
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                {activeMetric.hint}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
              {METRIC_OPTIONS.map((opt) => {
                const active = metric === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMetric(opt.id)}
                    className={cn(
                      "rounded border px-2 py-0.5 transition-colors",
                      active
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="min-h-0 flex-1">
            {series.rows.length === 0 ? (
              <div className="grid h-full place-items-center font-mono text-[10px] text-muted-foreground">
                Not enough data · refine filter
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={series.rows}
                  margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                >
                  <CartesianGrid
                    stroke="var(--border)"
                    strokeOpacity={0.4}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="short"
                    tick={{
                      fill: "var(--muted-foreground)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                    }}
                    axisLine={false}
                    tickLine={false}
                    interval={tickInterval}
                  />
                  <YAxis
                    tick={{
                      fill: "var(--muted-foreground)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                    }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                    tickFormatter={(v) =>
                      metric === "top_company"
                        ? `${Math.round(Number(v))}%`
                        : Number(v).toLocaleString()
                    }
                  />
                  <Tooltip
                    cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                    content={(props) => (
                      <SeriesTooltip {...props} metric={metric} />
                    )}
                  />
                  {selectedBatch && (
                    <ReferenceLine
                      x={batchToShort(selectedBatch)}
                      stroke="var(--primary)"
                      strokeWidth={1.5}
                      ifOverflow="extendDomain"
                    />
                  )}
                  {series.keys.map((k) => (
                    <Area
                      key={k}
                      type="monotone"
                      dataKey={k}
                      stackId={series.stacked ? "1" : undefined}
                      stroke={series.stacked ? "none" : series.colors[k]}
                      strokeWidth={series.stacked ? 0 : 1.8}
                      fill={series.colors[k]}
                      fillOpacity={series.stacked ? 0.85 : 0.18}
                      isAnimationActive={false}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          {series.stacked && series.keys.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[9px] text-muted-foreground">
              {series.keys.map((k) => (
                <span key={k} className="flex items-center gap-1">
                  <span
                    className="size-2 rounded-sm"
                    style={{ backgroundColor: series.colors[k] }}
                  />
                  {k}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex min-h-[220px] flex-[2] flex-col rounded border border-border bg-card p-3">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground">
                Where each batch ended up
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                share alive · acquired · IPO&apos;d · shut down — by batch
              </div>
            </div>
            {insights.bestActive && insights.mostExits && (
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                <span>
                  highest survival{" "}
                  <span className="text-foreground">
                    {insights.bestActive.short}
                  </span>{" "}
                  {insights.bestActive.activePct.toFixed(0)}%
                </span>
                <span>
                  most exits{" "}
                  <span className="text-foreground">
                    {insights.mostExits.short}
                  </span>{" "}
                  {insights.mostExits.exitPct.toFixed(0)}%
                </span>
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1">
            {fates.length === 0 ? (
              <div className="grid h-full place-items-center font-mono text-[10px] text-muted-foreground">
                Not enough data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={fates}
                  margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                  stackOffset="expand"
                >
                  <CartesianGrid
                    stroke="var(--border)"
                    strokeOpacity={0.35}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="short"
                    tick={{
                      fill: "var(--muted-foreground)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                    }}
                    axisLine={false}
                    tickLine={false}
                    interval={tickInterval}
                  />
                  <YAxis
                    tick={{
                      fill: "var(--muted-foreground)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                    }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                    tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`}
                    domain={[0, 1]}
                  />
                  <Tooltip
                    cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                    content={FateTooltip}
                  />
                  {selectedBatch && (
                    <ReferenceLine
                      x={batchToShort(selectedBatch)}
                      stroke="var(--primary)"
                      strokeWidth={1.5}
                      ifOverflow="extendDomain"
                    />
                  )}
                  {FATE_ORDER.map((k) => (
                    <Area
                      key={k}
                      type="monotone"
                      dataKey={k}
                      stackId="1"
                      fill={STATUS_COLORS[k]}
                      fillOpacity={0.78}
                      stroke="none"
                      isAnimationActive={false}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[9px] text-muted-foreground">
            {FATE_ORDER.slice()
              .reverse()
              .map((k) => (
                <span key={k} className="flex items-center gap-1">
                  <span
                    className="size-2 rounded-sm"
                    style={{ backgroundColor: STATUS_COLORS[k] }}
                  />
                  {k}
                </span>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className="text-foreground">{value.toLocaleString()}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

function StatColored({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-foreground">{value.toLocaleString()}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

function SeriesTooltip({
  active,
  payload,
  label,
  metric,
}: TooltipContentProps & { metric: Metric }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded border border-border bg-card px-2 py-1.5 font-mono text-[10px] leading-tight tabular-nums">
      <div className="mb-1 text-foreground">{label}</div>
      {payload.map((p) => {
        const key = String(p.dataKey ?? "");
        const v = Number(p.value ?? 0);
        return (
          <div
            key={key}
            className="flex items-center gap-2"
            style={{ color: p.color as string }}
          >
            <span className="w-20 truncate">{key}</span>
            <span className="text-foreground">
              {metric === "top_company"
                ? `${v.toFixed(1)}%`
                : v.toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function FateTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0]?.payload as FateRow | undefined;
  if (!row) return null;
  return (
    <div className="rounded border border-border bg-card px-2 py-1.5 font-mono text-[10px] leading-tight tabular-nums">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-foreground">{label}</span>
        <span className="text-muted-foreground">n={row.total}</span>
      </div>
      {FATE_ORDER.slice()
        .reverse()
        .map((k) => (
          <div
            key={k}
            className="flex items-center gap-2"
            style={{ color: STATUS_COLORS[k] }}
          >
            <span className="w-16">{k}</span>
            <span className="text-foreground">{row[k].toFixed(1)}%</span>
          </div>
        ))}
    </div>
  );
}
