"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Plus, X } from "lucide-react";
import { useCompanies } from "@/components/companies-provider";
import { useUi } from "@/lib/store";
import { useMounted } from "@/lib/use-mounted";
import {
  REGION_BUCKETS,
  STAGE_BUCKETS,
  THRESHOLDS,
  cohortMetrics,
  referenceYear,
  unionTopIndustries,
  type CohortMetrics,
  type RegionBucket,
} from "@/lib/compare-data";
import {
  STATUS_COLORS,
  aggregateByBatch,
  aggregatesAboveMinSize,
  aggregatesExcludingUnspecified,
} from "@/lib/overview-data";
import type { CompanyStatus } from "@/lib/types";
import { batchToShort, batchToSortKey, cn } from "@/lib/utils";

type Lens = "outcomes" | "industries" | "regions" | "themes";

export function Compare() {
  const all = useCompanies();
  const compareBatches = useUi((s) => s.compareBatches);
  const setCompareBatches = useUi((s) => s.setCompareBatches);
  const toggleCompareBatch = useUi((s) => s.toggleCompareBatch);
  const mounted = useMounted();
  const [lens, setLens] = useState<Lens>("outcomes");
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const aggregates = useMemo(
    () =>
      aggregatesAboveMinSize(
        aggregatesExcludingUnspecified(aggregateByBatch(all)),
      ),
    [all],
  );

  useEffect(() => {
    if (!mounted) return;
    if (compareBatches.length > 0) return;
    if (aggregates.length < 2) return;
    const last = aggregates[aggregates.length - 1].batch;
    const prev = aggregates[aggregates.length - 2].batch;
    setCompareBatches([prev, last]);
  }, [mounted, aggregates, compareBatches.length, setCompareBatches]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onClick = (e: MouseEvent) => {
      const node = pickerRef.current;
      if (node && !node.contains(e.target as Node)) setPickerOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [pickerOpen]);

  // Hydration gate — store reads `compareBatches` from the URL
  // synchronously, so server `[]` would clash with client list.
  const effectiveBatches = useMemo(
    () => (mounted ? compareBatches : []),
    [mounted, compareBatches],
  );

  // Compute the dataset's reference year once and pass it down — every
  // cohortMetrics call would otherwise re-scan the whole company list
  // to find it.
  const refYear = useMemo(() => referenceYear(all), [all]);

  const cohorts = useMemo(() => {
    const out: CohortMetrics[] = [];
    for (const b of effectiveBatches) {
      const m = cohortMetrics(all, b, refYear);
      if (m) out.push(m);
    }
    return out;
  }, [all, effectiveBatches, refYear]);

  const baseline = cohorts[0] ?? null;

  return (
    <div className="scroll-fine h-full overflow-x-hidden overflow-y-auto">
      <div className="mx-auto max-w-[1480px] px-4 pb-7 pt-4 sm:px-5 sm:pt-5">
        <div className="page-head">
          <div>
            <div className="eyebrow">
              Compare · {cohorts.length} cohort
              {cohorts.length === 1 ? "" : "s"}
            </div>
            <h1>Cohort vs cohort</h1>
            <div className="sub">
              Stack any two to four batches.{" "}
              {baseline ? (
                <>
                  <span className="font-mono text-primary">
                    {baseline.short}
                  </span>{" "}
                  is the baseline; deltas read against it.
                </>
              ) : (
                "Add a cohort to start."
              )}
            </div>
          </div>
        </div>

        <div ref={pickerRef} className="relative mt-4 flex flex-col gap-2">
          <CohortPicker
            cohorts={cohorts}
            onRemove={(short) => {
              const target = aggregates.find((a) => a.short === short);
              if (target) toggleCompareBatch(target.batch);
            }}
            canAdd={cohorts.length < 4}
            onOpenPicker={() => setPickerOpen((v) => !v)}
            pickerOpen={pickerOpen}
          />
          {pickerOpen && (
            <PickerPop
              aggregates={aggregates}
              picked={new Set(effectiveBatches)}
              onToggle={toggleCompareBatch}
            />
          )}
        </div>

        {cohorts.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <MaturityAdvisory cohorts={cohorts} />
            <KpiGrid cohorts={cohorts} />
            <LensCard lens={lens} setLens={setLens} cohorts={cohorts} />
            <StageStrip cohorts={cohorts} />
            {cohorts.length > 1 && baseline && (
              <InsightStrip cohorts={cohorts} baseline={baseline} />
            )}
          </>
        )}
      </div>
    </div>
  );
}


function CohortPicker({
  cohorts,
  onRemove,
  canAdd,
  onOpenPicker,
  pickerOpen,
}: {
  cohorts: CohortMetrics[];
  onRemove: (short: string) => void;
  canAdd: boolean;
  onOpenPicker: () => void;
  pickerOpen: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {cohorts.map((c, i) => (
        <span
          key={c.short}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border bg-card pl-2 pr-1 py-1 transition-colors",
            i === 0
              ? "border-[color:var(--primary-line)] bg-[color:var(--primary-soft)]"
              : "border-border",
          )}
        >
          <span
            className={cn(
              "font-mono text-[9px] uppercase tracking-[0.16em]",
              i === 0 ? "text-primary" : "text-faint",
            )}
          >
            {i === 0 ? "base" : `peer ${i}`}
          </span>
          <span className="font-mono text-[12px] font-medium text-foreground">
            {c.short}
          </span>
          <button
            type="button"
            onClick={() => onRemove(c.short)}
            aria-label={`Remove ${c.short}`}
            className="grid size-[18px] place-items-center rounded-full text-muted-foreground transition-colors hover:bg-[color:var(--bg-soft)] hover:text-foreground"
          >
            <X className="size-2.5" strokeWidth={2.25} />
          </button>
        </span>
      ))}
      {canAdd && (
        <button
          type="button"
          onClick={onOpenPicker}
          aria-expanded={pickerOpen}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-[color:var(--border-strong)] bg-transparent px-3 py-[5px] font-mono text-[11px] text-muted-foreground transition-colors hover:border-solid hover:border-[color:var(--primary-line)] hover:text-primary"
        >
          <Plus className="size-3" strokeWidth={2} />
          add cohort{cohorts.length === 0 ? " to start" : ""}
        </button>
      )}
    </div>
  );
}

function PickerPop({
  aggregates,
  picked,
  onToggle,
}: {
  aggregates: ReturnType<typeof aggregatesAboveMinSize>;
  picked: Set<string>;
  onToggle: (batch: string) => void;
}) {
  const ordered = useMemo(
    () => [...aggregates].sort((a, b) => batchToSortKey(b.batch) - batchToSortKey(a.batch)),
    [aggregates],
  );
  return (
    <div
      role="dialog"
      aria-label="Pick a cohort"
      className="absolute left-0 top-full z-30 mt-2 w-[min(560px,100%)] rounded-[10px] border border-border bg-card p-3 shadow-[var(--shadow-pop)]"
    >
      <div className="mb-2 px-1 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
        most recent first
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-1">
        {ordered.map((a) => {
          const on = picked.has(a.batch);
          return (
            <button
              key={a.batch}
              type="button"
              onClick={() => onToggle(a.batch)}
              className={cn(
                "rounded-md border px-2 py-1.5 text-center font-mono text-[11px] transition-colors",
                on
                  ? "border-[color:var(--primary-line)] bg-[color:var(--primary-soft)] text-primary"
                  : "border-border bg-[color:var(--bg-soft)] text-muted-foreground hover:border-[color:var(--primary-line)] hover:text-foreground",
              )}
              title={`${batchToShort(a.batch)} · ${a.total} companies`}
            >
              {batchToShort(a.batch)}
            </button>
          );
        })}
      </div>
    </div>
  );
}


interface Kpi {
  id: string;
  label: string;
  hint: string;
  fmt: (v: number) => string;
  // Returns null when the underlying sample is too small to mean
  // anything (e.g. median team size with < 10 companies reporting).
  get: (c: CohortMetrics) => number | null;
  kind: "count" | "percent";
}

const KPIS: Kpi[] = [
  {
    id: "total",
    label: "Companies",
    hint: "Funded in this batch",
    fmt: (v) => v.toLocaleString(),
    get: (c) => c.total,
    kind: "count",
  },
  {
    id: "active",
    label: "Still operating",
    hint: "Share that hasn't shut down or exited",
    fmt: (v) => `${v.toFixed(1)}%`,
    get: (c) => c.pctActive,
    kind: "percent",
  },
  {
    id: "top",
    label: "Top YC companies",
    hint: "Share that YC has named a top company",
    fmt: (v) => `${v.toFixed(1)}%`,
    get: (c) => c.pctTopCompany,
    kind: "percent",
  },
  {
    id: "team",
    label: "Median team size",
    hint: "Median headcount in the batch today",
    fmt: (v) => v.toLocaleString(),
    // Just-funded batches have ~6% coverage; without a floor, the
    // median reads as noise. Thresholds live in lib/compare-data.ts.
    get: (c) => {
      const coverage = c.total > 0 ? c.medianTeamSampleSize / c.total : 0;
      return c.medianTeamSampleSize >= THRESHOLDS.MEDIAN_TEAM_MIN_SAMPLE &&
        coverage >= THRESHOLDS.MEDIAN_TEAM_MIN_COVERAGE
        ? c.medianTeamSize
        : null;
    },
    kind: "count",
  },
  {
    id: "exit",
    label: "Exit rate",
    hint: "Share that's been acquired or gone public",
    fmt: (v) => `${v.toFixed(1)}%`,
    get: (c) => c.pctExited,
    kind: "percent",
  },
  {
    id: "ai",
    label: "AI focus",
    hint: "Tagged AI, or pitch mentions AI / agents",
    fmt: (v) => `${v.toFixed(0)}%`,
    get: (c) => c.aiShare,
    kind: "percent",
  },
];

function KpiGrid({ cohorts }: { cohorts: CohortMetrics[] }) {
  const baseline = cohorts[0];
  return (
    <>
      <KpiGridMobile cohorts={cohorts} />
      <div className="mt-4 hidden overflow-hidden rounded-[10px] border border-border bg-card md:block">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `minmax(140px, 180px) repeat(${cohorts.length}, minmax(0, 1fr))`,
        }}
      >
        {/* Header row */}
        <div className="border-b border-border bg-[color:var(--bg-soft)]" />
        {cohorts.map((c, i) => (
          <div
            key={c.short}
            className={cn(
              "border-b border-l border-border px-4 py-3.5",
              i === 0 &&
                "bg-[color-mix(in_oklab,var(--primary)_4%,var(--bg-soft))]",
            )}
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
              {i === 0 ? "baseline" : `peer ${i}`}
            </div>
            <div className="mt-1 text-[22px] font-medium tracking-tight text-foreground">
              {c.short}
            </div>
            <div className="mt-0.5 font-mono text-[10.5px] text-muted-foreground">
              {c.batch}{" "}
              <span className="text-faint">· {c.ageLabel}</span>
            </div>
          </div>
        ))}
        {/* KPI rows */}
        {KPIS.map((kpi) => {
          const baseVal = kpi.get(baseline);
          return (
            <div className="contents" key={kpi.id}>
              <div className="flex flex-col justify-center gap-0.5 border-t border-border bg-[color-mix(in_oklab,var(--bg-soft)_55%,transparent)] px-4 py-3.5">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-foreground">
                  {kpi.label}
                </div>
                <div className="font-mono text-[9.5px] text-faint">
                  {kpi.hint}
                </div>
              </div>
              {cohorts.map((c, i) => {
                const val = kpi.get(c);
                const insufficient = val === null;
                const delta =
                  i === 0 || val === null || baseVal === null
                    ? null
                    : val - baseVal;
                let deltaText: string | null = null;
                if (delta != null && val !== null && baseVal !== null) {
                  if (Math.abs(delta) < 0.05) {
                    deltaText = "—";
                  } else if (kpi.kind === "percent") {
                    deltaText = `${delta > 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(Math.abs(delta) >= 10 ? 0 : 1)} pts`;
                  } else {
                    const rel = baseVal === 0 ? null : (delta / baseVal) * 100;
                    deltaText =
                      rel == null
                        ? null
                        : `${delta > 0 ? "▲" : "▼"} ${Math.abs(rel).toFixed(Math.abs(rel) >= 10 ? 0 : 1)}%`;
                  }
                }
                return (
                  <div
                    key={c.short + kpi.id}
                    className={cn(
                      "flex flex-col justify-center gap-1 border-l border-t border-border px-4 py-3.5",
                      i === 0 &&
                        "bg-[color-mix(in_oklab,var(--primary)_3%,transparent)]",
                    )}
                  >
                    {insufficient ? (
                      <>
                        <div className="text-[20px] font-medium tracking-tight tabular-nums text-faint">
                          —
                        </div>
                        <div className="font-mono text-[10px] text-faint">
                          not enough data
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-[20px] font-medium tracking-tight tabular-nums text-foreground">
                          {kpi.fmt(val)}
                        </div>
                        {deltaText && delta != null && (
                          <div
                            className={cn(
                              "font-mono text-[10.5px] tabular-nums",
                              delta > 0 && "text-[color:var(--status-active)]",
                              delta < 0 && "text-[color:var(--status-inactive)]",
                              Math.abs(delta) < 0.05 &&
                                "text-muted-foreground",
                            )}
                          >
                            {deltaText}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      </div>
    </>
  );
}

function KpiGridMobile({ cohorts }: { cohorts: CohortMetrics[] }) {
  const baseline = cohorts[0];
  return (
    <div className="mt-4 flex flex-col gap-3 md:hidden">
      {cohorts.map((c, i) => {
        const isBase = i === 0;
        return (
          <div
            key={c.short}
            className={cn(
              "overflow-hidden rounded-[10px] border bg-card",
              isBase
                ? "border-[color:var(--primary-line)]"
                : "border-border",
            )}
          >
            <div
              className={cn(
                "flex items-baseline justify-between gap-2 border-b border-border px-4 py-3",
                isBase &&
                  "bg-[color-mix(in_oklab,var(--primary)_5%,var(--bg-soft))]",
              )}
            >
              <div className="flex flex-col">
                <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-faint">
                  {isBase ? "baseline" : `peer ${i}`}
                </span>
                <span className="text-[20px] font-medium tracking-tight text-foreground">
                  {c.short}
                </span>
              </div>
              <div className="text-right font-mono text-[10.5px] text-muted-foreground">
                <div>{c.batch}</div>
                <div className="text-faint">{c.ageLabel}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-border">
              {KPIS.map((kpi, ki) => {
                const val = kpi.get(c);
                const baseVal = kpi.get(baseline);
                const insufficient = val === null;
                const delta =
                  isBase || val === null || baseVal === null
                    ? null
                    : val - baseVal;
                let deltaText: string | null = null;
                if (delta != null && val !== null && baseVal !== null) {
                  if (Math.abs(delta) < 0.05) {
                    deltaText = "—";
                  } else if (kpi.kind === "percent") {
                    deltaText = `${delta > 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(Math.abs(delta) >= 10 ? 0 : 1)} pts`;
                  } else {
                    const rel = baseVal === 0 ? null : (delta / baseVal) * 100;
                    deltaText =
                      rel == null
                        ? null
                        : `${delta > 0 ? "▲" : "▼"} ${Math.abs(rel).toFixed(Math.abs(rel) >= 10 ? 0 : 1)}%`;
                  }
                }
                return (
                  <div
                    key={kpi.id}
                    className={cn(
                      "px-4 py-3",
                      ki >= 2 && "border-t border-border",
                    )}
                  >
                    <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">
                      {kpi.label}
                    </div>
                    {insufficient ? (
                      <>
                        <div className="mt-1 text-[18px] font-medium tracking-tight tabular-nums text-faint">
                          —
                        </div>
                        <div className="mt-0.5 font-mono text-[9.5px] text-faint">
                          not enough data
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="mt-1 text-[18px] font-medium tracking-tight tabular-nums text-foreground">
                          {kpi.fmt(val)}
                        </div>
                        {deltaText && delta != null && (
                          <div
                            className={cn(
                              "mt-0.5 font-mono text-[10px] tabular-nums",
                              delta > 0 && "text-[color:var(--status-active)]",
                              delta < 0 && "text-[color:var(--status-inactive)]",
                              Math.abs(delta) < 0.05 &&
                                "text-muted-foreground",
                            )}
                          >
                            {deltaText}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}


interface LensRow {
  id: string;
  color: string;
}

interface LensConfig {
  title: string;
  sub: string;
  rowLabel: string;
  rows: LensRow[];
  get: (c: CohortMetrics, id: string) => number;
  showStack: boolean;
  max: number;
}

const STATUS_ROWS: LensRow[] = [
  { id: "Active", color: STATUS_COLORS.Active },
  { id: "Acquired", color: STATUS_COLORS.Acquired },
  { id: "Public", color: STATUS_COLORS.Public },
  { id: "Inactive", color: STATUS_COLORS.Inactive },
];

const REGION_PALETTE: Record<RegionBucket, string> = {
  USA: "var(--primary)",
  "USA & Canada": "#5cc8a8",
  Europe: STATUS_COLORS.Public,
  Asia: STATUS_COLORS.Acquired,
  "Latin America": STATUS_COLORS.Active,
  "Middle East": "#d4a93c",
  Africa: "#b483e8",
  Oceania: "#8a8df0",
  Other: "var(--fg-faint)",
};

const THEME_PALETTE: Record<string, string> = {
  AI: "var(--primary)",
  SaaS: STATUS_COLORS.Active,
  Fintech: "#5cc8a8",
  "Crypto / Web3": "#d4a93c",
  Marketplace: "#e87aa8",
  Climate: "#9bd16a",
  "Developer Tools": "#b483e8",
};

function LensCard({
  lens,
  setLens,
  cohorts,
}: {
  lens: Lens;
  setLens: (l: Lens) => void;
  cohorts: CohortMetrics[];
}) {
  const config = useMemo<LensConfig>(() => {
    if (lens === "outcomes") {
      return {
        title: "Outcome mix",
        sub: "Where each cohort ended up — still operating, exited, or shut down.",
        rowLabel: "outcome",
        rows: STATUS_ROWS,
        get: (c, id) => c.outcomeMix[id as CompanyStatus] ?? 0,
        showStack: true,
        max: 100,
      };
    }
    if (lens === "regions") {
      const presentBuckets = REGION_BUCKETS.filter((r) =>
        cohorts.some((c) => (c.regionMix[r] ?? 0) > 0),
      );
      return {
        title: "Region mix",
        sub: "Where founders are based, grouped by continent.",
        rowLabel: "region",
        rows: presentBuckets.map((r) => ({
          id: r,
          color: REGION_PALETTE[r],
        })),
        get: (c, id) => c.regionMix[id as RegionBucket] ?? 0,
        showStack: true,
        max: 100,
      };
    }
    if (lens === "themes") {
      const themes = Object.keys(THEME_PALETTE);
      return {
        title: "Theme mix",
        sub: "What each cohort builds — share working in each tech theme.",
        rowLabel: "theme",
        rows: themes.map((t) => ({ id: t, color: THEME_PALETTE[t] })),
        get: (c, id) => c.themeMix[id] ?? 0,
        showStack: false,
        max: 80,
      };
    }
    const rows = unionTopIndustries(cohorts, 5).map((id, i) => ({
      id,
      color: [
        "var(--primary)",
        STATUS_COLORS.Active,
        STATUS_COLORS.Acquired,
        STATUS_COLORS.Public,
        "#d4a93c",
        "#e87aa8",
        "#9bd16a",
        "#b483e8",
      ][i % 8],
    }));
    return {
      title: "Industry mix",
      sub: "Top industries that show up across the selected cohorts.",
      rowLabel: "industry",
      rows,
      get: (c, id) => c.industryMix[id] ?? 0,
      showStack: false,
      max: Math.max(
        20,
        Math.ceil(
          Math.max(
            ...rows.flatMap((r) =>
              cohorts.map((c) => c.industryMix[r.id] ?? 0),
            ),
            0,
          ),
        ),
      ),
    };
  }, [lens, cohorts]);

  return (
    <div className="mt-4 rounded-[10px] border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground">
            {config.title}
          </div>
          <div className="mt-0.5 text-[12px] text-muted-foreground">
            {config.sub}
          </div>
        </div>
        <div className="seg" role="tablist" aria-label="Compare lens">
          {(
            [
              { id: "outcomes", label: "Outcomes" },
              { id: "industries", label: "Industries" },
              { id: "regions", label: "Regions" },
              { id: "themes", label: "Themes" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={lens === opt.id}
              className={lens === opt.id ? "active" : ""}
              onClick={() => setLens(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {config.showStack && (
        <>
          <div className="flex flex-col gap-3.5">
            {cohorts.map((c) => (
              <StackRow key={c.short} cohort={c} config={config} />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-3.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {config.rows.map((r) => (
              <span key={r.id} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block size-2 rounded-sm"
                  style={{ backgroundColor: r.color }}
                />
                {r.id}
              </span>
            ))}
          </div>
        </>
      )}

      <div
        className={cn(
          "flex flex-col gap-1",
          config.showStack && "mt-4 border-t border-border pt-4",
        )}
      >
        <div
          className="grid items-baseline gap-2 border-b border-border pb-1.5 px-1 font-mono text-[9px] uppercase tracking-[0.16em] text-faint sm:gap-3"
          style={{
            gridTemplateColumns: `clamp(72px, 24%, 110px) repeat(${cohorts.length}, minmax(0, 1fr))`,
          }}
        >
          <span>{config.rowLabel}</span>
          {cohorts.map((c, i) => (
            <span key={c.short} className={i === 0 ? "text-primary" : ""}>
              {c.short}
            </span>
          ))}
        </div>
        {config.rows.map((row) => (
          <CompRow
            key={row.id}
            row={row}
            cohorts={cohorts}
            getter={config.get}
            max={config.max}
          />
        ))}
      </div>
    </div>
  );
}

function StackRow({
  cohort,
  config,
}: {
  cohort: CohortMetrics;
  config: LensConfig;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between font-mono text-[11px]">
        <span className="text-foreground">
          {cohort.short}{" "}
          <span className="text-faint">· {cohort.batch}</span>
        </span>
        <span className="text-muted-foreground">
          {cohort.total.toLocaleString()} companies
        </span>
      </div>
      <div className="flex h-3.5 overflow-hidden rounded bg-[color:var(--bg-soft)]">
        {config.rows.map((r) => {
          const pct = config.get(cohort, r.id);
          if (pct < 0.4) return null;
          return (
            <span
              key={r.id}
              title={`${r.id}: ${pct.toFixed(1)}%`}
              style={{
                width: `${pct}%`,
                backgroundColor: r.color,
              }}
              className="flex h-full items-center px-1.5 transition-[filter] hover:brightness-110"
            >
              {pct > 8 && (
                <span className="whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.08em] text-white/85">
                  {r.id.length > 8 ? r.id.slice(0, 3) : r.id} {pct.toFixed(0)}%
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function CompRow({
  row,
  cohorts,
  getter,
  max,
}: {
  row: LensRow;
  cohorts: CohortMetrics[];
  getter: (c: CohortMetrics, id: string) => number;
  max: number;
}) {
  const baseV = getter(cohorts[0], row.id);
  return (
    <div
      className="grid items-center gap-2 rounded px-1 py-1.5 transition-colors hover:bg-[color:var(--bg-soft)] sm:gap-3"
      style={{
        gridTemplateColumns: `clamp(72px, 24%, 110px) repeat(${cohorts.length}, minmax(0, 1fr))`,
      }}
    >
      <span className="inline-flex items-center gap-2 font-mono text-[11.5px] text-foreground">
        <span
          aria-hidden
          className="inline-block size-[7px] shrink-0 rounded-sm"
          style={{ backgroundColor: row.color }}
        />
        <span className="truncate" title={row.id}>
          {row.id}
        </span>
      </span>
      {cohorts.map((c, i) => {
        const v = getter(c, row.id);
        const delta = i === 0 ? null : v - baseV;
        const w = Math.min(100, max === 0 ? 0 : (v / max) * 100);
        const dirClass =
          delta == null
            ? ""
            : delta > 0.5
              ? "text-[color:var(--status-active)]"
              : delta < -0.5
                ? "text-[color:var(--status-inactive)]"
                : "text-faint";
        return (
          <div key={c.short + row.id} className="flex flex-col gap-1">
            <div className="relative h-[5px] overflow-hidden rounded bg-[color:var(--bg-soft)]">
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 rounded transition-[width] duration-300"
                style={{
                  width: `${w}%`,
                  backgroundColor: i === 0 ? "var(--muted-foreground)" : row.color,
                }}
              />
            </div>
            <div className="flex items-baseline justify-between font-mono text-[10.5px] tabular-nums">
              <span className="text-foreground">
                {v.toFixed(v < 10 && v > 0 ? 1 : 0)}%
              </span>
              {delta != null && (
                <span className={dirClass}>
                  {delta > 0 ? "+" : ""}
                  {delta.toFixed(Math.abs(delta) < 10 ? 1 : 0)} pts
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}


const STAGE_PALETTE: Record<string, string> = {
  Seed: "var(--fg-faint)",
  Early: STATUS_COLORS.Active,
  Growth: "var(--primary)",
  Public: STATUS_COLORS.Public,
  Other: "var(--bg-soft)",
};

function StageStrip({ cohorts }: { cohorts: CohortMetrics[] }) {
  const anyStaged = cohorts.some((c) =>
    STAGE_BUCKETS.some((s) => (c.stageMix[s] ?? 0) > 0),
  );
  if (!anyStaged) return null;
  const stages = [...STAGE_BUCKETS, "Other" as const];
  return (
    <div className="mt-4 rounded-[10px] border border-border bg-card p-4">
      <div className="mb-3">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground">
          Stage distribution
        </div>
        <div className="mt-0.5 text-[12px] text-muted-foreground">
          How far along each cohort is — Seed, Early, Growth, Public.
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {cohorts.map((c) => (
          <div key={c.short}>
            <div className="mb-1 flex items-baseline justify-between font-mono text-[11px]">
              <span className="text-foreground">
                {c.short}{" "}
                <span className="text-faint">· {c.batch}</span>
              </span>
              <span className="text-muted-foreground">
                {STAGE_BUCKETS.map(
                  (s) => `${s} ${(c.stageMix[s] ?? 0).toFixed(0)}%`,
                ).join(" · ")}
              </span>
            </div>
            <div className="flex h-3.5 overflow-hidden rounded bg-[color:var(--bg-soft)]">
              {stages.map((s) => {
                const pct = c.stageMix[s] ?? 0;
                if (pct < 0.4) return null;
                return (
                  <span
                    key={s}
                    title={`${s}: ${pct.toFixed(1)}%`}
                    style={{
                      width: `${pct}%`,
                      backgroundColor: STAGE_PALETTE[s],
                    }}
                    className="flex h-full items-center px-1.5"
                  >
                    {pct > 9 && (
                      <span className="whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.08em] text-white/85">
                        {s} {pct.toFixed(0)}%
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


interface Insight {
  label: string;
  value: ReactNode;
  hint: string;
  dir: number;
}

function fmtPts(n: number): string {
  const sign = n >= 0 ? "+" : "−";
  return `${sign}${Math.abs(n).toFixed(Math.abs(n) >= 10 ? 0 : 1)} pts`;
}

function fmtCount(n: number): string {
  const sign = n >= 0 ? "+" : "−";
  return `${sign}${Math.abs(n).toLocaleString()}`;
}

function intlShare(c: CohortMetrics): number {
  return 100 - (c.regionMix.USA ?? 0);
}

function phrase(
  n: number,
  peer: string,
  base: string,
  more: string,
  less: string,
  same: string,
): string {
  if (Math.abs(n) < 0.5) return `${peer} and ${base} are ${same}`;
  return `${peer} ${n > 0 ? more : less} ${base}`;
}

function InsightStrip({
  cohorts,
  baseline,
}: {
  cohorts: CohortMetrics[];
  baseline: CohortMetrics;
}) {
  // Compare the LAST peer to the baseline — most natural read for
  // oldest → newest stacks.
  const peer = cohorts[cohorts.length - 1];
  const aiD = peer.aiShare - baseline.aiShare;
  const activeD = peer.pctActive - baseline.pctActive;
  const teamCoverageOk = (c: CohortMetrics) =>
    c.total > 0 &&
    c.medianTeamSampleSize >= THRESHOLDS.MEDIAN_TEAM_MIN_SAMPLE &&
    c.medianTeamSampleSize / c.total >= THRESHOLDS.MEDIAN_TEAM_MIN_COVERAGE;
  const teamHasSample = teamCoverageOk(peer) && teamCoverageOk(baseline);
  const teamD = peer.medianTeamSize - baseline.medianTeamSize;
  const intlD = intlShare(peer) - intlShare(baseline);
  const exitD = peer.pctExited - baseline.pctExited;
  const p = peer.short;
  const b = baseline.short;
  const insights: Insight[] = [
    {
      label: "AI focus",
      value: fmtPts(aiD),
      hint: phrase(
        aiD,
        p,
        b,
        "leans more AI than",
        "leans less AI than",
        "equally AI-focused",
      ),
      dir: aiD,
    },
    {
      label: "Still operating",
      value: fmtPts(activeD),
      hint: phrase(
        activeD,
        p,
        b,
        "has more survivors than",
        "has fewer survivors than",
        "operating at the same rate",
      ),
      dir: activeD,
    },
    teamHasSample
      ? {
          label: "Median team",
          value: fmtCount(teamD),
          hint:
            Math.abs(teamD) < 0.5
              ? "Same typical headcount"
              : `${Math.abs(teamD).toLocaleString()} ${teamD > 0 ? "more" : "fewer"} people in the typical company`,
          dir: teamD,
        }
      : {
          label: "Median team",
          value: "—",
          hint: "Too few companies report headcount yet",
          dir: 0,
        },
    {
      label: "International",
      value: fmtPts(intlD),
      hint: phrase(
        intlD,
        p,
        b,
        "has more non-US founders than",
        "has fewer non-US founders than",
        "equally international",
      ),
      dir: intlD,
    },
    {
      label: "Exit rate",
      value: fmtPts(exitD),
      hint: phrase(
        exitD,
        p,
        b,
        "has had more exits than",
        "has had fewer exits than",
        "exiting at the same rate",
      ),
      dir: exitD,
    },
  ];
  return (
    <div className="mt-4 grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
      {insights.map((x) => (
        <div
          key={x.label}
          className="flex flex-col gap-1 rounded-[8px] border border-border bg-card px-4 py-3.5"
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
            {x.label}
          </div>
          <div
            className={cn(
              "font-mono text-[22px] font-medium tracking-tight tabular-nums",
              x.dir > 0 && "text-[color:var(--status-active)]",
              x.dir < 0 && "text-[color:var(--status-inactive)]",
              x.dir === 0 && "text-foreground",
            )}
          >
            {x.value}
          </div>
          <div className="font-mono text-[10.5px] text-muted-foreground">
            {x.hint}
          </div>
        </div>
      ))}
    </div>
  );
}


function MaturityAdvisory({ cohorts }: { cohorts: CohortMetrics[] }) {
  if (cohorts.length < 2) return null;
  const ages = cohorts.map((c) => c.ageYears);
  const span = Math.max(...ages) - Math.min(...ages);
  // Outcomes take ~5 years to settle; only flag wide-age comparisons.
  if (span < THRESHOLDS.COMPARE_AGE_SPAN_YEARS) return null;
  const young = cohorts
    .filter((c) => c.ageYears < THRESHOLDS.YOUNG_COHORT_YEARS)
    .map((c) => c.short);
  if (young.length === 0) return null;
  return (
    <div className="mt-3 flex items-start gap-2.5 rounded-md border border-[color:var(--primary-soft-border)] bg-[color:var(--primary-soft)] px-3.5 py-2.5">
      <span aria-hidden className="mt-[3px] inline-block size-1.5 rounded-full bg-primary" />
      <div className="font-mono text-[10.5px] leading-[1.45] text-foreground">
        <span className="text-primary">Heads up.</span>{" "}
        {young.join(", ")}{" "}
        {young.length === 1 ? "is" : "are"} too young to have meaningful
        outcomes —{" "}
        <span className="text-muted-foreground">
          still operating, exit rate, and top YC companies take ~5 years to
          settle. Industry, region, and theme comparisons stay fair.
        </span>
      </div>
    </div>
  );
}


function EmptyState() {
  return (
    <div className="mt-10 rounded-[10px] border border-dashed border-border bg-card px-6 py-12 text-center">
      <div className="mx-auto max-w-[420px]">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
          empty
        </div>
        <div className="mt-2 text-[15px] text-foreground">
          Pick a baseline batch to start.
        </div>
        <div className="mt-1.5 text-[12px] text-muted-foreground">
          Click <span className="font-mono">+ add cohort</span> above. The first
          one becomes your baseline; up to three peers stack alongside with
          deltas.
        </div>
      </div>
    </div>
  );
}
