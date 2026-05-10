import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  subtitle: string;
  className?: string;
  /** Right-side content in the head row (legend, stat pills, controls) */
  headRight?: React.ReactNode;
  /** Stat-pill row, rendered between the head and the chart body */
  stats?: React.ReactNode;
  /** Apply a faint orange wash when a batch is selected */
  selected?: boolean;
  children: React.ReactNode;
}

export function ChartCard({
  title,
  subtitle,
  className,
  headRight,
  stats,
  selected = false,
  children,
}: ChartCardProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-[10px] border border-border bg-card p-3.5 transition-colors hover:border-[color:var(--border-strong)]",
        selected &&
          "before:pointer-events-none before:absolute before:inset-0 before:rounded-[10px] before:bg-gradient-to-b before:from-[color:var(--selection-wash)] before:to-transparent",
        className,
      )}
    >
      <div className="relative z-10 flex flex-col items-stretch gap-2 md:flex-row md:items-start md:justify-between md:gap-3">
        <div className="flex min-w-0 flex-col gap-[3px]">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground">
            {title}
          </div>
          <div className="text-[12px] text-muted-foreground">{subtitle}</div>
        </div>
        {headRight && (
          <div className="scroll-x-hidden -mx-1 flex min-w-0 items-center gap-3 overflow-x-auto px-1 md:mx-0 md:shrink-0 md:overflow-visible md:px-0">
            {headRight}
          </div>
        )}
      </div>
      {stats && (
        <div className="relative z-10 mt-2 flex flex-wrap items-center gap-2.5">
          {stats}
        </div>
      )}
      <div className="relative z-10 mt-2.5 min-h-0 flex-1">{children}</div>
    </div>
  );
}

export function StatPill({
  label,
  value,
  hint,
  delta,
}: {
  label: string;
  value: string | number;
  hint?: string;
  delta?: string;
}) {
  return (
    <div className="stat-pill">
      <span>{label}</span>
      <span className="v tabular-nums">{value}</span>
      {hint && <span>{hint}</span>}
      {delta && <span className="delta">{delta}</span>}
    </div>
  );
}

export function Legend({
  items,
  maxWidth,
}: {
  items: { label: string; color: string }[];
  maxWidth?: number;
}) {
  return (
    <div
      className="inline-flex flex-wrap items-center justify-end gap-x-3 gap-y-1 font-mono text-[10px] text-muted-foreground"
      style={maxWidth ? { maxWidth } : undefined}
    >
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block size-2 rounded-sm"
            style={{ backgroundColor: it.color }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}
