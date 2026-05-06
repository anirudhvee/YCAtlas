"use client";

import { Overview } from "@/components/overview";
import { Wall } from "@/components/wall";
import { Heatmap } from "@/components/heatmap";
import { Buzzwords } from "@/components/buzzwords";
import { FilterChipBar } from "@/components/filter-chip-bar";
import { useUi } from "@/lib/store";
import { useMounted } from "@/lib/use-mounted";
import { VIEWS } from "@/lib/views";

export function Canvas() {
  const view = useUi((s) => s.view);
  const mounted = useMounted();
  const effectiveView = mounted ? view : "overview";

  return (
    <div className="flex h-full flex-col">
      <FilterChipBar />
      <div className="min-h-0 flex-1">
        {effectiveView === "overview" ? (
          <Overview />
        ) : effectiveView === "wall" ? (
          <Wall />
        ) : effectiveView === "heatmap" ? (
          <Heatmap />
        ) : effectiveView === "buzzwords" ? (
          <Buzzwords />
        ) : (
          <ViewPlaceholder view={effectiveView} />
        )}
      </div>
    </div>
  );
}

function ViewPlaceholder({ view }: { view: string }) {
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
