"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { useCompanies } from "@/components/companies-provider";
import { AttributionBlock } from "@/components/attribution";
import {
  aggregateByBatch,
  aggregatesAboveMinSize,
  aggregatesExcludingUnspecified,
} from "@/lib/overview-data";
interface Props {
  totalCompanies: number;
  batchRange: string;
  size?: "compact" | "comfortable";
}

export function StatsCard({
  totalCompanies,
  batchRange,
  size = "compact",
}: Props) {
  const all = useCompanies();
  const aggregates = useMemo(
    () =>
      aggregatesAboveMinSize(
        aggregatesExcludingUnspecified(aggregateByBatch(all)),
      ),
    [all],
  );

  const isComfy = size === "comfortable";
  const labelSize = isComfy ? "text-[12px]" : "text-[10.5px]";
  const numberSize = isComfy ? "text-[20px]" : "text-[16px]";
  const sparkH = isComfy ? 28 : 22;
  const sourceSize = isComfy ? "text-[13px]" : "text-[8px]";

  return (
    <div
      className={
        isComfy
          ? "rounded-xl border border-border bg-background p-4 font-mono leading-none"
          : "rounded-lg border border-border bg-background p-3 font-mono text-[10.5px] leading-none"
      }
    >
      <div className="flex items-center justify-between">
        <span className={`${labelSize} text-muted-foreground`}>Companies</span>
        <span
          className={`${numberSize} font-medium tracking-tight tabular-nums text-foreground`}
        >
          {totalCompanies.toLocaleString()}
        </span>
      </div>
      <div className={`-mx-0.5 mt-2.5`} style={{ height: sparkH }}>
        {aggregates.length > 1 && (
          <Sparkline aggregates={aggregates} height={sparkH} />
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className={`${labelSize} text-muted-foreground`}>Batches</span>
        <span className={`tabular-nums text-foreground ${labelSize}`}>
          {batchRange}
        </span>
      </div>
      <div className="my-3 h-px bg-border" />
      <a
        href="https://github.com/yc-oss/api"
        target="_blank"
        rel="noopener noreferrer"
        className={`${sourceSize} group inline-flex items-baseline gap-1 text-faint transition-colors hover:text-foreground`}
      >
        <span>
          Data from{" "}
          <span className="text-muted-foreground transition-colors group-hover:text-primary">
            yc-oss/api
          </span>
        </span>
        <ArrowUpRight
          className="size-2.5 translate-y-[1px] transition-colors group-hover:text-primary"
          strokeWidth={1.75}
        />
      </a>
      <AttributionBlock size={size} />
    </div>
  );
}

function Sparkline({
  aggregates,
  height,
}: {
  aggregates: { short: string; total: number }[];
  height: number;
}) {
  const [w, setW] = useState(0);
  const refCb = (el: HTMLDivElement | null) => {
    if (!el) return;
    if (w === 0) setW(el.clientWidth);
    const ro = new ResizeObserver((es) => {
      for (const e of es) setW(e.contentRect.width);
    });
    ro.observe(el);
  };

  const max = Math.max(1, ...aggregates.map((a) => a.total));
  const xAt = (i: number) =>
    aggregates.length === 1 ? w / 2 : (i / (aggregates.length - 1)) * w;
  const yAt = (v: number) => height - 2 - (v / max) * (height - 4);
  const linePath = aggregates
    .map((a, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(a.total)}`)
    .join("");

  return (
    <div ref={refCb} style={{ width: "100%", height }}>
      {w > 0 && (
        <svg width={w} height={height} className="block">
          <path
            d={linePath}
            fill="none"
            stroke="var(--muted-foreground)"
            strokeWidth="1.25"
            strokeOpacity="0.65"
          />
        </svg>
      )}
    </div>
  );
}
