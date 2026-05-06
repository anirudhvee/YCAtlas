"use client";

import { useMemo } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import landTopology from "world-atlas/land-110m.json";
import { useUi } from "@/lib/store";
import {
  CITY_COORDS,
  STATUS_COLORS,
  cityAggregates,
  topCity,
} from "@/lib/overview-data";
import type { Company } from "@/lib/types";
import { Tile } from "./tile";

const VIEWBOX_W = 360;
const VIEWBOX_H = 170;

// world-atlas TopoJSON types don't line up with topojson's strict generics;
// the `any` cast is contained to this module-load conversion.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _topo = landTopology as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const landFeature: any = feature(_topo, _topo.objects.land);
const projection = geoNaturalEarth1().fitSize(
  [VIEWBOX_W, VIEWBOX_H],
  landFeature,
);
const pathGen = geoPath(projection);
const LAND_PATH = pathGen(landFeature);

export function GeographyTile({ companies }: { companies: Company[] }) {
  const setView = useUi((s) => s.setView);

  const top = useMemo(() => topCity(companies), [companies]);

  const dots = useMemo(() => {
    const aggs = cityAggregates(companies);
    const max = aggs.reduce((m, a) => Math.max(m, a.count), 0);
    return aggs
      .map((a) => {
        const coord = CITY_COORDS[a.name];
        if (!coord) return null;
        const projected = projection([coord[1], coord[0]]); // [lng, lat]
        if (!projected) return null;
        // sqrt scaling keeps the long tail visible alongside SF/NY.
        const r = max > 0 ? 1 + Math.sqrt(a.count / max) * 4 : 1;
        return {
          name: a.name,
          count: a.count,
          x: projected[0],
          y: projected[1],
          r,
          color: STATUS_COLORS[a.dominantStatus],
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null)
      // Render small dots first so big dots draw on top.
      .sort((a, b) => a.r - b.r);
  }, [companies]);

  return (
    <Tile
      header="Geography"
      footer="globe →"
      onClick={() => setView("globe")}
    >
      <div className="flex h-full flex-col gap-1.5">
        <div className="min-h-0 flex-1">
          <svg
            viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
            preserveAspectRatio="xMidYMid meet"
            className="h-full w-full"
          >
            {LAND_PATH && (
              <path
                d={LAND_PATH}
                fill="color-mix(in srgb, var(--muted-foreground) 28%, transparent)"
              />
            )}
            {dots.map((d) => (
              <circle
                key={d.name}
                cx={d.x}
                cy={d.y}
                r={d.r}
                fill={d.color}
                fillOpacity={0.85}
              >
                <title>{`${d.name}: ${d.count.toLocaleString()}`}</title>
              </circle>
            ))}
          </svg>
        </div>
        <div className="font-mono text-[10px] tabular-nums">
          {top ? (
            <>
              <span className="text-muted-foreground">Top city: </span>
              <span className="text-foreground">{top.name}</span>
              <span className="text-muted-foreground">
                {" "}
                · {top.count.toLocaleString()}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">No city data</span>
          )}
        </div>
      </div>
    </Tile>
  );
}
