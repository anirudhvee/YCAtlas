"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import GlobeGl, { type GlobeMethods } from "react-globe.gl";
import { feature } from "topojson-client";
import { MeshBasicMaterial, Color } from "three";
import countriesTopology from "world-atlas/countries-110m.json";
import { useTheme } from "next-themes";
import { useCompanies } from "@/components/companies-provider";
import { useUi } from "@/lib/store";
import { useFilteredCompanies } from "@/lib/url-state";
import type { Company } from "@/lib/types";
import {
  CITY_COORDS,
  MIN_BATCH_SIZE,
  STATUS_COLORS,
  canonicalCompanies,
  extractCity,
} from "@/lib/overview-data";
import { batchToShort, batchToSortKey } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _topo = countriesTopology as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _countries: any = feature(_topo, _topo.objects.countries);
const COUNTRY_FEATURES: object[] = Array.isArray(_countries?.features)
  ? _countries.features
  : [];

interface CityDot {
  lat: number;
  lng: number;
  city: string;
  count: number;
  topCount: number;
  dominantStatus: "Active" | "Inactive" | "Acquired" | "Public";
  size: number;
  representative: Company;
}

interface TopRing {
  lat: number;
  lng: number;
  city: string;
  topCount: number;
}

const RESUME_DELAY_MS = 2500;
const ROTATE_SPEED = 0.55;

interface ResolvedTheme {
  isDark: boolean;
  sphere: string;
  continent: string;
  card: string;
  border: string;
  primary: string;
  foreground: string;
  muted: string;
}

const THEME_TOKENS: Record<"dark" | "light", ResolvedTheme> = {
  dark: {
    isDark: true,
    sphere: "#0d0e12",
    continent: "#4a4d57",
    card: "#141416",
    border: "#23232a",
    primary: "#ff6600",
    foreground: "#ededec",
    muted: "#86868d",
  },
  light: {
    isDark: false,
    sphere: "#ececea",
    continent: "#a8a8a1",
    card: "#ffffff",
    border: "#e7e7df",
    primary: "#ff6600",
    foreground: "#18181b",
    muted: "#6f6f76",
  },
};

function pickTheme(themeKey: string | undefined): ResolvedTheme {
  return themeKey === "light" ? THEME_TOKENS.light : THEME_TOKENS.dark;
}

export function GlobeView() {
  const all = useCompanies();
  const filtered = useFilteredCompanies(all);
  const setSelectedCompany = useUi((s) => s.setSelectedCompany);
  const { resolvedTheme } = useTheme();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);

  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const theme = useMemo<ResolvedTheme>(
    () => pickTheme(resolvedTheme),
    [resolvedTheme],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.floor(r.width), h: Math.floor(r.height) });
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setSize({ w: Math.floor(r.width), h: Math.floor(r.height) });
    return () => ro.disconnect();
  }, []);

  const [globeMaterial] = useState(
    () => new MeshBasicMaterial({ color: new Color("#1d1f25") }),
  );
  useEffect(() => {
    globeMaterial.color.set(theme.sphere);
  }, [theme.sphere, globeMaterial]);

  const sliderBatches = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of all) {
      if (c.batch === "Unspecified") continue;
      counts.set(c.batch, (counts.get(c.batch) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, n]) => n >= MIN_BATCH_SIZE)
      .map(([b]) => b)
      .sort((a, b) => batchToSortKey(a) - batchToSortKey(b));
  }, [all]);

  const [maxBatchIdx, setMaxBatchIdx] = useState<number | null>(null);
  const effectiveIdx =
    maxBatchIdx ?? Math.max(0, sliderBatches.length - 1);

  const maxBatchSortKey = useMemo(() => {
    if (sliderBatches.length === 0) return Number.POSITIVE_INFINITY;
    return batchToSortKey(sliderBatches[effectiveIdx]);
  }, [effectiveIdx, sliderBatches]);

  const dots = useMemo<CityDot[]>(() => {
    interface Bucket {
      lat: number;
      lng: number;
      city: string;
      count: number;
      topCount: number;
      maxTeam: number;
      maxTeamStatus: CityDot["dominantStatus"];
      representative: Company;
    }
    const map = new Map<string, Bucket>();
    for (const c of canonicalCompanies(filtered)) {
      const k = batchToSortKey(c.batch);
      if (Number.isFinite(k) && k > maxBatchSortKey) continue;
      const city = extractCity(c.all_locations);
      if (!city) continue;
      const coord = CITY_COORDS[city];
      if (!coord) continue;
      let b = map.get(city);
      if (!b) {
        b = {
          lat: coord[0],
          lng: coord[1],
          city,
          count: 0,
          topCount: 0,
          maxTeam: 0,
          maxTeamStatus: "Active",
          representative: c,
        };
        map.set(city, b);
      }
      b.count++;
      if (c.top_company === true) b.topCount++;
      const ts = c.team_size ?? 0;
      if (ts > b.maxTeam) {
        b.maxTeam = ts;
        b.maxTeamStatus = c.status as CityDot["dominantStatus"];
        b.representative = c;
      }
    }
    const arr = [...map.values()];
    const maxCount = arr.reduce((m, b) => (b.count > m ? b.count : m), 0);
    return arr.map<CityDot>((b) => {
      const t = maxCount > 0 ? Math.sqrt(b.count / maxCount) : 0;
      return {
        lat: b.lat,
        lng: b.lng,
        city: b.city,
        count: b.count,
        topCount: b.topCount,
        dominantStatus: b.maxTeamStatus,
        size: 0.55 + t * 1.85,
        representative: b.representative,
      };
    });
  }, [filtered, maxBatchSortKey]);

  const totalDots = dots.reduce((s, d) => s + d.count, 0);

  const topRings = useMemo<TopRing[]>(() => {
    return dots
      .filter((d) => d.topCount > 0)
      .sort((a, b) => b.topCount - a.topCount)
      .slice(0, 8)
      .map((d) => ({
        lat: d.lat,
        lng: d.lng,
        city: d.city,
        topCount: d.topCount,
      }));
  }, [dots]);

  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    const controls = g.controls();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = controls as any;
    controlsRef.current = c;
    c.autoRotate = true;
    c.autoRotateSpeed = ROTATE_SPEED;
    c.enableDamping = true;
    c.enableZoom = true;
    c.rotateSpeed = 0.4;

    const onStart = () => {
      c.autoRotate = false;
      if (resumeTimer.current) {
        clearTimeout(resumeTimer.current);
        resumeTimer.current = null;
      }
    };
    const onEnd = () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
      resumeTimer.current = setTimeout(() => {
        c.autoRotate = true;
      }, RESUME_DELAY_MS);
    };
    c.addEventListener("start", onStart);
    c.addEventListener("end", onEnd);
    return () => {
      c.removeEventListener("start", onStart);
      c.removeEventListener("end", onEnd);
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
  }, [size.w, size.h]);

  const handlePointEnter = () => {
    const c = controlsRef.current;
    if (!c) return;
    if (resumeTimer.current) {
      clearTimeout(resumeTimer.current);
      resumeTimer.current = null;
    }
    c.autoRotate = false;
  };

  const handlePointLeave = () => {
    const c = controlsRef.current;
    if (!c) return;
    if (resumeTimer.current) {
      clearTimeout(resumeTimer.current);
      resumeTimer.current = null;
    }
    c.autoRotate = true;
  };

  const cameraInitialized = useRef(false);
  useEffect(() => {
    if (cameraInitialized.current) return;
    const g = globeRef.current;
    if (!g || size.w === 0 || size.h === 0) return;
    g.pointOfView({ lat: 20, lng: -122.42, altitude: 2.2 }, 0);
    cameraInitialized.current = true;
  }, [size.w, size.h]);

  const sliderLabel =
    sliderBatches.length > 0
      ? batchToShort(sliderBatches[effectiveIdx])
      : "—";

  const sliderPct =
    sliderBatches.length > 1
      ? (effectiveIdx / (sliderBatches.length - 1)) * 100
      : 100;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden"
      style={{ background: "var(--background)" }}
    >
      {size.w > 0 && size.h > 0 && (
        <GlobeGl
          ref={globeRef}
          width={size.w}
          height={size.h}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl={null}
          showGlobe
          showAtmosphere
          atmosphereColor={theme.isDark ? "#4a5a7e" : "#7a8aa8"}
          atmosphereAltitude={0.22}
          showGraticules={false}
          globeMaterial={globeMaterial}
          hexPolygonsData={[]}
          polygonsData={COUNTRY_FEATURES}
          polygonAltitude={0.005}
          polygonCapColor={() => "rgba(0,0,0,0)"}
          polygonSideColor={() => "rgba(0,0,0,0)"}
          polygonStrokeColor={() => theme.continent}
          pointsData={dots}
          pointLat={(d: object) => (d as CityDot).lat}
          pointLng={(d: object) => (d as CityDot).lng}
          pointColor={(d: object) =>
            STATUS_COLORS[(d as CityDot).dominantStatus]
          }
          pointAltitude={0.01}
          pointRadius={(d: object) => (d as CityDot).size}
          pointResolution={16}
          pointsMerge={false}
          onPointHover={(point: object | null) => {
            if (point) {
              handlePointEnter();
            } else {
              handlePointLeave();
            }
          }}
          pointLabel={(d: object) => {
            const x = d as CityDot;
            return `<div style="font-family:var(--font-mono),monospace;font-size:10px;background:${theme.card};border:1px solid ${theme.border};color:${theme.foreground};padding:6px 8px;border-radius:4px;min-width:140px;line-height:1.45">
              <div style="display:flex;justify-content:space-between;gap:12px"><span>${escapeHtml(
                x.city,
              )}</span><span>${x.count}</span></div>
              ${x.topCount > 0 ? `<div style="color:${theme.primary};margin-top:3px">${x.topCount} top company</div>` : ""}
            </div>`;
          }}
          onPointClick={(point: object) => {
            const dot = point as CityDot;
            if (dot.representative) setSelectedCompany(dot.representative);
          }}
          ringsData={topRings}
          ringLat={(r: object) => (r as TopRing).lat}
          ringLng={(r: object) => (r as TopRing).lng}
          ringMaxRadius={2.4}
          ringPropagationSpeed={1.6}
          ringRepeatPeriod={2200}
          ringColor={() => (t: number) =>
            `rgba(255, 102, 0, ${(1 - t) * 0.5})`
          }
        />
      )}

      <div className="pointer-events-none absolute right-3 top-3 rounded-md border border-border bg-card/85 px-2 py-1 font-mono text-[10px] tabular-nums backdrop-blur">
        <span className="text-muted-foreground">on globe </span>
        <span className="text-foreground">
          {totalDots.toLocaleString()}
        </span>
        <span className="text-muted-foreground">
          {" "}
          · {dots.length.toLocaleString()} cities
        </span>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3 font-mono text-[10px] tabular-nums">
        <div className="pointer-events-auto flex w-full max-w-[520px] flex-col gap-1 rounded-md border border-border bg-card/85 px-3 py-2 backdrop-blur">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="uppercase tracking-[0.18em]">through</span>
            <span className="text-primary">{sliderLabel}</span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(0, sliderBatches.length - 1)}
            value={effectiveIdx}
            onChange={(e) => setMaxBatchIdx(Number(e.target.value))}
            aria-label="Max batch"
            className="slider-clean w-full"
            style={{
              background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${sliderPct}%, var(--border) ${sliderPct}%, var(--border) 100%)`,
            }}
          />
          <div className="flex justify-between text-[9px] text-muted-foreground/70">
            <span>{sliderBatches[0] ? batchToShort(sliderBatches[0]) : ""}</span>
            <span>
              {sliderBatches.length > 0
                ? batchToShort(sliderBatches[sliderBatches.length - 1])
                : ""}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
