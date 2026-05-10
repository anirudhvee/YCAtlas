"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useUi } from "@/lib/store";
import { useMounted } from "@/lib/use-mounted";
import { VIEW_GROUPS, VIEWS } from "@/lib/views";
import { useCompanies } from "@/components/companies-provider";
import {
  aggregateByBatch,
  aggregatesAboveMinSize,
  aggregatesExcludingUnspecified,
} from "@/lib/overview-data";

interface SidebarProps {
  totalCompanies: number;
  batchRange: string;
}

export function Sidebar({ totalCompanies, batchRange }: SidebarProps) {
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);
  const mounted = useMounted();
  const all = useCompanies();

  const aggregates = useMemo(
    () =>
      aggregatesAboveMinSize(
        aggregatesExcludingUnspecified(aggregateByBatch(all)),
      ),
    [all],
  );

  // Keyboard shortcuts 1..8 for views (kbd value lives in lib/views.ts)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const v = VIEWS.find((x) => x.kbd === e.key);
      if (v) setView(v.id);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setView]);

  return (
    <aside className="flex w-[224px] shrink-0 flex-col border-r border-border bg-card">
      <nav className="scroll-fine min-h-0 flex-1 overflow-y-auto">
        {VIEW_GROUPS.map(({ group, items }) => (
          <div key={group} className="px-2.5 pb-1.5 pt-3.5">
            <div className="px-2 pb-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-faint">
              {group}
            </div>
            {items.map(({ id, label, icon: Icon, kbd }) => {
              const active = mounted && id === view;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setView(id)}
                  className={cn(
                    "group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[12.5px] transition-colors",
                    active
                      ? "bg-[color:var(--bg-soft)] font-medium text-foreground"
                      : "text-muted-foreground hover:bg-[color:var(--bg-soft)] hover:text-foreground",
                  )}
                >
                  {active && (
                    <span
                      aria-hidden
                      className="absolute -left-2.5 top-1.5 bottom-1.5 w-[2px] rounded-r bg-primary"
                    />
                  )}
                  <Icon
                    className={cn(
                      "size-[14px] shrink-0 transition-colors",
                      active
                        ? "text-primary"
                        : "text-muted-foreground/85 group-hover:text-foreground",
                    )}
                    strokeWidth={1.6}
                  />
                  <span className="flex-1">{label}</span>
                  <span
                    className={cn(
                      "rounded border border-border bg-background px-1.5 py-px font-mono text-[9.5px] text-faint transition-opacity",
                      active
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100",
                    )}
                  >
                    {kbd}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="m-2.5 rounded-lg border border-border bg-background p-3 font-mono text-[10.5px] leading-none">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Companies</span>
          <span className="text-[16px] font-medium tracking-tight tabular-nums text-foreground">
            {totalCompanies.toLocaleString()}
          </span>
        </div>
        <div className="-mx-0.5 mt-2.5 h-[22px]">
          {aggregates.length > 1 && <Sparkline aggregates={aggregates} />}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Batches</span>
          <span className="tabular-nums text-foreground">{batchRange}</span>
        </div>
        <div className="my-3 h-px bg-border" />
        <div className="text-[10px] text-faint">
          source · yc-oss/api
        </div>
      </div>
    </aside>
  );
}

function Sparkline({
  aggregates,
}: {
  aggregates: { short: string; total: number }[];
}) {
  const [w, setW] = useState(0);
  const refCb = (el: HTMLDivElement | null) => {
    if (!el) return;
    if (w === 0) setW(el.clientWidth);
    const ro = new ResizeObserver((es) => {
      for (const e of es) setW(e.contentRect.width);
    });
    ro.observe(el);
  };

  const h = 22;
  const max = Math.max(1, ...aggregates.map((a) => a.total));
  const xAt = (i: number) =>
    aggregates.length === 1 ? w / 2 : (i / (aggregates.length - 1)) * w;
  const yAt = (v: number) => h - 2 - (v / max) * (h - 4);
  const linePath = aggregates
    .map((a, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(a.total)}`)
    .join("");

  return (
    <div ref={refCb} style={{ width: "100%", height: h }}>
      {w > 0 && (
        <svg width={w} height={h} className="block">
          <path
            d={linePath}
            fill="none"
            stroke="var(--muted-foreground)"
            strokeWidth="1.25"
            strokeOpacity="0.65"
          />
        </svg>
      )}
    </div>
  );
}
