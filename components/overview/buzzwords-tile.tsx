"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { useUi } from "@/lib/store";
import { phraseSeries } from "@/lib/overview-data";
import type { Company } from "@/lib/types";
import { batchToShort } from "@/lib/utils";
import { Tile } from "./tile";

const PREVIEW_PHRASES = ["AI", "agent"];

interface Props {
  companies: Company[];
  selectedBatch: string | null;
}

export function BuzzwordsTile({ companies, selectedBatch }: Props) {
  const setView = useUi((s) => s.setView);

  const series = useMemo(
    () =>
      PREVIEW_PHRASES.map((phrase) => ({
        phrase,
        data: phraseSeries(companies, phrase),
      })),
    [companies],
  );

  const markerShort = selectedBatch ? batchToShort(selectedBatch) : null;

  if (companies.length === 0) {
    return (
      <Tile
        header="Buzzwords"
        footer="8 phrases tracked →"
        onClick={() => setView("buzzwords")}
      >
        <div className="grid h-full grid-cols-2 gap-3">
          {PREVIEW_PHRASES.map((phrase) => (
            <div key={phrase} className="flex min-h-0 flex-col gap-1">
              <div className="min-h-0 flex-1 border border-dashed border-border" />
              <div className="font-mono text-[10px] text-muted-foreground">
                {phrase}
              </div>
            </div>
          ))}
        </div>
      </Tile>
    );
  }

  return (
    <Tile
      header="Buzzwords"
      footer="8 phrases tracked →"
      onClick={() => setView("buzzwords")}
    >
      <div className="grid h-full grid-cols-2 gap-3">
        {series.map(({ phrase, data }) => (
          <div key={phrase} className="flex min-h-0 flex-col gap-1">
            <div className="min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data}
                  margin={{ top: 4, right: 2, bottom: 0, left: 2 }}
                >
                  <defs>
                    <linearGradient
                      id={`tile-fill-${phrase}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="var(--primary)"
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--primary)"
                        stopOpacity={0.04}
                      />
                    </linearGradient>
                  </defs>
                  <YAxis hide domain={[0, "dataMax"]} />
                  <Tooltip
                    cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                    content={(props) => (
                      <PhrasePctTooltip {...props} phrase={phrase} />
                    )}
                  />
                  {markerShort && (
                    <ReferenceLine
                      x={markerShort}
                      stroke="var(--primary)"
                      strokeWidth={1}
                      ifOverflow="extendDomain"
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="pct"
                    stroke="var(--primary)"
                    strokeWidth={1.5}
                    strokeOpacity={0.85}
                    fill={`url(#tile-fill-${phrase})`}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">
              {phrase}
            </div>
          </div>
        ))}
      </div>
    </Tile>
  );
}

function PhrasePctTooltip({
  active,
  payload,
  label,
  phrase,
}: TooltipContentProps & { phrase: string }) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0]?.payload as { pct?: number } | undefined;
  if (!row) return null;
  return (
    <div className="rounded border border-border bg-card px-2 py-1.5 font-mono text-[10px] leading-tight tabular-nums">
      <div className="text-foreground">
        {phrase} <span className="text-muted-foreground">·</span> {label}
      </div>
      <div className="text-foreground">{(row.pct ?? 0).toFixed(1)}%</div>
    </div>
  );
}
