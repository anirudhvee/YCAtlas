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
import {
  aggregateByBatch,
  aggregatesAboveMinSize,
  aggregatesExcludingUnspecified,
  STATUS_COLORS,
  STATUS_KEYS,
} from "@/lib/overview-data";
import type { Company } from "@/lib/types";
import { batchToShort } from "@/lib/utils";
import { ChartCard, Legend, StatPill } from "./chart-card";

interface Props {
  companies: Company[];
  selectedBatch: string | null;
  /** When true, render the chart only — page composes head/legend itself. */
  bare?: boolean;
}

export function GrowthChart({ companies, selectedBatch, bare = false }: Props) {
  const aggs = useMemo(
    () =>
      aggregatesAboveMinSize(
        aggregatesExcludingUnspecified(aggregateByBatch(companies)),
      ),
    [companies],
  );
  const data = useMemo(
    () =>
      aggs.map((a) => ({
        short: a.short,
        Active: a.byStatus.Active,
        Inactive: a.byStatus.Inactive,
        Acquired: a.byStatus.Acquired,
        Public: a.byStatus.Public,
      })),
    [aggs],
  );
  const tickInterval = Math.max(0, Math.floor(data.length / 8) - 1);

  const last = aggs[aggs.length - 1];
  const peak = aggs.reduce((m, a) => (a.total > m.total ? a : m), aggs[0]);

  const chart = (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
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
        />
        <Tooltip
          cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
          content={GrowthTooltip}
        />
        {selectedBatch && (
          <ReferenceLine
            x={batchToShort(selectedBatch)}
            stroke="var(--primary)"
            strokeWidth={1.5}
            ifOverflow="extendDomain"
          />
        )}
        <Area
          type="monotone"
          dataKey="Inactive"
          stackId="1"
          fill={STATUS_COLORS.Inactive}
          fillOpacity={0.85}
          stroke="none"
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="Acquired"
          stackId="1"
          fill={STATUS_COLORS.Acquired}
          fillOpacity={0.85}
          stroke="none"
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="Public"
          stackId="1"
          fill={STATUS_COLORS.Public}
          fillOpacity={0.85}
          stroke="none"
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="Active"
          stackId="1"
          fill={STATUS_COLORS.Active}
          fillOpacity={0.85}
          stroke="none"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );

  if (bare) {
    return (
      <div className="size-full">
        {data.length === 0 ? (
          <div className="grid h-full place-items-center font-mono text-[10px] text-muted-foreground">
            No data
          </div>
        ) : (
          chart
        )}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <ChartCard
        title="Growth"
        subtitle="Companies per batch · alive vs dead"
        className="h-[280px]"
      >
        <div className="grid h-full place-items-center font-mono text-[10px] text-muted-foreground">
          No data
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Growth"
      subtitle="Companies per batch · alive vs dead"
      className="h-[300px]"
      selected={selectedBatch !== null}
      headRight={
        <Legend
          items={STATUS_KEYS.map((k) => ({
            label: k,
            color: STATUS_COLORS[k],
          }))}
        />
      }
      stats={
        last && peak ? (
          <>
            <StatPill label="Latest" value={last.total} hint={`in ${last.short}`} />
            <StatPill label="Peak" value={peak.total} hint={`in ${peak.short}`} />
          </>
        ) : undefined
      }
    >
      {chart}
    </ChartCard>
  );
}

function GrowthTooltip({
  active,
  payload,
  label,
}: TooltipContentProps) {
  if (!active || !payload || !payload.length) return null;
  const ordered = STATUS_KEYS.map((k) =>
    payload.find((p) => p.dataKey === k),
  ).filter((p): p is NonNullable<typeof p> => Boolean(p));
  return (
    <div className="rounded border border-border bg-card px-2 py-1.5 font-mono text-[10px] leading-tight tabular-nums">
      <div className="mb-1 text-foreground">{label}</div>
      {ordered.map((p) => {
        const key = String(p.dataKey ?? "");
        return (
          <div
            key={key}
            className="flex items-center gap-2"
            style={{ color: p.color as string }}
          >
            <span className="w-14">{key}</span>
            <span className="text-foreground">
              {Number(p.value ?? 0).toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
