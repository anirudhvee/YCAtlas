"use client";

import { useUi } from "@/lib/store";
import { VIEWS } from "@/lib/views";

export function Canvas() {
  const view = useUi((s) => s.view);
  const meta = VIEWS.find((v) => v.id === view);
  const Icon = meta?.icon;

  return (
    <div className="grid h-full place-items-center px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          View
        </span>
        <div className="flex items-center gap-3">
          {Icon && <Icon className="size-7 text-primary" strokeWidth={1.5} />}
          <h2 className="text-3xl font-medium tracking-tight">{meta?.label}</h2>
        </div>
        <span className="font-mono text-[10px] tracking-wider text-muted-foreground/60">
          ── placeholder ──
        </span>
      </div>
    </div>
  );
}
