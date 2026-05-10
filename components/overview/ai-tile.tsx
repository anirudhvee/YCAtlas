"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { useUi } from "@/lib/store";
import { aiShareSeries, findAiInflection } from "@/lib/overview-data";
import type { Company } from "@/lib/types";
import { batchToShort } from "@/lib/utils";
import { Tile } from "./tile";

interface Props {
  companies: Company[];
  selectedBatch: string | null;
}

export function AiTile({ companies, selectedBatch }: Props) {
  const setView = useUi((s) => s.setView);

  const { data, inflection, last, deltaShortWindow } = useMemo(() => {
    const series = aiShareSeries(companies);
    const lastRow = series.length > 0 ? series[series.length - 1] : null;
    const fiveBack =
      series.length > 5 ? series[series.length - 6] : series[0] ?? null;
    return {
      data: series,
      inflection: findAiInflection(series),
      last: lastRow,
      deltaShortWindow:
        lastRow && fiveBack ? lastRow.pct - fiveBack.pct : null,
    };
  }, [companies]);

  const markerShort = selectedBatch ? batchToShort(selectedBatch) : null;
  const inflectionShort = inflection ? inflection.short : null;

  return (
    <Tile
      title="Where AI ate YC"
      meta="share of cohort"
      footer={<>buzzwords →</>}
      onClick={() => setView("buzzwords")}
    >
      <div className="flex h-full flex-col gap-1.5">
        {last && (
          <div className="flex items-baseline gap-1.5 font-mono">
            <span className="text-[26px] font-medium tracking-[-0.01em] tabular-nums text-foreground leading-none">
              {last.pct.toFixed(0)}%
            </span>
            {deltaShortWindow !== null && (
              <span className="text-[10.5px] text-primary">
                ▲ {deltaShortWindow.toFixed(0)} pts vs 5 batches ago
              </span>
            )}
          </div>
        )}
        <div className="-mt-0.5 min-h-0 flex-1">
          {data.length === 0 ? (
            <div className="grid h-full place-items-center font-mono text-[10px] text-muted-foreground">
              No data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 4, right: 2, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient id="ai-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--primary)"
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--primary)"
                      stopOpacity={0.04}
                    />
                  </linearGradient>
                </defs>
                <XAxis dataKey="short" hide />
                <YAxis hide domain={[0, 100]} />
                <Tooltip
                  cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                  content={AiShareTooltip}
                />
                {inflectionShort && (
                  <ReferenceLine
                    x={inflectionShort}
                    stroke="var(--foreground)"
                    strokeOpacity={0.45}
                    strokeDasharray="2 3"
                    strokeWidth={1}
                    ifOverflow="extendDomain"
                  />
                )}
                {markerShort && (
                  <ReferenceLine
                    x={markerShort}
                    stroke="var(--primary)"
                    strokeWidth={1.5}
                    ifOverflow="extendDomain"
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="pct"
                  stroke="var(--primary)"
                  strokeWidth={1.5}
                  fill="url(#ai-fill)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="font-mono text-[10px] text-muted-foreground tabular-nums">
          jump in {inflectionShort ?? "—"}
        </div>
      </div>
    </Tile>
  );
}

function AiShareTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0]?.payload as
    | { matches?: number; total?: number; pct?: number }
    | undefined;
  if (!row) return null;
  return (
    <div className="rounded border border-border bg-card px-2 py-1.5 font-mono text-[10px] leading-tight tabular-nums">
      <div className="text-foreground">{label}</div>
      <div className="text-muted-foreground">
        <span className="text-foreground">{(row.pct ?? 0).toFixed(0)}%</span>
        {" · "}
        {row.matches ?? 0} of {row.total ?? 0}
      </div>
    </div>
  );
}
