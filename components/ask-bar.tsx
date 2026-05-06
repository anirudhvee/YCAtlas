"use client";

export function AskBar() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 z-30 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-[520px] items-center gap-2.5 rounded-full border border-border bg-card/90 px-4 py-2 backdrop-blur transition-[box-shadow,border-color] focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/15">
        <span className="font-mono text-[14px] font-semibold text-primary leading-none">/</span>
        <input
          type="text"
          placeholder="Ask anything…"
          aria-label="Ask anything"
          className="flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/70"
        />
        <kbd className="font-mono text-[10px] text-muted-foreground/60 select-none">⏎</kbd>
      </div>
    </div>
  );
}
