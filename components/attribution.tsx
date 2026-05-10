import { ArrowUpRight } from "lucide-react";

export function AttributionBlock({
  size = "compact",
}: {
  size?: "compact" | "comfortable";
}) {
  const isComfy = size === "comfortable";
  const linkSize = isComfy ? "text-[12px]" : "text-[10px]";
  const metaSize = isComfy ? "text-[10.5px]" : "text-[9px]";
  const iconSize = isComfy ? "size-3" : "size-2.5";
  const xButtonSize = isComfy ? "size-6" : "size-5";

  return (
    <div className={`mt-2.5 flex flex-col gap-1.5 leading-snug ${linkSize}`}>
      <a
        href="https://www.anirudhvee.com"
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex flex-wrap items-baseline gap-x-1 text-muted-foreground transition-colors hover:text-foreground"
      >
        <span>Built by</span>
        <span className="inline-flex items-baseline gap-0.5 text-foreground transition-colors group-hover:text-primary">
          <span>Anirudh Venkatachalam</span>
          <ArrowUpRight
            className={`${iconSize} translate-y-[1px] text-faint transition-colors group-hover:text-primary`}
            strokeWidth={1.75}
          />
        </span>
      </a>
      <div
        className={`truncate whitespace-nowrap tracking-tight text-faint ${metaSize}`}
      >
        Not affiliated with Y Combinator
      </div>
      <div className={`flex items-center justify-between gap-2 text-faint`}>
        <span
          className={`truncate whitespace-nowrap tracking-tight ${metaSize}`}
        >
          © 2026 Anirudh Venkatachalam
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          <a
            href="https://github.com/anirudhvee"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Anirudh on GitHub"
            className={`grid ${xButtonSize} place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--bg-soft)] hover:text-foreground`}
          >
            <GithubGlyph className={iconSize} />
          </a>
          <a
            href="https://x.com/anirudhvee"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Anirudh on X"
            className={`grid ${xButtonSize} place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--bg-soft)] hover:text-foreground`}
          >
            <XMark className={iconSize} />
          </a>
        </div>
      </div>
    </div>
  );
}

function XMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

function GithubGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.76 2.69 1.25 3.34.96.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.05 11.05 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.13 0 1.54-.01 2.78-.01 3.16 0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}
