"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useView } from "@/lib/url-state";
import { VIEW_GROUPS, VIEWS } from "@/lib/views";
import { StatsCard } from "@/components/stats-card";

interface SidebarProps {
  totalCompanies: number;
  batchRange: string;
}

export function Sidebar({ totalCompanies, batchRange }: SidebarProps) {
  const [view, setView] = useView();

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
    <aside className="hidden w-[224px] shrink-0 flex-col border-r border-border bg-card lg:flex">
      <nav className="scroll-fine min-h-0 flex-1 overflow-y-auto">
        {VIEW_GROUPS.map(({ group, items }) => (
          <div key={group} className="px-2.5 pb-1.5 pt-3.5">
            <div className="px-2 pb-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-faint">
              {group}
            </div>
            {items.map(({ id, label, icon: Icon, kbd }) => {
              const active = id === view;
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

      <div className="m-2.5">
        <StatsCard
          totalCompanies={totalCompanies}
          batchRange={batchRange}
          size="compact"
        />
      </div>
    </aside>
  );
}
