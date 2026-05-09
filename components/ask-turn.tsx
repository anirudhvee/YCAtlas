"use client";

import { AskEvent, type TurnEvent } from "./ask-event";

export interface Turn {
  id: string;
  userQuery: string;
  events: TurnEvent[];
  status: "streaming" | "done";
}

export function AskTurn({
  turn,
  isLastTurn,
}: {
  turn: Turn;
  isLastTurn: boolean;
}) {
  // Last tool index defines the boundary between "preamble thinking" and
  // "the answer". Anything before the last tool is reasoning Grok did en
  // route; anything after is the prose answer.
  const lastToolIdx = (() => {
    for (let i = turn.events.length - 1; i >= 0; i--) {
      if (turn.events[i].kind === "tool") return i;
    }
    return -1;
  })();

  const isPreToolIntermediate = (idx: number, kind: TurnEvent["kind"]) =>
    (kind === "thinking" || kind === "reasoning") &&
    lastToolIdx >= 0 &&
    idx <= lastToolIdx;

  const hasReasoning = turn.events.some((e) => e.kind === "reasoning");
  const showThinkingHint =
    !hasReasoning &&
    turn.status === "streaming" &&
    (turn.events.length === 0 ||
      turn.events[turn.events.length - 1].kind === "tool");

  return (
    <div className="flex flex-col gap-3.5">
      <UserBubble query={turn.userQuery} />
      <div className="flex max-w-[85%] flex-col gap-2.5">
        {turn.events.map((event, idx) => {
          if (turn.status === "done" && isPreToolIntermediate(idx, event.kind)) {
            return null;
          }
          const variant: "thinking" | "answer" =
            event.kind === "thinking" && isPreToolIntermediate(idx, event.kind)
              ? "thinking"
              : "answer";
          const isLatest = idx === turn.events.length - 1;
          const isStreaming =
            isLastTurn &&
            isLatest &&
            (event.kind === "thinking" || event.kind === "reasoning") &&
            turn.status === "streaming";
          return (
            <AskEvent
              key={`${turn.id}-${idx}`}
              event={event}
              isStreaming={isStreaming}
              thinkingVariant={variant}
            />
          );
        })}
        {showThinkingHint && <ThinkingHint />}
      </div>
    </div>
  );
}

function UserBubble({ query }: { query: string }) {
  return (
    <div className="ask-fade-up flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-br-md border border-border/60 bg-muted/60 px-3.5 py-2 text-[14px] leading-[1.45] text-foreground">
        {query}
      </div>
    </div>
  );
}

function ThinkingHint() {
  return (
    <div className="ask-fade-up flex items-center gap-2">
      <span className="relative flex size-1.5">
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/60" />
        <span className="relative size-1.5 rounded-full bg-primary" />
      </span>
      <span className="ask-thinking font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        thinking
      </span>
    </div>
  );
}
