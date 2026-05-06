"use client";

import { useMemo } from "react";
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  YAxis,
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
                <LineChart
                  data={data}
                  margin={{ top: 4, right: 2, bottom: 0, left: 2 }}
                >
                  <YAxis hide domain={[0, "dataMax"]} />
                  <Line
                    type="monotone"
                    dataKey="pct"
                    stroke="var(--muted-foreground)"
                    strokeWidth={1.25}
                    dot={false}
                    isAnimationActive={false}
                  />
                  {markerShort && (
                    <ReferenceLine
                      x={markerShort}
                      stroke="var(--primary)"
                      strokeWidth={1}
                      ifOverflow="extendDomain"
                    />
                  )}
                </LineChart>
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
