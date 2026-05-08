"use client";

import { useMemo, useRef, useState } from "react";
import { useCompanies } from "@/components/companies-provider";
import { useFilteredCompanies, useUi } from "@/lib/store";
import { useMounted } from "@/lib/use-mounted";
import { batchToShort, batchToSortKey, cn } from "@/lib/utils";
import { MIN_BATCH_SIZE } from "@/lib/overview-data";
import type { Company } from "@/lib/types";

const ROW_LIMIT = 20;

type RowAxis = "industry" | "tag" | "region";

const ROW_OPTIONS: { id: RowAxis; label: string }[] = [
  { id: "industry", label: "industry" },
  { id: "tag", label: "tag" },
  { id: "region", label: "region" },
];

function rowKeysFor(c: Company, axis: RowAxis): string[] {
  switch (axis) {
    case "industry":
      return c.industry ? [c.industry] : [];
    case "tag":
      return c.tags;
    case "region":
      return c.regions;
  }
}

interface HeatmapData {
  rowLabels: string[];
  cols: { batch: string; short: string }[];
  matrix: number[][]; // matrix[rowIdx][colIdx]
  rowSparks: Map<string, { batch: string; count: number }[]>;
  max: number;
}

function buildHeatmap(
  all: Company[],
  filtered: Company[],
  axis: RowAxis,
): HeatmapData {
  const batchTotalsAll = new Map<string, number>();
  for (const c of all) {
    if (c.batch === "Unspecified") continue;
    batchTotalsAll.set(c.batch, (batchTotalsAll.get(c.batch) ?? 0) + 1);
  }
  const cols = [...batchTotalsAll.entries()]
    .filter(([, total]) => total >= MIN_BATCH_SIZE)
    .sort((a, b) => batchToSortKey(a[0]) - batchToSortKey(b[0]))
    .map(([batch]) => batch);

  const rowCountsAll = new Map<string, number>();
  for (const c of all) {
    if (c.batch === "Unspecified") continue;
    for (const k of rowKeysFor(c, axis)) {
      rowCountsAll.set(k, (rowCountsAll.get(k) ?? 0) + 1);
    }
  }
  const rowLabels = [...rowCountsAll.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, ROW_LIMIT)
    .map(([k]) => k);

  const rowIdx = new Map(rowLabels.map((k, i) => [k, i]));
  const colIdx = new Map(cols.map((b, i) => [b, i]));

  const sparkBatches = cols; // sparks already cover all retained batches
  const sparkIdx = colIdx;
  const rowSparks = new Map<string, { batch: string; count: number }[]>();
  for (const k of rowLabels) {
    rowSparks.set(
      k,
      sparkBatches.map((b) => ({ batch: b, count: 0 })),
    );
  }

  const matrix: number[][] = rowLabels.map(() => cols.map(() => 0));
  for (const c of filtered) {
    if (c.batch === "Unspecified") continue;
    const ci = colIdx.get(c.batch);
    const si = sparkIdx.get(c.batch);
    for (const k of rowKeysFor(c, axis)) {
      const ri = rowIdx.get(k);
      if (ri === undefined) continue;
      if (ci !== undefined) matrix[ri][ci]++;
      if (si !== undefined) rowSparks.get(k)![si].count++;
    }
  }

  let max = 0;
  for (const row of matrix) for (const v of row) if (v > max) max = v;

  return {
    rowLabels,
    cols: cols.map((b) => ({ batch: b, short: batchToShort(b) })),
    matrix,
    rowSparks,
    max,
  };
}

interface HoverState {
  rowIdx: number;
  colIdx: number;
  rect: DOMRect;
}

export function Heatmap() {
  const all = useCompanies();
  const filtered = useFilteredCompanies(all);
  const filters = useUi((s) => s.filters);
  const setFilters = useUi((s) => s.setFilters);
  const mounted = useMounted();

  const [axis, setAxis] = useState<RowAxis>("industry");
  const [hover, setHover] = useState<HoverState | null>(null);

  const data = useMemo(
    () => buildHeatmap(all, filtered, axis),
    [all, filtered, axis],
  );

  const selectedBatch =
    mounted && filters.batches.length === 1 ? filters.batches[0] : null;

  const activeRow =
    axis === "industry" && filters.industries.length === 1
      ? filters.industries[0]
      : axis === "tag" && filters.tags.length === 1
        ? filters.tags[0]
        : axis === "region" && filters.regions.length === 1
          ? filters.regions[0]
          : null;

  const handleCellClick = (rowKey: string, batch: string) => {
    const filterKey =
      axis === "industry"
        ? "industries"
        : axis === "tag"
          ? "tags"
          : "regions";
    const current = filters[filterKey];
    const isSame = current.length === 1 && current[0] === rowKey;
    const sameBatch =
      filters.batches.length === 1 && filters.batches[0] === batch;
    if (isSame && sameBatch) {
      setFilters({ [filterKey]: [], batches: [] });
    } else {
      setFilters({ [filterKey]: [rowKey], batches: [batch] });
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-card/40 px-4 py-2 font-mono text-[11px]">
        <span className="text-muted-foreground">rows:</span>
        {ROW_OPTIONS.map((opt) => {
          const active = axis === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setAxis(opt.id);
                setHover(null);
              }}
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
        <RampLegend max={data.max} />
      </div>

      <div
        className="flex-1 overflow-hidden p-4"
        style={{ paddingBottom: "60px" }}
      >
        {data.rowLabels.length === 0 || data.cols.length === 0 ? (
          <div className="grid h-full place-items-center font-mono text-[11px] text-muted-foreground">
            Not enough data · refine filter
          </div>
        ) : (
          <HeatmapMatrix
            data={data}
            axis={axis}
            hover={hover}
            setHover={setHover}
            onCellClick={handleCellClick}
            activeRow={activeRow}
            activeBatch={selectedBatch}
          />
        )}
      </div>
    </div>
  );
}

function RampLegend({ max }: { max: number }) {
  return (
    <div className="ml-auto flex items-center gap-2">
      <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
        0
      </span>
      <span
        className="h-2 w-32 rounded"
        style={{
          background:
            "linear-gradient(to right, color-mix(in oklab, var(--primary) 6%, transparent), var(--primary))",
        }}
        aria-label={`color ramp from 0 to ${max}`}
      />
      <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
        {max}
      </span>
    </div>
  );
}

interface MatrixProps {
  data: HeatmapData;
  axis: RowAxis;
  hover: HoverState | null;
  setHover: (h: HoverState | null) => void;
  onCellClick: (rowKey: string, batch: string) => void;
  activeRow: string | null;
  activeBatch: string | null;
}

function HeatmapMatrix({
  data,
  axis,
  hover,
  setHover,
  onCellClick,
  activeRow,
  activeBatch,
}: MatrixProps) {
  const { rowLabels, cols, matrix, max } = data;
  const M = cols.length;
  const N = rowLabels.length;

  const selectedColIdx = activeBatch
    ? cols.findIndex((c) => c.batch === activeBatch)
    : -1;

  // Labels pane scroll-syncs to the data pane via the onScroll
  // handler below; sticky positioning leaked underlying cells.
  const sharedRowTemplate = `20px repeat(${N}, minmax(34px, 1fr))`;
  const labelsScrollRef = useRef<HTMLDivElement | null>(null);
  const dataScrollRef = useRef<HTMLDivElement | null>(null);

  const handleDataScroll = () => {
    const labels = labelsScrollRef.current;
    const dataEl = dataScrollRef.current;
    if (!labels || !dataEl) return;
    if (labels.scrollTop !== dataEl.scrollTop) {
      labels.scrollTop = dataEl.scrollTop;
    }
  };

  return (
    <>
      <div className="flex h-full font-mono text-[9px]">
        <div
          ref={labelsScrollRef}
          onWheel={(e) => {
            if (dataScrollRef.current) {
              dataScrollRef.current.scrollTop += e.deltaY;
            }
          }}
          className="shrink-0 overflow-hidden"
          style={{ width: 110 }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "110px",
              gridTemplateRows: sharedRowTemplate,
              gap: "2px",
              minHeight: "100%",
            }}
          >
            <div />
            {rowLabels.map((label) => {
              const isActiveRow = activeRow === label;
              return (
                <div
                  key={label}
                  className={cn(
                    "flex items-center justify-end overflow-hidden pr-2 text-right leading-tight",
                    isActiveRow ? "text-primary" : "text-foreground/80",
                  )}
                  title={label}
                >
                  <span>{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div
          ref={dataScrollRef}
          onScroll={handleDataScroll}
          className="min-w-0 flex-1 overflow-auto"
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${M}, minmax(26px, 1fr))`,
              gridTemplateRows: sharedRowTemplate,
              gap: "2px",
              minHeight: "100%",
              minWidth: "100%",
            }}
          >
            {cols.map((c, i) => (
              <div
                key={c.batch}
                className={cn(
                  "grid place-items-center text-muted-foreground tabular-nums",
                  i === selectedColIdx && "text-primary",
                )}
              >
                {c.short}
              </div>
            ))}

            {rowLabels.map((label, ri) => {
              const isActiveRow = activeRow === label;
              return (
                <RowDataCells
                  key={label}
                  label={label}
                  isActiveRow={isActiveRow}
                  cols={cols}
                  row={matrix[ri]}
                  max={max}
                  ri={ri}
                  selectedColIdx={selectedColIdx}
                  activeBatch={activeBatch}
                  onCellClick={onCellClick}
                  setHover={setHover}
                />
              );
            })}
          </div>
        </div>
      </div>

      {hover && (
        <CellTooltip
          axis={axis}
          rowLabel={rowLabels[hover.rowIdx]}
          colShort={cols[hover.colIdx].short}
          count={matrix[hover.rowIdx][hover.colIdx]}
          spark={data.rowSparks.get(rowLabels[hover.rowIdx]) ?? []}
          activeBatch={cols[hover.colIdx].batch}
          rect={hover.rect}
        />
      )}
    </>
  );
}

interface RowProps {
  label: string;
  isActiveRow: boolean;
  cols: { batch: string; short: string }[];
  row: number[];
  max: number;
  ri: number;
  selectedColIdx: number;
  activeBatch: string | null;
  onCellClick: (rowKey: string, batch: string) => void;
  setHover: (h: HoverState | null) => void;
}

function RowDataCells({
  label,
  isActiveRow,
  cols,
  row,
  max,
  ri,
  selectedColIdx,
  activeBatch,
  onCellClick,
  setHover,
}: RowProps) {
  return (
    <>
      {cols.map((c, ci) => {
        const v = row[ci];
        const isActiveCell = isActiveRow && c.batch === activeBatch;
        const isSelectedCol = ci === selectedColIdx;
        return (
          <button
            key={c.batch}
            type="button"
            onClick={() => onCellClick(label, c.batch)}
            onMouseEnter={(e) => {
              setHover({
                rowIdx: ri,
                colIdx: ci,
                rect: e.currentTarget.getBoundingClientRect(),
              });
            }}
            onMouseLeave={() => setHover(null)}
            className={cn(
              "grid h-full w-full place-items-center rounded-sm border tabular-nums transition-colors",
              v > 0 ? "text-foreground" : "text-muted-foreground/40",
              isActiveCell
                ? "border-primary"
                : "border-transparent hover:border-border",
            )}
            style={{ backgroundColor: cellColor(v, max, isSelectedCol) }}
            aria-label={`${label} · ${c.short}: ${v} companies`}
          >
            {v > 0 ? v : ""}
          </button>
        );
      })}
    </>
  );
}

function cellColor(v: number, max: number, selectedCol: boolean): string {
  if (v === 0) {
    return selectedCol
      ? "color-mix(in oklab, var(--primary) 5%, var(--muted))"
      : "color-mix(in oklab, var(--muted-foreground) 8%, transparent)";
  }
  const t = max === 0 ? 0 : v / max;
  const pct = Math.round(12 + t * 88);
  if (selectedCol) {
    return `color-mix(in oklab, var(--primary) ${pct}%, color-mix(in oklab, var(--primary) 12%, transparent))`;
  }
  return `color-mix(in oklab, var(--primary) ${pct}%, transparent)`;
}

const TIP_W = 200;
const TIP_H = 64;
const TIP_GAP = 8;

function CellTooltip({
  axis,
  rowLabel,
  colShort,
  count,
  spark,
  activeBatch,
  rect,
}: {
  axis: RowAxis;
  rowLabel: string;
  colShort: string;
  count: number;
  spark: { batch: string; count: number }[];
  activeBatch: string;
  rect: DOMRect;
}) {
  const max = Math.max(1, ...spark.map((s) => s.count));
  const w = 96;
  const h = 18;
  const pts = spark.map((s, i) => {
    const x = spark.length === 1 ? w / 2 : (i / (spark.length - 1)) * w;
    const y = h - (s.count / max) * h;
    return [x, y] as const;
  });
  const path = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const activeIdx = spark.findIndex((s) => s.batch === activeBatch);

  const cx = rect.left + rect.width / 2;
  let top = rect.top - TIP_GAP - TIP_H;
  let placement: "above" | "below" = "above";
  if (top < 8) {
    placement = "below";
    top = rect.bottom + TIP_GAP;
  }
  const rawLeft = cx - TIP_W / 2;
  const left = Math.min(
    Math.max(8, rawLeft),
    window.innerWidth - TIP_W - 8,
  );

  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50 rounded border border-border bg-card px-2 py-1.5 font-mono text-[10px] leading-tight tabular-nums"
      style={{ left, top, width: TIP_W }}
      data-placement={placement}
    >
      <div className="flex items-baseline gap-2">
        <span className="truncate text-foreground">{rowLabel}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{colShort}</span>
        <span className="ml-auto text-foreground">{count}</span>
      </div>
      <svg width={w} height={h} className="mt-1 block">
        <path
          d={path}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {activeIdx >= 0 && (
          <circle
            cx={pts[activeIdx][0]}
            cy={pts[activeIdx][1]}
            r={1.5}
            fill="var(--primary)"
          />
        )}
      </svg>
      <div className="mt-0.5 text-muted-foreground">
        {axis} across {spark.length} batches
      </div>
    </div>
  );
}
