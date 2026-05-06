import { ThemeToggle } from "./theme-toggle";

export function Header() {
  return (
    <header className="sticky top-0 z-40 flex h-[52px] shrink-0 items-center justify-between border-b border-border bg-background/85 px-5 backdrop-blur">
      <div className="font-mono text-[13px] font-semibold tracking-[0.22em] text-primary select-none">
        YC ATLAS
      </div>
      <div className="flex items-center gap-4">
        <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
          Built with public YC data · 2026
        </span>
        <span className="hidden h-3 w-px bg-border sm:inline-block" />
        <ThemeToggle />
        <a
          href="https://github.com/anirudhvee/YCAtlas"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub repository"
          className="grid size-7 place-items-center rounded text-muted-foreground transition-colors hover:text-foreground"
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
