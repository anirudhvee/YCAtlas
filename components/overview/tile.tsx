"use client";

import { cn } from "@/lib/utils";

interface TileProps {
  title: string;
  meta?: React.ReactNode;
  footer: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}

export function Tile({
  title,
  meta,
  footer,
  onClick,
  children,
  className,
}: TileProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "group flex h-[168px] cursor-pointer flex-col gap-2.5 rounded-[10px] border border-border bg-card p-3.5 text-left transition-colors hover:border-[color:var(--border-strong)] focus-visible:border-[color:var(--primary-line)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[13px] font-medium tracking-[-0.005em] text-foreground">
          {title}
        </div>
        {meta && (
          <div className="font-mono text-[10px] tabular-nums text-muted-foreground">
            {meta}
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      <div className="inline-flex items-center gap-1 self-start font-mono text-[10px] tracking-[0.04em] text-muted-foreground transition-colors group-hover:text-primary">
        {footer}
      </div>
    </div>
  );
}
