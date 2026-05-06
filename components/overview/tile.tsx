"use client";

import { cn } from "@/lib/utils";

interface TileProps {
  header: React.ReactNode;
  footer: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}

export function Tile({
  header,
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
        "group flex h-[160px] cursor-pointer flex-col gap-2 rounded border border-border bg-card p-3 text-left transition-colors hover:border-foreground/30 focus-visible:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
        className,
      )}
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground">
        {header}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      <div className="font-mono text-[9.5px] tracking-wider text-muted-foreground/70 transition-colors group-hover:text-primary">
        {footer}
      </div>
    </div>
  );
}
