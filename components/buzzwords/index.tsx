"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
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
import { useCompanies } from "@/components/companies-provider";
import { filterCompanies } from "@/lib/store";
import { useFilters, usePhrases } from "@/lib/url-state";
import { THRESHOLDS } from "@/lib/compare-data";
import { phraseSeries } from "@/lib/overview-data";
import { DEFAULT_PHRASES } from "@/lib/phrases";
import { batchToShort, cn } from "@/lib/utils";
import type { Company } from "@/lib/types";

const PHRASE_COLORS = [
  "var(--primary)",
  "var(--comp-AI)",
  "var(--comp-Fintech)",
  "var(--comp-SaaS)",
  "var(--comp-Marketplace)",
  "var(--comp-Climate)",
  "var(--comp-DevTools)",
  "var(--comp-Crypto)",
];

function phraseColor(i: number) {
  return PHRASE_COLORS[i % PHRASE_COLORS.length];
}

export function Buzzwords() {
  const all = useCompanies();
  const { filters } = useFilters();
  const { phrases, addPhrase, removePhrase } = usePhrases();

  const filteredForBuzzwords = useMemo(
    () => filterCompanies(all, { ...filters, batches: [] }),
    [all, filters],
  );

  const selectedBatch =
    filters.batches.length === 1 ? filters.batches[0] : null;
  const companies = filteredForBuzzwords;

  const list = useMemo(() => {
    const seen = new Set(DEFAULT_PHRASES.map((p) => p.toLowerCase()));
    const extras = phrases.filter((p) => {
      const k = p.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return [
      ...DEFAULT_PHRASES.map((p) => ({ phrase: p, removable: false })),
      ...extras.map((p) => ({ phrase: p, removable: true })),
    ];
  }, [phrases]);

  const summaryPhrases = list.slice(0, 8).map((l) => l.phrase);

  return (
    <div className="scroll-fine h-full overflow-x-hidden overflow-y-auto">
      <div className="mx-auto max-w-[1480px] px-4 pb-7 pt-4 sm:px-5 sm:pt-5">
        <div className="page-head">
          <div>
            <div className="eyebrow">
              Buzzwords · {list.length} phrases tracked
            </div>
            <h1>What founders are saying</h1>
            <div className="sub">
              Phrase share of cohort over time. Add your own to compare.
            </div>
          </div>
        </div>

        <div className="mt-4 flex h-[320px] flex-col rounded-[10px] border border-border bg-card p-3.5 transition-colors hover:border-[color:var(--border-strong)] sm:h-[300px]">
          <div className="flex flex-col items-start gap-2 md:flex-row md:items-start md:justify-between md:gap-3">
            <div className="flex flex-col gap-[3px]">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground">
                All phrases
              </div>
              <div className="text-[12px] text-muted-foreground">
                % of cohort mentioning the phrase · tap a line to isolate
              </div>
            </div>
            <div className="scroll-x-hidden -mx-1 flex w-full items-center gap-x-3 overflow-x-auto px-1 font-mono text-[10px] text-muted-foreground md:w-auto md:max-w-[360px] md:flex-wrap md:justify-end">
              {summaryPhrases.map((p, i) => (
                <span key={p} className="inline-flex shrink-0 items-center gap-1.5">
                  <span
                    aria-hidden
                    className="inline-block size-2 rounded-sm"
                    style={{ backgroundColor: phraseColor(i) }}
                  />
                  {p}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-2 min-h-0 flex-1">
            <BuzzMultiLine
              phrases={summaryPhrases}
              companies={companies}
              selectedBatch={selectedBatch}
            />
          </div>
        </div>

        <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map(({ phrase, removable }) => (
            <PhraseChart
              key={phrase}
              phrase={phrase}
              companies={companies}
              selectedBatch={selectedBatch}
              removable={removable}
              onRemove={() => removePhrase(phrase)}
            />
          ))}
          <AddPhraseCell
            existing={list.map((l) => l.phrase.toLowerCase())}
            onAdd={addPhrase}
          />
        </div>
      </div>
    </div>
  );
}

interface ChartProps {
  phrase: string;
  companies: Company[];
  selectedBatch: string | null;
  removable: boolean;
  onRemove?: () => void;
}

function PhraseChart({
  phrase,
  companies,
  selectedBatch,
  removable,
  onRemove,
}: ChartProps) {
  const data = useMemo(() => phraseSeries(companies, phrase), [companies, phrase]);

  const stats = useMemo(() => {
    if (data.length === 0) return null;
    // Tiny early YC batches (n=9) show 11% from one match — pure
    // noise. Apply the size + match floors from compare-data.
    const sample = data.filter(
      (d) => d.total >= THRESHOLDS.BUZZ_MIN_BATCH_SIZE,
    );
    const pool = sample.length > 0 ? sample : data;
    let peak = pool[0];
    for (const d of pool) if (d.pct > peak.pct) peak = d;
    const cross =
      data.find(
        (d) =>
          d.pct >= 5 &&
          d.total >= THRESHOLDS.BUZZ_MIN_BATCH_SIZE &&
          d.matches >= THRESHOLDS.BUZZ_MIN_MATCHES,
      ) ?? null;
    return { peak, cross };
  }, [data]);

  const maxPct = stats ? Math.max(stats.peak.pct, 5) : 5;
  const yMax = Math.ceil(maxPct / 5) * 5;

  const tickInterval =
    data.length > 0 ? Math.max(0, Math.floor(data.length / 4) - 1) : 0;

  const subtitle = stats
    ? `peak ${stats.peak.short} · ${
        stats.cross ? `passed 5% in ${stats.cross.short}` : "below 5% throughout"
      }`
    : "no data";

  return (
    <div className="relative flex h-[200px] flex-col rounded-[10px] border border-border bg-card p-3.5 transition-colors hover:border-[color:var(--border-strong)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-mono text-[10px] uppercase tracking-[0.18em] text-foreground">
            {phrase}
          </div>
          <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
            {subtitle}
          </div>
        </div>
        {removable && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${phrase}`}
            className="shrink-0 font-mono text-[14px] leading-none text-muted-foreground/60 transition-colors hover:text-foreground"
          >
            ×
          </button>
        )}
      </div>

      <div className="mt-1 min-h-0 flex-1">
        {data.length === 0 ? (
          <div className="grid h-full place-items-center font-mono text-[10px] text-muted-foreground">
            no data
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient
                  id={`fill-${slug(phrase)}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.04} />
                </linearGradient>
              </defs>
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
              <YAxis hide domain={[0, yMax]} />
              <Tooltip
                cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                content={(props) => (
                  <PhraseChartTooltip {...props} phrase={phrase} />
                )}
              />
              <ReferenceLine
                y={5}
                stroke="var(--muted-foreground)"
                strokeOpacity={0.35}
                strokeDasharray="2 3"
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
                dataKey="pct"
                stroke="var(--primary)"
                strokeWidth={1.5}
                strokeOpacity={0.85}
                fill={`url(#fill-${slug(phrase)})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function AddPhraseCell({
  existing,
  onAdd,
}: {
  existing: string[];
  onAdd: (p: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = draft.trim();
    if (!v) return;
    if (existing.includes(v.toLowerCase())) {
      setError("already tracked");
      return;
    }
    setError(null);
    onAdd(v);
    setDraft("");
  };

  const canSubmit = draft.trim().length > 0 && !error;

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex h-[200px] flex-col rounded-[10px] border bg-card p-3.5 transition-colors",
        error
          ? "border-destructive/60"
          : "border-[color:var(--primary-soft-border)] focus-within:border-[color:var(--primary-line)] hover:border-[color:var(--primary-line)]",
      )}
    >
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
          + new phrase
        </div>
        <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
          Track how often it shows up in pitches
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-stretch justify-center gap-2">
        <label
          className={cn(
            "flex items-center gap-2 rounded border bg-background pl-3 pr-1.5 py-1.5 transition-colors",
            error
              ? "border-destructive/60"
              : "border-border focus-within:border-[color:var(--primary-line)]",
          )}
        >
          <input
            type="text"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (error) setError(null);
            }}
            placeholder="e.g. agentic"
            aria-label="New phrase"
            className="flex-1 bg-transparent font-mono text-[12px] text-foreground outline-none placeholder:text-muted-foreground/60"
          />
          <button
            type="submit"
            disabled={!canSubmit}
            aria-label="Add phrase"
            className={cn(
              "grid size-6 shrink-0 place-items-center rounded transition-colors",
              canSubmit
                ? "bg-primary/15 text-primary hover:bg-primary/25"
                : "text-muted-foreground/40",
            )}
          >
            <Plus className="size-3.5" strokeWidth={2} />
          </button>
        </label>
        {error && (
          <span className="font-mono text-[9px] text-destructive">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}

function slug(s: string): string {
  return s.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
}

function PhraseChartTooltip({
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

function BuzzMultiLine({
  phrases,
  companies,
  selectedBatch,
}: {
  phrases: string[];
  companies: Company[];
  selectedBatch: string | null;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((es) => {
      for (const e of es)
        setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => {
    return phrases.map((p) => phraseSeries(companies, p));
  }, [phrases, companies]);

  // Build a unified x-axis using the longest series.
  const longest = data.reduce(
    (m, s) => (s.length > m.length ? s : m),
    [] as { short: string; pct: number; batch: string }[],
  );
  const xLookup = new Map<string, number>();
  longest.forEach((d, i) => xLookup.set(d.short, i));

  const { w, h } = size;
  const padL = 36,
    padR = 8,
    padT = 8,
    padB = 22;
  const innerW = Math.max(0, w - padL - padR);
  const innerH = Math.max(0, h - padT - padB);
  const xAt = (i: number) =>
    padL +
    (longest.length === 1 ? innerW / 2 : (i / (longest.length - 1)) * innerW);

  const max = Math.max(20, ...data.flat().map((d) => d.pct));
  const yAt = (v: number) => padT + innerH - (v / max) * innerH;

  const yTicks = [0, max * 0.25, max * 0.5, max * 0.75, max].map((v) =>
    Math.round(v),
  );
  const xInt = Math.max(1, Math.floor(longest.length / 8));

  const selIdx = selectedBatch
    ? longest.findIndex((d) => d.batch === selectedBatch)
    : -1;

  return (
    <div
      ref={ref}
      className="size-full"
      onMouseLeave={() => setHover(null)}
    >
      {w > 0 && longest.length > 0 && (
        <svg width={w} height={h} className="block">
          <g>
            {yTicks.map((t) => (
              <line
                key={t}
                x1={padL}
                x2={w - padR}
                y1={yAt(t)}
                y2={yAt(t)}
                stroke="var(--grid-line)"
              />
            ))}
          </g>
          {selIdx >= 0 && (
            <line
              x1={xAt(selIdx)}
              x2={xAt(selIdx)}
              y1={padT}
              y2={h - padB}
              stroke="var(--primary)"
              strokeWidth={1.5}
            />
          )}
          {data.map((s, i) => {
            const path = s
              .map((d, j) => {
                const xi = xLookup.get(d.short);
                if (xi == null) return "";
                return `${j === 0 ? "M" : "L"}${xAt(xi)},${yAt(d.pct)}`;
              })
              .filter(Boolean)
              .join("");
            const op = hover == null ? 1 : hover === i ? 1 : 0.2;
            return (
              <path
                key={phrases[i]}
                d={path}
                fill="none"
                stroke={phraseColor(i)}
                strokeWidth={hover === i ? 2.2 : 1.5}
                strokeOpacity={op}
                onMouseEnter={() => setHover(i)}
                style={{ cursor: "pointer" }}
              />
            );
          })}
          <g
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9.5,
              fill: "var(--muted-foreground)",
            }}
          >
            {yTicks.map((t) => (
              <text
                key={t}
                x={padL - 6}
                y={yAt(t)}
                dy="0.32em"
                textAnchor="end"
              >
                {t}%
              </text>
            ))}
            {longest.map(
              (d, i) =>
                (i % xInt === 0 || i === longest.length - 1) && (
                  <text
                    key={d.short}
                    x={xAt(i)}
                    y={h - 6}
                    textAnchor="middle"
                  >
                    {d.short}
                  </text>
                ),
            )}
          </g>
        </svg>
      )}
    </div>
  );
}
