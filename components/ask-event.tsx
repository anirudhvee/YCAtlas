"use client";

import { useState } from "react";
import { ChevronDown, Sparkles, Loader2, ArrowRight } from "lucide-react";
import { type FilterState, type ViewId } from "@/lib/store";
import { batchToShort } from "@/lib/utils";

export type TurnEvent =
  | { kind: "thinking"; text: string }
  | { kind: "reasoning"; text: string }
  | {
      kind: "tool";
      id: string;
      expression: string;
      value?: unknown;
      error?: string;
      pending: boolean;
    }
  | { kind: "final"; answer: string; truncated?: boolean }
  | {
      kind: "filter";
      narration: string | null;
      view: ViewId | null;
      filter?: FilterState | null;
    }
  | { kind: "error"; message: string };

interface Props {
  event: TurnEvent;
  isStreaming: boolean;
  /** "thinking" = italic muted preamble; "answer" = foreground prose. */
  thinkingVariant: "thinking" | "answer";
}

export function AskEvent({ event, isStreaming, thinkingVariant }: Props) {
  if (event.kind === "reasoning")
    return <Reasoning text={event.text} streaming={isStreaming} />;
  if (event.kind === "thinking")
    return (
      <Thinking
        text={event.text}
        streaming={isStreaming}
        variant={thinkingVariant}
      />
    );
  if (event.kind === "tool")
    return <ToolPill event={event} />;
  if (event.kind === "final") return <Final answer={event.answer} />;
  if (event.kind === "filter")
    return (
      <FilterCard
        narration={event.narration}
        view={event.view}
        filter={event.filter ?? null}
      />
    );
  if (event.kind === "error") return <ErrorMsg message={event.message} />;
  return null;
}

function Reasoning({
  text,
  streaming,
}: {
  text: string;
  streaming: boolean;
}) {
  const [userToggled, setUserToggled] = useState<boolean | null>(null);
  if (!text.trim()) return null;
  const open = userToggled ?? streaming;
  return (
    <div className="ask-fade-up flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setUserToggled(!open)}
        className="inline-flex w-fit items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 transition-colors hover:text-foreground"
      >
        {streaming ? (
          <span className="relative flex size-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary/60" />
            <span className="relative size-1.5 rounded-full bg-primary" />
          </span>
        ) : (
          <ChevronDown
            className={`size-3 transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          />
        )}
        <span className={streaming ? "ask-thinking" : ""}>
          {streaming ? "thinking" : "thought process"}
        </span>
      </button>
      {open && (
        <p className="whitespace-pre-wrap break-words border-l border-primary/30 pl-3 text-[12.5px] italic leading-relaxed text-muted-foreground/85">
          {text}
          {streaming && <span className="ask-cursor">▌</span>}
        </p>
      )}
    </div>
  );
}

function Thinking({
  text,
  streaming,
  variant,
}: {
  text: string;
  streaming: boolean;
  variant: "thinking" | "answer";
}) {
  if (variant === "thinking") {
    return (
      <p className="ask-fade-up whitespace-pre-wrap text-[12.5px] italic leading-relaxed text-muted-foreground/85">
        {text}
        {streaming && <span className="ask-cursor">▌</span>}
      </p>
    );
  }
  return (
    <p className="ask-fade-up whitespace-pre-wrap text-[15px] leading-[1.55] text-foreground">
      {text}
      {streaming && <span className="ask-cursor">▌</span>}
    </p>
  );
}

function ToolPill({
  event,
}: {
  event: Extract<TurnEvent, { kind: "tool" }>;
}) {
  const [open, setOpen] = useState(false);

  const label = event.error
    ? "errored"
    : event.pending
      ? "running"
      : "ran query";

  return (
    <div className="ask-fade-up flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group inline-flex w-fit items-center gap-2 rounded-full bg-muted/50 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:bg-muted"
      >
        {event.pending ? (
          <Loader2 className="ask-spinner size-3 text-primary" strokeWidth={2.5} />
        ) : event.error ? (
          <span className="size-1.5 rounded-full bg-destructive" />
        ) : (
          <span className="size-1.5 rounded-full bg-primary" />
        )}
        <span>{label}</span>
        <ChevronDown
          className={`size-3 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="ml-1 flex flex-col gap-1.5 border-l border-border/60 pl-3">
          <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-foreground/90">
            <code>{event.expression || "—"}</code>
          </pre>
          {!event.pending && (
            <ResultDetail value={event.value} error={event.error} />
          )}
        </div>
      )}
    </div>
  );
}

function ResultDetail({ value, error }: { value: unknown; error?: string }) {
  const [expanded, setExpanded] = useState(false);
  if (error) {
    return (
      <p className="font-mono text-[11px] text-destructive">{error}</p>
    );
  }
  const text =
    typeof value === "string" ? value : safeStringify(value);
  const isLong = text.length > 320;
  const display = expanded || !isLong ? text : text.slice(0, 320);
  return (
    <div className="flex flex-col items-start gap-1">
      <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-muted-foreground">
        {display}
        {isLong && !expanded ? "…" : ""}
      </pre>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70 hover:text-foreground"
        >
          {expanded ? "show less" : "show more"}
        </button>
      )}
    </div>
  );
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function Final({ answer }: { answer: string }) {
  return (
    <p className="ask-fade-up whitespace-pre-wrap text-[15px] leading-[1.55] text-foreground">
      {answer}
    </p>
  );
}

function FilterCard({
  narration,
  view,
  filter,
}: {
  narration: string | null;
  view: ViewId | null;
  filter: FilterState | null;
}) {
  const chips = filter ? deriveChips(filter) : [];
  return (
    <div className="ask-fade-up flex flex-col gap-2 rounded-2xl border border-primary/30 bg-primary/[0.06] px-4 py-3">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
        <Sparkles className="size-3" />
        <span>Going to</span>
        <span className="text-foreground">{view ?? "dashboard"}</span>
        <ArrowRight className="size-3 text-primary/70" />
      </div>
      <p className="text-[13px] leading-relaxed text-foreground">
        {narration ?? "Applying filter"}
      </p>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c, i) => (
            <span
              key={i}
              className="rounded-full border border-border/70 bg-card/70 px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
            >
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function deriveChips(filter: FilterState): string[] {
  const chips: string[] = [];
  for (const s of filter.status) chips.push(s);
  for (const b of filter.batches) chips.push(batchToShort(b));
  for (const i of filter.industries) chips.push(i);
  for (const t of filter.tags) chips.push(t);
  for (const r of filter.regions) chips.push(r);
  for (const s of filter.stage) chips.push(s);
  if (filter.top_company === true) chips.push("top YC");
  if (filter.hasFormerNames === true) chips.push("pivoted");
  if (filter.teamSizeMin !== null) chips.push(`team ≥ ${filter.teamSizeMin}`);
  if (filter.teamSizeMax !== null) chips.push(`team ≤ ${filter.teamSizeMax}`);
  if (filter.search) chips.push(`"${filter.search}"`);
  return chips;
}

function ErrorMsg({ message }: { message: string }) {
  return (
    <p className="ask-fade-up font-mono text-[11px] text-destructive">
      {message}
    </p>
  );
}
