"use client";

import { cn } from "@/lib/utils";
import { useUi } from "@/lib/store";
import { useMounted } from "@/lib/use-mounted";
import { VIEWS } from "@/lib/views";

interface SidebarProps {
  totalCompanies: number;
  batchRange: string;
}

export function Sidebar({ totalCompanies, batchRange }: SidebarProps) {
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);
  const mounted = useMounted();

  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-border bg-card">
      <nav className="flex-1 px-2 py-3">
        {VIEWS.map(({ id, label, icon: Icon }) => {
          const active = mounted && id === view;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={cn(
                "group relative flex w-full items-center gap-2.5 rounded px-2.5 py-1.5 text-left text-[13px] transition-colors",
                active
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "size-3.5 shrink-0 transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground group-hover:text-foreground"
                )}
                strokeWidth={1.75}
              />
              <span className="flex-1 font-medium">{label}</span>
              {active && (
                <span className="absolute right-0 top-1/2 h-4 w-px -translate-y-1/2 bg-primary" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="m-3 rounded border border-border bg-background p-3 font-mono text-[10.5px] leading-none">
        <Row label="Companies" value={totalCompanies.toLocaleString()} />
        <div className="h-2" />
        <Row label="Batches" value={batchRange} />
        <div className="my-3 h-px bg-border" />
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span className="relative grid size-2 place-items-center">
            <span className="absolute inline-flex size-2 animate-ping rounded-full bg-[var(--status)] opacity-50" />
            <span className="relative inline-flex size-1.5 rounded-full bg-[var(--status)]" />
          </span>
          <span>live · yc-oss/api</span>
        </div>
      </div>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums text-foreground">{value}</span>
    </div>
  );
}
