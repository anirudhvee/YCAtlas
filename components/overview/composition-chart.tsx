"use client";

import { useMemo } from "react";
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import {
  COMPOSITION_COLORS,
  COMPOSITION_TAG_GROUPS,
  compositionSeries,
} from "@/lib/overview-data";
import type { Company } from "@/lib/types";
import { batchToShort } from "@/lib/utils";
import { ChartCard } from "./chart-card";

interface Props {
  companies: Company[];
  selectedBatch: string | null;
}

export function CompositionChart({ companies, selectedBatch }: Props) {
  const data = useMemo(() => compositionSeries(companies), [companies]);

  const tickInterval = Math.max(0, Math.floor(data.length / 8) - 1);

  if (data.length === 0) {
    return (
      <ChartCard title="COMPOSITION" subtitle="Tag mix per batch, over time" className="h-[280px]">
        <div className="grid h-full place-items-center font-mono text-[10px] text-muted-foreground">
          No data
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="COMPOSITION" subtitle="Tag mix per batch, over time" className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
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
            width={28}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
            content={CompositionTooltip}
          />
          {selectedBatch && (
            <ReferenceLine
              x={batchToShort(selectedBatch)}
              stroke="var(--primary)"
              strokeWidth={1.5}
              ifOverflow="extendDomain"
            />
          )}
          {COMPOSITION_TAG_GROUPS.map((g) => (
            <Line
              key={g.label}
              type="monotone"
              dataKey={g.label}
              stroke={COMPOSITION_COLORS[g.label]}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function CompositionTooltip({
  active,
  payload,
  label,
}: TooltipContentProps) {
  if (!active || !payload || !payload.length) return null;
  const sorted = [...payload].sort(
    (a, b) => Number(b.value ?? 0) - Number(a.value ?? 0),
  );
  return (
    <div className="rounded border border-border bg-card px-2 py-1.5 font-mono text-[10px] leading-tight tabular-nums">
      <div className="mb-1 text-foreground">{label}</div>
      {sorted.map((p) => {
        const key = String(p.dataKey ?? "");
        return (
          <div
            key={key}
            className="flex items-center gap-2"
            style={{ color: p.color as string }}
          >
            <span className="w-28">{key}</span>
            <span className="text-foreground">
              {Number(p.value ?? 0).toFixed(0)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
