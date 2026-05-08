"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { useCompanies } from "@/components/companies-provider";
import { filterCompanies, useUi } from "@/lib/store";
import { useMounted } from "@/lib/use-mounted";
import { phraseSeries } from "@/lib/overview-data";
import { batchToShort, cn } from "@/lib/utils";
import type { Company } from "@/lib/types";

// 11 defaults + the add-phrase cell complete a 12-up grid.
const DEFAULT_PHRASES = [
  "AI",
  "agent",
  "agentic",
  "Cursor for",
  "Claude",
  "autonomous",
  "real-time",
  "marketplace",
  "social network",
  "on-demand",
  "crypto",
];

export function Buzzwords() {
  const all = useCompanies();
  const filters = useUi((s) => s.filters);
  const phrases = useUi((s) => s.phrases);
  const addPhrase = useUi((s) => s.addPhrase);
  const removePhrase = useUi((s) => s.removePhrase);
  const mounted = useMounted();

  // Time-series view: strip the batches filter so the selected
  // batch shows as a ReferenceLine instead of collapsing the chart.
  const filteredForBuzzwords = useMemo(
    () => filterCompanies(all, { ...filters, batches: [] }),
    [all, filters],
  );

  const selectedBatch =
    mounted && filters.batches.length === 1 ? filters.batches[0] : null;
  const companies = mounted ? filteredForBuzzwords : all;

  const list = useMemo(() => {
    const seen = new Set(DEFAULT_PHRASES.map((p) => p.toLowerCase()));
    const extras = mounted
      ? phrases.filter((p) => {
          const k = p.toLowerCase();
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
      : [];
    return [
      ...DEFAULT_PHRASES.map((p) => ({ phrase: p, removable: false })),
      ...extras.map((p) => ({ phrase: p, removable: true })),
    ];
  }, [phrases, mounted]);

  return (
    <div
      className="h-full overflow-y-auto p-4"
      style={{ paddingBottom: "120px" }}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
    let peak = data[0];
    for (const d of data) if (d.pct > peak.pct) peak = d;
    const cross = data.find((d) => d.pct >= 5) ?? null;
    return { peak, cross };
  }, [data]);

  const maxPct = stats ? Math.max(stats.peak.pct, 5) : 5;
  const yMax = Math.ceil(maxPct / 5) * 5;

  const tickInterval =
    data.length > 0 ? Math.max(0, Math.floor(data.length / 4) - 1) : 0;

  const subtitle = stats
    ? `peak ${stats.peak.short} · ${
        stats.cross ? `5%↑ ${stats.cross.short}` : "below 5% throughout"
      }`
    : "no data";

  return (
    <div className="relative flex h-[200px] flex-col rounded border border-border bg-card p-3">
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
            className="shrink-0 font-mono text-[12px] leading-none text-muted-foreground/60 transition-colors hover:text-foreground"
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
      className="flex h-[200px] flex-col rounded border border-primary/30 bg-card p-3 transition-colors focus-within:border-primary/70 hover:border-primary/50"
    >
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
          + new phrase
        </div>
        <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
          track frequency across YC descriptions
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-stretch justify-center gap-2">
        <label
          className={cn(
            "flex items-center gap-2 rounded border bg-background pl-3 pr-1.5 py-1.5 transition-colors",
            error
              ? "border-destructive/60"
              : "border-border focus-within:border-primary/70",
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
