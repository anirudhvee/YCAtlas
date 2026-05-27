"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import posthog from "posthog-js";
import {
  defaultFilters,
  useUi,
  VIEW_IDS,
  type FilterState,
  type ViewId,
} from "@/lib/store";
import { useNavigateToView, useView } from "@/lib/url-state";
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

let cachedSafeAreaTopPx: number | null = null;
function getSafeAreaTopPx(): number {
  if (typeof window === "undefined") return 0;
  if (cachedSafeAreaTopPx !== null) return cachedSafeAreaTopPx;
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;top:env(safe-area-inset-top);visibility:hidden;";
  document.body.appendChild(probe);
  const t = probe.getBoundingClientRect().top;
  probe.remove();
  cachedSafeAreaTopPx = Number.isFinite(t) ? t : 0;
  return cachedSafeAreaTopPx;
}

export function AskPanel() {
  const [view] = useView();
  const navigateToView = useNavigateToView();
  const open = useUi((s) => s.askOpen);
  const setAskOpen = useUi((s) => s.setAskOpen);

  const [closing, setClosing] = useState(false);
  const [value, setValue] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [triggerOrigin, setTriggerOrigin] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [dialogRect, setDialogRect] = useState<DOMRect | null>(null);
  const [phase, setPhase] = useState<"entering" | "entered">("entering");

  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
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
      setPhase("entering");
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
      posthog.capture("ask_panel_opened");
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Dialog rect is computed from known layout constants instead of
  // measured — getBoundingClientRect would return the in-flight scaled
  // box during the open animation and throw off the transform-origin.
  // The setState calls are intentional one-time captures on open, not
  // a sync source — disable react-hooks/set-state-in-effect for them.
  useEffect(() => {
    if (!open) return;
    const visibleTrigger = [
      ...document.querySelectorAll<HTMLElement>("[data-ask-trigger]"),
    ].find((el) => el.getClientRects().length > 0);
    if (visibleTrigger) {
      const r = visibleTrigger.getBoundingClientRect();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTriggerOrigin({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    } else {
      setTriggerOrigin(null);
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const sidePad = vw >= 640 ? 16 : 12;
    const width = Math.min(680, vw - sidePad * 2);
    const left = (vw - width) / 2;
    const top = Math.max(vh * 0.06, 16 + getSafeAreaTopPx());
    setDialogRect(new DOMRect(left, top, width, 56));
    // Two RAFs so the initial "entering" transform is painted before we
    // flip to "entered" — otherwise the browser collapses both frames
    // and the CSS transition snaps instead of animating.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setPhase("entered"));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
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

      posthog.capture("ask_query_submitted", {
        query_length: query.length,
        turn_index: turns.length,
      });

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
            distinctId: posthog.get_distinct_id(),
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
              const targetView = isViewId(evt.view) ? evt.view : view;
              const targetFilters = { ...defaultFilters, ...(evt.filter ?? {}) };
              navigateToView(targetView, { filters: targetFilters });
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
    [closePanel, navigateToView, submitting, turns, view],
  );

  const newConversation = useCallback(() => {
    posthog.capture("ask_new_conversation_started", {
      prior_turn_count: turns.length,
    });
    setTurns([]);
    setValue("");
    inputRef.current?.focus();
  }, [turns.length]);

  return (
    <>
      {open && (
        <div
          className={`fixed inset-0 z-50 flex flex-col items-center px-3 pt-[6vh] sm:px-4 sm:pt-[14vh] ${
            closing ? "pointer-events-none" : ""
          }`}
          style={{ paddingTop: "max(6vh, calc(env(safe-area-inset-top) + 16px))" }}
        >
          <div
            onClick={closePanel}
            aria-hidden
            className={`absolute inset-0 bg-black/55 ${
              closing ? "" : "ask-backdrop-in"
            }`}
            style={
              closing
                ? { opacity: 0, transition: "opacity 180ms ease-out" }
                : undefined
            }
          />
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-x-0 top-0 -z-0 h-[40vh] ${
              closing ? "" : "ask-backdrop-in"
            }`}
            style={{
              background:
                "radial-gradient(ellipse 60% 80% at 50% 18vh, color-mix(in oklab, var(--primary) 18%, transparent) 0%, transparent 70%)",
              ...(closing
                ? { opacity: 0, transition: "opacity 180ms ease-out" }
                : {}),
            }}
          />

          <div
            ref={dialogRef}
            role="dialog"
            aria-modal
            aria-label="Ask Atlas"
            className="relative flex w-full max-w-[680px] flex-col gap-3"
            style={(() => {
              const originX =
                triggerOrigin && dialogRect
                  ? `${triggerOrigin.x - dialogRect.left}px`
                  : "50%";
              const originY =
                triggerOrigin && dialogRect
                  ? `${triggerOrigin.y - dialogRect.top}px`
                  : "0";
              const transformOrigin = `${originX} ${originY}`;
              const collapsed = "translateY(-13vh) scale(0.5)";
              const expanded = "translateY(0) scale(1)";
              const isCollapsed = closing || phase === "entering";
              return {
                transformOrigin,
                opacity: isCollapsed ? 0 : 1,
                transform: isCollapsed ? collapsed : expanded,
                transition:
                  "opacity 240ms cubic-bezier(0.32, 0.72, 0, 1), transform 280ms cubic-bezier(0.32, 0.72, 0, 1)",
              };
            })()}
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
                  className="max-h-[64vh] overflow-y-auto p-4 sm:max-h-[60vh] sm:p-5"
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
      className="relative flex h-14 items-center gap-3 rounded-full border border-primary/25 bg-card pr-3 pl-4 shadow-[0_0_0_1px_rgba(255,102,0,0.08),0_24px_60px_-18px_rgba(255,102,0,0.35),0_8px_30px_-10px_rgba(0,0,0,0.6)] transition-[border-color,box-shadow] focus-within:border-primary/55 focus-within:shadow-[0_0_0_1px_rgba(255,102,0,0.18),0_24px_70px_-18px_rgba(255,102,0,0.5),0_8px_30px_-10px_rgba(0,0,0,0.7)] sm:pl-5"
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/25">
        <Sparkles className="size-3.5" strokeWidth={2.25} />
      </span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={submitting}
        placeholder={submitting ? "Asking…" : "Ask anything…"}
        aria-label="Ask anything"
        className="flex-1 bg-transparent text-[16px] text-foreground outline-none placeholder:text-foreground/55 disabled:cursor-not-allowed sm:text-[15px]"
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
    <div className="ask-fade-up flex flex-wrap justify-center gap-1.5 pt-5">
      {SUGGESTIONS.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => {
            posthog.capture("ask_suggestion_clicked", { suggestion: s });
            onPick(s);
          }}
          className="rounded-full border border-border bg-card px-3 py-1.5 font-mono text-[10.5px] text-foreground/85 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.5)] transition-colors hover:border-primary/50 hover:bg-[color:var(--bg-soft)] hover:text-foreground"
        >
          {s}
        </button>
      ))}
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

