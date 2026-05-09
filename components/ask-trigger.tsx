"use client";

import { Sparkles } from "lucide-react";
import { useUi } from "@/lib/store";

export function AskTrigger() {
  const setAskOpen = useUi((s) => s.setAskOpen);
  const askOpen = useUi((s) => s.askOpen);
  return (
    <button
      type="button"
      onClick={() => setAskOpen(true)}
      aria-label="Open Ask Atlas"
      aria-hidden={askOpen}
      tabIndex={askOpen ? -1 : 0}
      className={`group relative hidden h-9 w-[320px] items-center gap-2.5 overflow-hidden rounded-full border border-border/80 bg-card/60 pr-1.5 pl-3.5 text-left transition-[opacity,border-color,background-color,box-shadow] duration-150 hover:border-primary/40 hover:bg-card/90 hover:shadow-[0_4px_24px_-12px_rgba(255,102,0,0.45)] focus:outline-none focus-visible:border-primary/60 focus-visible:shadow-[0_4px_24px_-12px_rgba(255,102,0,0.55)] md:flex ${askOpen ? "pointer-events-none opacity-0" : "opacity-100"}`}
    >
      <span className="grid size-5 place-items-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
        <Sparkles className="size-3" strokeWidth={2.25} />
      </span>
      <span className="flex-1 truncate text-[12.5px] text-muted-foreground/90 transition-colors group-hover:text-foreground/85">
        Ask anything about YC companies…
      </span>
      <kbd className="rounded-md border border-border/80 bg-background/60 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-muted-foreground/80">
        ⌘K
      </kbd>
    </button>
  );
}
