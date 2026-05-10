"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Gem } from "lucide-react";
import { useUi } from "@/lib/store";
import { useMounted } from "@/lib/use-mounted";
import { batchToShort, cleanFormerNames, cn } from "@/lib/utils";
import type { Company, CompanyStatus } from "@/lib/types";

const STATUS_COLORS: Record<CompanyStatus, string> = {
  Active: "var(--status-active)",
  Inactive: "var(--status-inactive)",
  Acquired: "var(--status-acquired)",
  Public: "var(--status-public)",
};

function formatLaunched(ts: number): string {
  if (!ts || !Number.isFinite(ts)) return "—";
  const d = new Date(ts * 1000);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function firstFormerName(c: Company): string | null {
  return cleanFormerNames(c.name, c.former_names)[0] ?? null;
}

function parseLocation(allLocations: string): string | null {
  if (!allLocations) return null;
  return allLocations.split(",")[0]?.trim() || null;
}

export function DetailDrawer() {
  const company = useUi((s) => s.selectedCompany);
  const setSelectedCompany = useUi((s) => s.setSelectedCompany);
  const toggleArrayFilter = useUi((s) => s.toggleArrayFilter);

  const mounted = useMounted();
  const [shown, setShown] = useState<Company | null>(null);
  const [trackedId, setTrackedId] = useState<number | null>(null);
  const [sessionTags, setSessionTags] = useState<string[]>([]);

  // React-recommended derived-state pattern: update during render in response
  // to a prop change, instead of inside an effect. Lets us keep displaying
  // the last opened company during the slide-out animation.
  if (company) {
    if (company.id !== trackedId) {
      setTrackedId(company.id);
      setShown(company);
      setSessionTags([]);
    }
  } else if (trackedId !== null) {
    // Drawer just closed — clear trackedId so reopening the same company
    // counts as a fresh open and resets sessionTags.
    setTrackedId(null);
  }

  useEffect(() => {
    if (!company) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedCompany(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [company, setSelectedCompany]);

  useEffect(() => {
    if (!company) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [company]);

  if (!mounted) return null;

  const open = company !== null;
  const c = shown;

  const handleTagClick = (tag: string) => {
    setSessionTags((s) => (s.includes(tag) ? s : [...s, tag]));
    toggleArrayFilter("tags", tag);
    setSelectedCompany(null);
  };

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close drawer"
        tabIndex={-1}
        onClick={() => setSelectedCompany(null)}
        className={cn(
          "fixed inset-0 z-[90] bg-black/30 transition-opacity duration-200 sm:inset-x-0 sm:bottom-0 sm:top-[53px] sm:bg-black/20",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        className={cn(
          "fixed z-[95] flex flex-col overflow-hidden bg-card transition-transform duration-[260ms] ease-out",
          "inset-x-0 bottom-0 max-h-[88vh] w-full rounded-t-2xl border-t border-border",
          "sm:inset-x-auto sm:bottom-2.5 sm:right-2.5 sm:top-[62px] sm:w-[420px] sm:max-h-none sm:rounded-xl sm:border sm:border-border",
          open
            ? "translate-y-0 sm:translate-x-0 sm:translate-y-0"
            : "translate-y-[calc(100%+12px)] sm:translate-x-[calc(100%+12px)] sm:translate-y-0",
        )}
      >
        <div
          aria-hidden
          className="mx-auto mt-1.5 h-1 w-10 shrink-0 rounded-full bg-border sm:hidden"
        />
        {c?.top_company === true && (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[170px]"
              style={{
                background:
                  "linear-gradient(to bottom, color-mix(in oklab, var(--primary) 22%, transparent) 0%, color-mix(in oklab, var(--primary) 8%, transparent) 45%, transparent 100%)",
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-primary/70"
            />
          </>
        )}
        {c && (
          <DrawerContents
            company={c}
            sessionTags={sessionTags}
            onTagClick={handleTagClick}
            onClose={() => setSelectedCompany(null)}
          />
        )}
      </aside>
    </>,
    document.body,
  );
}

interface ContentsProps {
  company: Company;
  sessionTags: string[];
  onTagClick: (tag: string) => void;
  onClose: () => void;
}

function DrawerContents({
  company,
  sessionTags,
  onTagClick,
  onClose,
}: ContentsProps) {
  const former = firstFormerName(company);
  const location = parseLocation(company.all_locations);
  const teamSize =
    typeof company.team_size === "number" && company.team_size > 0
      ? company.team_size.toLocaleString()
      : "—";
  const launched = formatLaunched(company.launched_at);
  const regions =
    company.regions.length > 0 ? company.regions.join(" · ") : "—";
  const isTop = company.top_company === true;

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const heroRef = useRef<HTMLDivElement | null>(null);
  const [showCompact, setShowCompact] = useState(false);
  const [trackedHeroId, setTrackedHeroId] = useState(company.id);

  // The scrolling div persists across company swaps (DOM not remounted),
  // so a previously-scrolled drawer would open the next company at the
  // old scroll position. Reset compact mode synchronously here to avoid
  // a flash before the observer fires.
  if (company.id !== trackedHeroId) {
    setTrackedHeroId(company.id);
    setShowCompact(false);
  }

  useEffect(() => {
    const root = scrollerRef.current;
    const target = heroRef.current;
    if (!root || !target) return;
    root.scrollTop = 0;
    const obs = new IntersectionObserver(
      ([entry]) => setShowCompact(!entry.isIntersecting),
      // -32px so the trigger fires when the hero crosses below the
      // sticky action bar (h-8 = 32px), not the scroller's true top.
      { root, threshold: 0, rootMargin: "-32px 0px 0px 0px" },
    );
    obs.observe(target);
    return () => obs.disconnect();
  }, [company.id]);

  return (
    <>
      <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto">
        {/* Tight top action bar — breadcrumb on the left, close on the right.
            Crossfades to a compact logo + name when the hero scrolls past. */}
        <div
          className={cn(
            "sticky top-0 z-10 flex h-8 items-center justify-between border-b bg-card px-5",
            isTop ? "border-primary/20" : "border-border",
          )}
        >
          <div
            className={cn(
              "flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] tabular-nums transition-opacity duration-200 ease-out",
              showCompact && "opacity-0",
            )}
          >
            <span className="text-foreground/85">
              {batchToShort(company.batch)}
            </span>
            <span className="text-muted-foreground/50">·</span>
            <span style={{ color: STATUS_COLORS[company.status] }}>
              {company.status}
            </span>
            {company.stage && (
              <>
                <span className="text-muted-foreground/50">·</span>
                <span className="text-muted-foreground">{company.stage}</span>
              </>
            )}
          </div>

          <div
            aria-hidden={!showCompact}
            className={cn(
              "pointer-events-none absolute inset-y-0 left-5 right-10 flex items-center gap-2 transition-opacity duration-200 ease-out",
              showCompact ? "opacity-100" : "opacity-0",
            )}
          >
            <div className="flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-card">
              {company.small_logo_thumb_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={company.small_logo_thumb_url}
                  alt=""
                  loading="lazy"
                  className="size-full object-contain"
                />
              ) : null}
            </div>
            <span className="truncate text-[12.5px] font-medium leading-none text-foreground">
              {company.name}
            </span>
          </div>

          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="-mr-1.5 grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <span aria-hidden className="text-[14px] leading-none">
              ×
            </span>
          </button>
        </div>

        {/* Header zone — logo, name, one-liner */}
        <div
          ref={heroRef}
          className={cn(
            "border-b px-5 pb-4 pt-4",
            isTop ? "border-primary/15" : "border-border",
          )}
        >
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-card">
              {company.small_logo_thumb_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={company.small_logo_thumb_url}
                  alt={company.name}
                  loading="lazy"
                  className="size-full object-contain p-1"
                />
              ) : (
                <span className="font-mono text-[11px] tracking-wider text-muted-foreground">
                  {company.name.slice(0, 2)}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="break-words text-[18px] font-medium leading-tight tracking-tight text-foreground">
                {company.name}
              </h2>
              {isTop && (
                <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-primary/45 bg-primary/[0.12] px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-primary">
                  <Gem
                    className="size-2.5"
                    strokeWidth={2.2}
                    fill="currentColor"
                  />
                  YC top company
                </div>
              )}
            </div>
          </div>

          {company.one_liner && (
            <p className="mt-3 text-[13px] font-medium leading-snug text-foreground/90">
              {company.one_liner}
            </p>
          )}
        </div>

        {company.long_description && (
          <Section label="About">
            <p className="whitespace-pre-line text-[13px] leading-relaxed text-foreground/90">
              {company.long_description}
            </p>
          </Section>
        )}

        {company.tags.length > 0 && (
          <Section label="Tags" caption={String(company.tags.length)}>
            <div className="flex flex-wrap gap-1">
              {company.tags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onTagClick(t)}
                  className="rounded border border-border bg-muted/40 px-2 py-0.5 font-mono text-[10.5px] text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                >
                  {t}
                </button>
              ))}
            </div>
          </Section>
        )}

        <Section label="Details">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-mono text-[11px]">
            <MetaRow label="industry" value={company.industry || "—"} />
            <MetaRow label="subindustry" value={company.subindustry || "—"} />
            <MetaRow label="team size" value={teamSize} mono />
            <MetaRow label="launched" value={launched} mono />
            <MetaRow label="location" value={location ?? "—"} />
            <MetaRow label="regions" value={regions} />
          </dl>
        </Section>

        {former && (
          <Section label="Was">
            <div className="flex items-baseline gap-2 font-mono text-[11px]">
              <span className="text-muted-foreground">{former}</span>
              <span className="text-muted-foreground/50">→</span>
              <span className="text-foreground">{company.name}</span>
            </div>
          </Section>
        )}

        {sessionTags.length > 0 && (
          <div className="px-5 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            added filter:{" "}
            <span className="normal-case tracking-normal text-primary">
              {sessionTags.join(", ")}
            </span>
          </div>
        )}
      </div>

      {company.url && (
        <a
          href={company.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group/yc block w-full border-t border-border bg-card py-3 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-foreground transition-colors hover:bg-primary/5 hover:text-primary"
        >
          View on YC{" "}
          <span
            aria-hidden
            className="inline-block transition-transform group-hover/yc:translate-x-0.5"
          >
            →
          </span>
        </a>
      )}
    </>
  );
}

function Section({
  label,
  caption,
  children,
}: {
  label: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border px-5 py-3.5">
      <div className="mb-2 flex items-baseline justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.18em]">
        <span className="text-foreground">{label}</span>
        {caption && (
          <span className="tabular-nums text-muted-foreground/70">
            {caption}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function MetaRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "min-w-0 truncate text-right text-foreground",
          mono && "tabular-nums",
        )}
        title={value}
      >
        {value}
      </dd>
    </>
  );
}
