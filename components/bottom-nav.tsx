"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useView } from "@/lib/url-state";
import { useMounted } from "@/lib/use-mounted";
import { VIEW_GROUPS, VIEWS, type ViewMeta } from "@/lib/views";
import type { ViewId } from "@/lib/store";
import { useCompanies } from "@/components/companies-provider";
import { StatsCard } from "@/components/stats-card";
import {
  aggregateByBatch,
  aggregatesAboveMinSize,
  aggregatesExcludingUnspecified,
} from "@/lib/overview-data";
import { batchToShort, batchToSortKey } from "@/lib/utils";
import { MIN_BATCH_SIZE } from "@/lib/overview-data";

const PRIMARY_VIEW_IDS: ViewId[] = ["overview", "globe", "wall", "heatmap"];

interface Props {
  totalCompanies: number;
  batchRange: string;
}

export function BottomNav({ totalCompanies, batchRange }: Props) {
  const [view, setView] = useView();
  const [moreOpen, setMoreOpen] = useState(false);

  const primary = useMemo(
    () =>
      PRIMARY_VIEW_IDS.map((id) => VIEWS.find((v) => v.id === id)).filter(
        (v): v is ViewMeta => Boolean(v),
      ),
    [],
  );

  const moreActive = !PRIMARY_VIEW_IDS.includes(view);

  return (
    <>
      <nav
        aria-label="Primary"
        className="bottom-nav-surface flex lg:hidden"
        style={{ paddingTop: 4 }}
      >
        {primary.map(({ id, label, icon: Icon }) => {
          const active = view === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group/tab flex flex-1 flex-col items-center justify-center gap-0.5 px-1 transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon
                className={cn(
                  "size-[18px] shrink-0 transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
                strokeWidth={1.7}
              />
              <span
                className={cn(
                  "font-mono text-[9.5px] tracking-[0.06em]",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-current={moreActive ? "page" : undefined}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-0.5 px-1 transition-colors",
            moreActive ? "text-primary" : "text-muted-foreground",
          )}
        >
          <MoreHorizontal
            className={cn(
              "size-[18px] shrink-0",
              moreActive ? "text-primary" : "text-muted-foreground",
            )}
            strokeWidth={1.7}
          />
          <span
            className={cn(
              "font-mono text-[9.5px] tracking-[0.06em]",
              moreActive ? "text-primary" : "text-muted-foreground",
            )}
          >
            More
          </span>
        </button>
      </nav>

      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        onPick={(id) => {
          setView(id);
          setMoreOpen(false);
        }}
        currentView={view}
        totalCompanies={totalCompanies}
        batchRange={batchRange}
      />
    </>
  );
}

function MoreSheet({
  open,
  onClose,
  onPick,
  currentView,
  totalCompanies,
  batchRange,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (id: ViewId) => void;
  currentView: ViewId;
  totalCompanies: number;
  batchRange: string;
}) {
  const mounted = useMounted();
  const all = useCompanies();

  const aggregates = useMemo(
    () =>
      aggregatesAboveMinSize(
        aggregatesExcludingUnspecified(aggregateByBatch(all)),
      ).filter((a) => a.total >= MIN_BATCH_SIZE),
    [all],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const sorted = aggregates
    .map((a) => a.batch)
    .sort((a, b) => batchToSortKey(a) - batchToSortKey(b));
  const range =
    sorted.length > 0
      ? `${batchToShort(sorted[0])} – ${batchToShort(sorted[sorted.length - 1])}`
      : batchRange;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col lg:hidden">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="flex-1 bg-black/35"
      />
      <div className="sheet-in flex max-h-[80vh] flex-col rounded-t-2xl border-t border-border bg-card pb-safe shadow-[0_-12px_30px_-18px_rgba(0,0,0,0.5)]">
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border" />
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
            Navigate
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--bg-soft)] hover:text-foreground"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>
        <div className="scroll-fine min-h-0 flex-1 overflow-y-auto pb-4">
          {VIEW_GROUPS.map(({ group, items }) => (
            <div key={group} className="px-3 pb-1.5 pt-1">
              <div className="px-2 pb-1.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-faint">
                {group}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {items.map(({ id, label, icon: Icon }) => {
                  const active = id === currentView;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onPick(id)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg border px-3 py-3 text-left transition-colors",
                        active
                          ? "border-[color:var(--primary-line)] bg-[color:var(--primary-soft)]"
                          : "border-border bg-background hover:border-[color:var(--border-strong)]",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-[16px] shrink-0",
                          active ? "text-primary" : "text-muted-foreground",
                        )}
                        strokeWidth={1.7}
                      />
                      <span
                        className={cn(
                          "text-[13.5px] font-medium",
                          active ? "text-primary" : "text-foreground",
                        )}
                      >
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="mx-3 mt-3">
            <StatsCard
              totalCompanies={totalCompanies}
              batchRange={range}
              size="comfortable"
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
