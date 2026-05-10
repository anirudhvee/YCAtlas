"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useCompanies } from "@/components/companies-provider";
import { useFilteredCompanies } from "@/lib/store";
import {
  STATUS_COLORS,
  canonicalCompanies,
  plotCoverage,
  plottedAggregates,
  primaryRegion,
} from "@/lib/overview-data";

const GlobeView = dynamic(
  () => import("./globe-view").then((m) => m.GlobeView),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full place-items-center font-mono text-[11px] text-muted-foreground">
        loading globe…
      </div>
    ),
  },
);

type Granularity = "cities" | "countries" | "regions";

const REGION_TO_CONTINENT: Record<string, string> = {
  "United States of America": "Americas",
  USA: "Americas",
  Canada: "Americas",
  Mexico: "Americas",
  Brazil: "Americas",
  Argentina: "Americas",
  Chile: "Americas",
  Colombia: "Americas",
  "United Kingdom": "Europe",
  Germany: "Europe",
  France: "Europe",
  Spain: "Europe",
  Italy: "Europe",
  Netherlands: "Europe",
  Sweden: "Europe",
  Switzerland: "Europe",
  Ireland: "Europe",
  Poland: "Europe",
  Ukraine: "Europe",
  Russia: "Europe",
  Israel: "Middle East",
  "United Arab Emirates": "Middle East",
  Turkey: "Middle East",
  Egypt: "Africa",
  Nigeria: "Africa",
  Kenya: "Africa",
  "South Africa": "Africa",
  India: "Asia",
  Pakistan: "Asia",
  Bangladesh: "Asia",
  China: "Asia",
  "Hong Kong": "Asia",
  Taiwan: "Asia",
  Japan: "Asia",
  "South Korea": "Asia",
  Singapore: "Asia",
  Indonesia: "Asia",
  Thailand: "Asia",
  Vietnam: "Asia",
  Philippines: "Asia",
  Australia: "Oceania",
  "New Zealand": "Oceania",
};

export function Globe() {
  const all = useCompanies();
  const filtered = useFilteredCompanies(all);
  const [granularity, setGranularity] = useState<Granularity>("cities");

  const universe = useMemo(() => canonicalCompanies(filtered), [filtered]);
  const points = useMemo(() => plottedAggregates(universe), [universe]);
  const coverage = useMemo(() => plotCoverage(universe), [universe]);
  const cityCount = points.length;

  const rows = useMemo(() => {
    if (granularity === "cities") {
      return points
        .slice()
        .sort((a, b) => b.count - a.count)
        .map((p) => ({
          key: p.name,
          label: p.name,
          count: p.count,
          dot: STATUS_COLORS[p.dominantStatus],
        }));
    }
    // Country & region tabs are pickers, not filtered views. Compute
    // counts from the unfiltered canonical universe so clicking a
    // country doesn't collapse the list to just that country.
    const pickerSource = canonicalCompanies(all);
    if (granularity === "countries") {
      const map = new Map<string, number>();
      for (const c of pickerSource) {
        const r = primaryRegion(c);
        if (!r) continue;
        map.set(r, (map.get(r) ?? 0) + 1);
      }
      return [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({
          key: name,
          label: name,
          count,
          dot: "var(--primary)",
        }));
    }
    const map = new Map<string, number>();
    for (const c of pickerSource) {
      const r = primaryRegion(c);
      if (!r) continue;
      const k = REGION_TO_CONTINENT[r] ?? "Other";
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        key: name,
        label: name,
        count,
        dot: "var(--primary)",
      }));
  }, [granularity, points, all]);

  const max = rows[0]?.count ?? 1;

  return (
    <div className="scroll-fine h-full overflow-x-hidden overflow-y-auto">
      <div className="mx-auto max-w-[1480px] px-4 pb-7 pt-4 sm:px-5 sm:pt-5">
        <div className="page-head">
          <div>
            <div className="eyebrow">
              Globe · {coverage.plotted.toLocaleString()} of{" "}
              {coverage.total.toLocaleString()} mapped
            </div>
            <h1>Where the founders are</h1>
            <div className="sub">
              {cityCount} cities plotted ·{" "}
              {coverage.remote > 0
                ? `${coverage.remote.toLocaleString()} remote`
                : "no remote-only"}
              {coverage.unmappedCity > 0
                ? ` · ${coverage.unmappedCity.toLocaleString()} in unmapped cities`
                : ""}
              {coverage.noLocation > 0
                ? ` · ${coverage.noLocation.toLocaleString()} no location`
                : ""}
            </div>
          </div>
          <div className="hidden items-center gap-3 font-mono text-[10.5px] text-muted-foreground lg:flex">
            <GranularitySeg
              granularity={granularity}
              setGranularity={setGranularity}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-[14px] lg:grid-cols-[1.6fr_1fr]">
          <div className="flex flex-col rounded-[10px] border border-border bg-card p-3 transition-colors hover:border-[color:var(--border-strong)] sm:p-3.5">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-3">
              <div className="flex flex-col gap-[3px]">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground">
                  World
                </div>
                <div className="text-[12px] text-muted-foreground">
                  Bubble area = company count · drag to spin · pinch to zoom
                </div>
              </div>
              <div className="scroll-x-hidden -mx-1 flex items-center gap-3 overflow-x-auto px-1 font-mono text-[10px] text-muted-foreground md:flex-wrap md:overflow-visible">
                {(
                  [
                    "Active",
                    "Acquired",
                    "Public",
                    "Inactive",
                  ] as const
                ).map((k) => (
                  <span key={k} className="inline-flex shrink-0 items-center gap-1.5">
                    <span
                      aria-hidden
                      className="inline-block size-2 rounded-sm"
                      style={{ backgroundColor: STATUS_COLORS[k] }}
                    />
                    {k}
                  </span>
                ))}
              </div>
            </div>
            <div className="relative mt-3 h-[420px] overflow-hidden rounded-md sm:h-[520px]">
              <GlobeView />
            </div>
          </div>

          <div className="flex flex-col rounded-[10px] border border-border bg-card p-3 transition-colors hover:border-[color:var(--border-strong)] sm:p-3.5">
            <div className="mb-3 lg:hidden">
              <GranularitySeg
                granularity={granularity}
                setGranularity={setGranularity}
              />
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-[3px]">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground">
                  Top {granularity}
                </div>
                <div className="text-[12px] text-muted-foreground">
                  Sorted by all-time company count
                </div>
              </div>
              <div className="stat-pill">
                <span className="v tabular-nums">{rows.length}</span>
                <span>{granularity}</span>
              </div>
            </div>
            <div className="scroll-fine mt-3 flex max-h-[360px] flex-col gap-0.5 overflow-y-auto sm:max-h-[480px]">
              {rows.length === 0 ? (
                <div className="grid h-32 place-items-center font-mono text-[10px] text-muted-foreground">
                  No data
                </div>
              ) : (
                rows.map((r, i) => {
                  const w = max > 0 ? (r.count / max) * 100 : 0;
                  return (
                    <div
                      key={r.key}
                      className="grid w-full cursor-default grid-cols-[18px_1fr_60px] items-center gap-2 rounded-sm py-[5px] pl-1 pr-1.5 text-left font-mono text-[11px] tabular-nums"
                    >
                      <span className="text-right text-[10px] text-faint">
                        {(i + 1).toString().padStart(2, "0")}
                      </span>
                      <span className="flex flex-col gap-[3px]">
                        <span className="flex items-center gap-1.5 text-[12px] text-foreground">
                          <span
                            aria-hidden
                            className="inline-block size-1.5 rounded-full"
                            style={{ backgroundColor: r.dot }}
                          />
                          <span className="truncate">{r.label}</span>
                        </span>
                        <span className="relative h-1 overflow-hidden rounded-sm bg-[color:var(--bg-soft)]">
                          <span
                            aria-hidden
                            className="absolute inset-y-0 left-0 rounded-sm bg-primary/60"
                            style={{ width: `${Math.max(2, w)}%` }}
                          />
                        </span>
                      </span>
                      <span className="text-right text-muted-foreground">
                        {r.count.toLocaleString()}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GranularitySeg({
  granularity,
  setGranularity,
}: {
  granularity: Granularity;
  setGranularity: (g: Granularity) => void;
}) {
  return (
    <div className="seg" role="tablist" aria-label="Granularity">
      {(
        [
          { id: "cities", label: "Cities" },
          { id: "countries", label: "Countries" },
          { id: "regions", label: "Regions" },
        ] as const
      ).map((opt) => {
        const active = granularity === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={active ? "active" : ""}
            onClick={() => setGranularity(opt.id)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
