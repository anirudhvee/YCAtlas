"use client";

import { Sparkles } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { AskTrigger } from "./ask-trigger";
import { useUi } from "@/lib/store";
import { useView } from "@/lib/url-state";
import { VIEWS } from "@/lib/views";

export function Header() {
  const [view] = useView();
  const setAskOpen = useUi((s) => s.setAskOpen);
  const askOpen = useUi((s) => s.askOpen);
  const meta = VIEWS.find((v) => v.id === view);

  return (
    <header
      className="sticky top-0 z-40 flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border bg-background/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-4"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex min-w-0 items-center gap-3.5">
        <span
          role="img"
          aria-label="YC ATLAS"
          className="select-none font-mono text-[16px] font-semibold tracking-[0.18em] text-primary sm:text-[15.5px]"
        >
          <span aria-hidden>YC&nbsp;</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon.svg"
            alt=""
            aria-hidden
            className="inline-block h-[0.7em] w-[0.7em] align-baseline"
            draggable={false}
          />
          <span aria-hidden>TLAS</span>
        </span>
        <span className="divider-v hidden sm:inline-block" aria-hidden />
        <div className="hidden items-center gap-2 font-mono text-[11px] sm:inline-flex">
          <span className="text-muted-foreground">{meta?.group ?? "Explore"}</span>
          <span className="text-faint">/</span>
          <span className="text-foreground">{meta?.label ?? "Overview"}</span>
        </div>
        <span className="truncate font-mono text-[11px] text-muted-foreground sm:hidden">
          {meta?.label ?? "Overview"}
        </span>
      </div>
      <div className="pointer-events-none absolute left-1/2 hidden -translate-x-1/2 md:block">
        <div className="pointer-events-auto">
          <AskTrigger />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 md:gap-1">
        <button
          type="button"
          onClick={() => setAskOpen(true)}
          aria-label="Open Ask Atlas"
          aria-hidden={askOpen}
          tabIndex={askOpen ? -1 : 0}
          data-ask-trigger="mobile"
          className={`group inline-flex h-8 items-center gap-1.5 rounded-full border border-border/80 bg-card/60 pr-3 pl-2 text-left transition-[opacity,border-color,background-color,box-shadow] duration-150 hover:border-primary/40 hover:bg-card/90 hover:shadow-[0_4px_18px_-10px_rgba(255,102,0,0.5)] md:hidden ${askOpen ? "pointer-events-none opacity-0" : "opacity-100"}`}
        >
          <span className="grid size-5 place-items-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="size-3" strokeWidth={2.25} />
          </span>
          <span className="font-mono text-[11px] tracking-[0.06em] text-muted-foreground transition-colors group-hover:text-foreground">
            Ask
          </span>
        </button>
        <ThemeToggle />
        <span className="divider-v mx-1 hidden sm:inline-block" aria-hidden />
        <a
          href="https://github.com/anirudhvee/YCAtlas"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub repository"
          className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--bg-soft)] hover:text-foreground"
        >
          <GithubMark className="size-3.5" />
        </a>
      </div>
    </header>
  );
}

function GithubMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.76 2.69 1.25 3.34.96.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.05 11.05 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.13 0 1.54-.01 2.78-.01 3.16 0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}
