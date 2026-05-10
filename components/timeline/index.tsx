"use client";

import { useMemo } from "react";
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
import { filterCompanies, useUi, type TimelineMetric } from "@/lib/store";
import { useMounted } from "@/lib/use-mounted";
import {
  MIN_BATCH_SIZE,
  STATUS_COLORS,
  STATUS_KEYS,
  isMatureBatch,
  primaryRegion,
} from "@/lib/overview-data";
import type { Company, CompanyStatus } from "@/lib/types";
import { batchToShort, batchToSortKey, cn } from "@/lib/utils";

type Metric = TimelineMetric;

const INTL_META = new Set([
  "Remote",
  "Fully Remote",
  "Partly Remote",
  "Unspecified",
  "Worldwide",
  "Global",
  "America / Canada",
  "Europe",
  "Asia",
  "Africa",
  "Oceania",
  "Latin America",
  "Middle East",
  "South Asia",
]);
const INTL_US = new Set(["United States of America", "USA"]);
function classifyIntl(c: Company): "us" | "nonus" | null {
  let hasUs = false;
  let hasNonUs = false;
  for (const r of c.regions) {
    if (INTL_US.has(r)) hasUs = true;
    else if (!INTL_META.has(r)) hasNonUs = true;
  }
  if (hasUs) return "us";
  if (hasNonUs) return "nonus";
  return null;
}

interface MetricOption {
  id: Metric;
  label: string;
  hint: string;
}

const OUTCOME_METRICS: MetricOption[] = [
  {
    id: "status",
    label: "by status",
    hint: "Active, Inactive, Acquired, and Public per batch",
  },
  {
    id: "stage",
    label: "by stage",
    hint: "Seed / Early / Growth / Public per batch",
  },
  {
    id: "top_company",
    label: "% top company",
    hint: "Share of each batch flagged top company by YC, for batches 5+ years old",
  },
];

const COMPOSITION_METRICS: MetricOption[] = [
  {
    id: "industry",
    label: "by industry",
    hint: "Industry mix per batch",
  },
  {
    id: "region",
    label: "by country",
    hint: "Country mix per batch",
  },
  {
    id: "intl",
    label: "US vs non-US",
    hint: "US vs non-US companies per batch",
  },
  {
    id: "team_size",
    label: "median team size",
    hint: "Median current headcount across the batch",
  },
  {
    id: "country_diversity",
    label: "country diversity",
    hint: "Distinct non-US countries represented per batch",
  },
];

const METRIC_OPTIONS: MetricOption[] = [
  ...OUTCOME_METRICS,
  ...COMPOSITION_METRICS,
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
      const sizes: number[] = [];
      for (const c of b.companies) {
        if (typeof c.team_size === "number") sizes.push(c.team_size);
      }
      sizes.sort((x, y) => x - y);
      let median = 0;
      if (sizes.length > 0) {
        const mid = Math.floor(sizes.length / 2);
        median =
          sizes.length % 2 === 0 ? (sizes[mid - 1] + sizes[mid]) / 2 : sizes[mid];
      }
      return { short: b.short, batch: b.batch, median };
    });
    return {
      rows,
      keys: ["median"],
      colors: { median: "#33b1ff" },
      stacked: false,
      yLabel: "median people",
    };
  }

  if (metric === "country_diversity") {
    const rows = buckets.map((b) => {
      const countries = new Set<string>();
      for (const c of b.companies) {
        for (const r of c.regions) {
          if (INTL_META.has(r) || INTL_US.has(r)) continue;
          countries.add(r);
        }
      }
      return { short: b.short, batch: b.batch, countries: countries.size };
    });
    return {
      rows,
      keys: ["countries"],
      colors: { countries: "#5cc8a8" },
      stacked: false,
      yLabel: "distinct countries",
    };
  }

  if (metric === "intl") {
    const rows = buckets.map((b) => {
      let us = 0;
      let nonus = 0;
      for (const c of b.companies) {
        const cls = classifyIntl(c);
        if (cls === "us") us++;
        else if (cls === "nonus") nonus++;
      }
      return { short: b.short, batch: b.batch, US: us, "Non-US": nonus };
    });
    return {
      rows,
      keys: ["US", "Non-US"],
      colors: { US: "#33b1ff", "Non-US": "#e87aa8" },
      stacked: true,
      yLabel: "companies",
    };
  }

  const rows = buckets
    .filter((b) => isMatureBatch(b.batch))
    .map((b) => {
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
  const metric = useUi((s) => s.timelineMetric);
  const setMetric = useUi((s) => s.setTimelineMetric);
  const mounted = useMounted();

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

  // Sum from buckets so the page-head totals match the canonical
  // batches that drive every chart on the page (no Unspecified, no
  // tiny/deferral-only batches).
  const totals = useMemo(() => {
    let active = 0;
    let inactive = 0;
    let acquired = 0;
    let pub = 0;
    let topCo = 0;
    let total = 0;
    for (const b of buckets) {
      for (const c of b.companies) {
        total++;
        if (c.status === "Active") active++;
        else if (c.status === "Inactive") inactive++;
        else if (c.status === "Acquired") acquired++;
        else if (c.status === "Public") pub++;
        if (c.top_company === true) topCo++;
      }
    }
    return { total, active, inactive, acquired, pub, topCo };
  }, [buckets]);

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
    <div className="flex h-full flex-col">
      <div className="px-4 pt-4 sm:px-5 sm:pt-5">
        <div className="mx-auto max-w-[1480px]">
          <div className="page-head">
            <div>
              <div className="eyebrow">
                Timeline · {totals.total.toLocaleString()} companies
              </div>
              <h1>How YC has grown across {buckets.length} batches</h1>
              <div className="sub">
                {firstBatch} → {lastBatch} · click a metric to change what
                gets stacked.
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-[10.5px] tabular-nums">
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
            <Stat label="top company" value={totals.topCo} />
          </div>
        </div>
      </div>

      <div className="scroll-fine mx-auto flex min-h-0 w-full max-w-[1480px] flex-1 flex-col gap-[14px] overflow-y-auto px-4 pt-4 pb-7 sm:px-5 lg:grid lg:grid-cols-[minmax(0,1fr)_232px]">
        <div className="flex flex-col gap-[14px]">
        <div className="flex h-[360px] flex-col rounded-[10px] border border-border bg-card p-3.5 transition-colors hover:border-[color:var(--border-strong)]">
          <div className="mb-2 flex flex-col items-stretch gap-2 md:flex-row md:flex-wrap md:items-baseline md:justify-between md:gap-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground">
                Companies per batch
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                {activeMetric.hint}
              </div>
            </div>
            <div className="scroll-x-hidden -mx-3.5 flex items-center gap-1.5 overflow-x-auto px-3.5 font-mono text-[10px] md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
              {OUTCOME_METRICS.map((opt) => (
                <MetricTab
                  key={opt.id}
                  opt={opt}
                  active={metric === opt.id}
                  onSelect={setMetric}
                />
              ))}
              <span
                aria-hidden
                className="mx-0.5 h-3.5 w-px shrink-0 bg-border"
              />
              {COMPOSITION_METRICS.map((opt) => (
                <MetricTab
                  key={opt.id}
                  opt={opt}
                  active={metric === opt.id}
                  onSelect={setMetric}
                />
              ))}
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

        <div className="flex h-[280px] flex-col rounded-[10px] border border-border bg-card p-3.5 transition-colors hover:border-[color:var(--border-strong)]">
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

        <div className="grid grid-cols-2 gap-[14px] lg:h-full lg:grid-cols-1 lg:grid-rows-4">
          <KpiTile
            label="Active rate"
            value={pct(totals.active, totals.total, 0)}
            caption={`across ${fates.length} batches`}
            series={fates.map((f) => f.Active)}
            color={STATUS_COLORS.Active}
          />
          <KpiTile
            label="Acquired rate"
            value={pct(totals.acquired, totals.total, 1)}
            caption={`${totals.acquired.toLocaleString()} all-time`}
            series={fates.map((f) => f.Acquired)}
            color={STATUS_COLORS.Acquired}
            accent
          />
          <KpiTile
            label="Public rate"
            value={pct(totals.pub, totals.total, 1)}
            caption={`${totals.pub.toLocaleString()} all-time`}
            series={fates.map((f) => f.Public)}
            color={STATUS_COLORS.Public}
          />
          <KpiTile
            label="Inactive rate"
            value={pct(totals.inactive, totals.total, 0)}
            caption={`${totals.inactive.toLocaleString()} all-time`}
            series={fates.map((f) => f.Inactive)}
            color={STATUS_COLORS.Inactive}
            mute
          />
        </div>
      </div>
    </div>
  );
}

function pct(num: number, denom: number, decimals: number): string {
  if (denom <= 0) return "—";
  return `${((num / denom) * 100).toFixed(decimals)}%`;
}

function KpiTile({
  label,
  value,
  caption,
  series,
  color,
  accent = false,
  mute = false,
}: {
  label: string;
  value: string;
  caption: string;
  series: number[];
  color: string;
  accent?: boolean;
  mute?: boolean;
}) {
  // Bar-roll: full per-batch history, oldest → newest.
  const barMax = Math.max(...series, 0.01);

  return (
    <div className="flex h-full min-h-[132px] flex-col gap-1.5 rounded-[10px] border border-border bg-card p-3.5 transition-colors hover:border-[color:var(--border-strong)]">
      <div className="font-mono text-[10px] text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-1.5 font-mono">
        <span
          className={cn(
            "text-[26px] font-medium leading-none tracking-[-0.01em] tabular-nums",
            accent ? "text-primary" : "text-foreground",
          )}
        >
          {value}
        </span>
      </div>
      <div
        className={cn(
          "font-mono text-[10px] tabular-nums",
          mute ? "text-faint" : "text-muted-foreground",
        )}
      >
        {caption}
      </div>
      <div className="mt-auto flex h-[26px] items-end gap-[2px]">
        {series.length === 0 ? (
          <span className="text-faint font-mono text-[10px]">—</span>
        ) : (
          series.map((v, i) => (
            <span
              key={i}
              style={{
                flex: 1,
                height: `${Math.max(6, (v / barMax) * 100)}%`,
                backgroundColor: color,
                opacity: 0.55,
                borderRadius: 1,
              }}
              title={`per-batch share: ${v.toFixed(1)}%`}
            />
          ))
        )}
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

function MetricTab({
  opt,
  active,
  onSelect,
}: {
  opt: MetricOption;
  active: boolean;
  onSelect: (m: Metric) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(opt.id)}
      aria-pressed={active}
      className={cn("pill-btn shrink-0", active && "active")}
    >
      {opt.label}
    </button>
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
