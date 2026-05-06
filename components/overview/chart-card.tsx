import { cn } from "@/lib/utils";

export function ChartCard({
  title,
  subtitle,
  className,
  children,
}: {
  title: string;
  subtitle: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded border border-border bg-card p-3",
        className,
      )}
    >
      <div className="mb-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground">
          {title}
        </div>
        <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
          {subtitle}
        </div>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
