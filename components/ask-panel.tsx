"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import {
  defaultFilters,
  useUi,
  VIEW_IDS,
  type FilterState,
  type ViewId,
} from "@/lib/store";
import { AskTurn, type Turn } from "./ask-turn";
import type { TurnEvent } from "./ask-event";

const SUGGESTIONS = [
  "Show me YC public companies",
  "Biggest YC acquisitions",
  "When did 'AI agent' first show up?",
  "Companies that pivoted",
  "Top cities for AI startups",
  "What % of W22 is still active?",
] as const;

const MAX_HISTORY_TURNS = 10;
const CLOSE_DURATION_MS = 220;

interface ServerEvent {
  type: string;
  text?: string;
  id?: string;
  tool?: string;
  args?: { expression?: string; error?: string };
  value?: unknown;
  error?: string;
  answer?: string;
  truncated?: boolean;
  filter?: FilterState;
  view?: ViewId | null;
  narration?: string | null;
  message?: string;
}

function summarizeForHistory(t: Turn): string | undefined {
  let toolExpr: string | undefined;
  for (const e of t.events) {
    if (e.kind === "tool" && e.expression) {
      toolExpr = e.expression;
      break;
    }
  }

  let lastToolIdx = -1;
  for (let i = t.events.length - 1; i >= 0; i--) {
    if (t.events[i].kind === "tool") {
      lastToolIdx = i;
      break;
    }
  }
  let answer: string | undefined;
  for (let i = t.events.length - 1; i >= 0; i--) {
    const e = t.events[i];
    if (e.kind === "final") {
      answer = e.answer;
      break;
    }
    if (e.kind === "filter") {
      answer = e.narration ?? "Filter applied.";
      break;
    }
  }
  if (!answer) {
    let trailing = "";
    for (let i = lastToolIdx + 1; i < t.events.length; i++) {
      const e = t.events[i];
      if (e.kind === "thinking") trailing += e.text;
    }
    if (trailing.trim()) answer = trailing.trim();
  }

  if (!answer && !toolExpr) return undefined;

  let prefix = "";
  if (toolExpr) {
    const truncated =
      toolExpr.length > 120 ? toolExpr.slice(0, 119) + "…" : toolExpr;
    prefix = `[ran query: ${truncated}]\n`;
  }
  return prefix + (answer ?? "");
}

function isViewId(v: unknown): v is ViewId {
  return typeof v === "string" && (VIEW_IDS as readonly string[]).includes(v);
}

export function AskPanel() {
  const setFilters = useUi((s) => s.setFilters);
  const clearFilters = useUi((s) => s.clearFilters);
  const setView = useUi((s) => s.setView);
  const open = useUi((s) => s.askOpen);
  const setAskOpen = useUi((s) => s.setAskOpen);

  const [closing, setClosing] = useState(false);
  const [value, setValue] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (sessionIdRef.current !== null) return;
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      sessionIdRef.current = crypto.randomUUID();
    } else {
      sessionIdRef.current =
        Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
  }, []);

  const closePanel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setClosing(true);
    setTimeout(() => {
      setAskOpen(false);
      setClosing(false);
    }, CLOSE_DURATION_MS);
  }, [setAskOpen]);

  // Global keyboard: ⌘K / Ctrl+K toggles, "/" opens, Esc closes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const inField =
        tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) closePanel();
        else setAskOpen(true);
        return;
      }
      if (e.key === "/" && !inField) {
        e.preventDefault();
        setAskOpen(true);
        return;
      }
      if (e.key === "Escape" && open && !closing) {
        closePanel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closing, closePanel, setAskOpen]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Auto-scroll to bottom as content streams in.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [turns]);

  const submit = useCallback(
    async (raw: string) => {
      const query = raw.trim();
      if (!query || submitting) return;

      const turnId = crypto.randomUUID();
      setSubmitting(true);
      setValue("");
      setTurns((prev) => [
        ...prev,
        { id: turnId, userQuery: query, events: [], status: "streaming" },
      ]);

      const HISTORY_ASSISTANT_CAP = 600;
      const history = (() => {
        const out: { user: string; assistant?: string }[] = [];
        for (const t of turns) {
          const summary = summarizeForHistory(t);
          const capped =
            summary && summary.length > HISTORY_ASSISTANT_CAP
              ? summary.slice(0, HISTORY_ASSISTANT_CAP - 1).trimEnd() + "…"
              : summary;
          out.push({ user: t.userQuery, assistant: capped });
        }
        return out.slice(-MAX_HISTORY_TURNS);
      })();

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            history,
            sessionId: sessionIdRef.current,
          }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const data = (await res.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(data?.error ?? `Request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        outer: while (true) {
          const { value: chunk, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(chunk, { stream: true });
          let idx: number;
          while ((idx = buf.indexOf("\n\n")) !== -1) {
            const block = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const line = block.startsWith("data: ")
              ? block.slice(6)
              : block.replace(/^data:\s?/, "");
            if (!line) continue;
            let evt: ServerEvent;
            try {
              evt = JSON.parse(line) as ServerEvent;
            } catch {
              continue;
            }
            if (evt.type === "done") break outer;
            applyEvent(turnId, evt, setTurns);
            if (evt.type === "filter") {
              clearFilters();
              if (evt.filter)
                setFilters({ ...defaultFilters, ...evt.filter });
              if (isViewId(evt.view)) setView(evt.view);
              setTimeout(() => closePanel(), 1700);
            }
          }
        }
      } catch (err) {
        const aborted =
          err instanceof DOMException && err.name === "AbortError";
        if (!aborted) {
          const msg = err instanceof Error ? err.message : "Something went wrong.";
          setTurns((prev) =>
            prev.map((t) =>
              t.id === turnId
                ? {
                    ...t,
                    events: [...t.events, { kind: "error", message: msg }],
                    status: "done",
                  }
                : t,
            ),
          );
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setSubmitting(false);
        setTurns((prev) =>
          prev.map((t) =>
            t.id === turnId && t.status === "streaming"
              ? { ...t, status: "done" }
              : t,
          ),
        );
      }
    },
    [clearFilters, closePanel, setFilters, setView, submitting, turns],
  );

  const newConversation = useCallback(() => {
    setTurns([]);
    setValue("");
    inputRef.current?.focus();
  }, []);

  return (
    <>
      {open && (
        <div
          className={`fixed inset-0 z-50 flex flex-col items-center px-4 pt-[14vh] ${
            closing ? "pointer-events-none" : ""
          }`}
        >
          <div
            onClick={closePanel}
            aria-hidden
            className={`absolute inset-0 bg-black/15 ${
              closing ? "" : "ask-backdrop-in"
            }`}
            style={
              closing
                ? { opacity: 0, transition: "opacity 180ms ease-out" }
                : undefined
            }
          />

          <div
            role="dialog"
            aria-modal
            aria-label="Ask Atlas"
            className="relative flex w-full max-w-[680px] flex-col gap-3 origin-top"
            style={
              closing
                ? {
                    opacity: 0,
                    transform: "translateY(-13vh) scale(0.5)",
                    transition:
                      "opacity 220ms cubic-bezier(0.4, 0, 1, 1), transform 220ms cubic-bezier(0.4, 0, 1, 1)",
                  }
                : undefined
            }
          >
            <InputBar
              inputRef={inputRef}
              value={value}
              setValue={setValue}
              submitting={submitting}
              onSubmit={() => void submit(value)}
              onClose={closePanel}
              onNewConversation={turns.length > 0 ? newConversation : undefined}
            />

            {turns.length === 0 && !submitting ? (
              <div className="flex justify-center pt-1">
                <Suggestions onPick={(s) => void submit(s)} />
              </div>
            ) : (
              <div
                className="ask-fade-up overflow-hidden rounded-3xl border border-foreground/10 bg-card/55 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.55)] ring-1 ring-inset ring-foreground/5 backdrop-blur-2xl backdrop-saturate-150"
              >
                <div
                  ref={scrollRef}
                  className="max-h-[60vh] overflow-y-auto p-5"
                >
                  <div className="flex flex-col gap-7">
                    {turns.map((t, i) => (
                      <AskTurn
                        key={t.id}
                        turn={t}
                        isLastTurn={i === turns.length - 1}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function InputBar({
  inputRef,
  value,
  setValue,
  submitting,
  onSubmit,
  onClose,
  onNewConversation,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  value: string;
  setValue: (s: string) => void;
  submitting: boolean;
  onSubmit: () => void;
  onClose: () => void;
  onNewConversation?: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="ask-input-in relative flex h-14 items-center gap-3 rounded-full border border-foreground/10 bg-card/55 pr-3 pl-5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.5)] ring-1 ring-inset ring-foreground/5 backdrop-blur-2xl backdrop-saturate-150 transition-[border-color,box-shadow] focus-within:border-primary/40 focus-within:shadow-primary/15"
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="size-3.5" strokeWidth={2.25} />
      </span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={submitting}
        placeholder={submitting ? "Asking…" : "Ask anything about YC companies…"}
        aria-label="Ask anything"
        className="flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground/70 disabled:cursor-not-allowed"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            onSubmit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            (e.currentTarget as HTMLInputElement).blur();
            onClose();
          }
        }}
      />
      {onNewConversation && (
        <button
          type="button"
          onClick={onNewConversation}
          aria-label="New conversation"
          className="grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Plus className="size-3.5" />
        </button>
      )}
      <kbd className="font-mono text-[10px] text-muted-foreground/60 select-none">
        esc
      </kbd>
    </form>
  );
}

function Suggestions({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="ask-fade-up flex flex-col items-center gap-3 pt-6">
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
        try
      </span>
      <div className="flex flex-wrap justify-center gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="rounded-full border border-border/70 bg-card/70 px-3 py-1 font-mono text-[10px] text-muted-foreground backdrop-blur transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function applyEvent(
  turnId: string,
  evt: ServerEvent,
  setTurns: React.Dispatch<React.SetStateAction<Turn[]>>,
) {
  setTurns((prev) =>
    prev.map((t) => {
      if (t.id !== turnId) return t;
      const events = [...t.events];
      let status: Turn["status"] = t.status;

      if (evt.type === "thinking" && typeof evt.text === "string") {
        const last = events[events.length - 1];
        if (last && last.kind === "thinking") {
          events[events.length - 1] = {
            kind: "thinking",
            text: last.text + evt.text,
          };
        } else {
          events.push({ kind: "thinking", text: evt.text });
        }
      } else if (evt.type === "reasoning" && typeof evt.text === "string") {
        const last = events[events.length - 1];
        if (last && last.kind === "reasoning") {
          events[events.length - 1] = {
            kind: "reasoning",
            text: last.text + evt.text,
          };
        } else {
          events.push({ kind: "reasoning", text: evt.text });
        }
      } else if (evt.type === "tool_call" && typeof evt.id === "string") {
        if (!evt.args?.error) {
          events.push({
            kind: "tool",
            id: evt.id,
            expression: evt.args?.expression ?? "",
            pending: true,
          });
        }
      } else if (evt.type === "tool_result" && typeof evt.id === "string") {
        const targetId = evt.id;
        const idx = events.findIndex(
          (e): e is Extract<TurnEvent, { kind: "tool" }> =>
            e.kind === "tool" && e.id === targetId,
        );
        if (idx >= 0) {
          if (evt.error) {
            events.splice(idx, 1);
          } else {
            const tool = events[idx] as Extract<TurnEvent, { kind: "tool" }>;
            events[idx] = {
              ...tool,
              value: evt.value,
              pending: false,
            };
          }
        }
      } else if (evt.type === "final" && typeof evt.answer === "string") {
        events.push({
          kind: "final",
          answer: evt.answer,
          truncated: evt.truncated,
        });
        status = "done";
      } else if (evt.type === "filter") {
        events.push({
          kind: "filter",
          narration: evt.narration ?? null,
          view: isViewId(evt.view) ? evt.view : null,
          filter: evt.filter ?? null,
        });
        status = "done";
      } else if (evt.type === "error" && typeof evt.message === "string") {
        events.push({ kind: "error", message: evt.message });
        status = "done";
      }

      return { ...t, events, status };
    }),
  );
}

