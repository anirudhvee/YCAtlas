# YC Atlas

Interactive dashboard for exploring Y Combinator companies.

## Stack

Next.js 16 (App Router, Turbopack, `cacheComponents: true`), React 19, TypeScript, Tailwind v4, shadcn/ui (new-york). Zustand for **non-URL** UI state only; `nuqs` for URL state. Recharts. `react-globe.gl` for the Globe view; `d3-geo` + `topojson-client` + `world-atlas` only feed the globe's country graticule (there is no 2D Geography tile). Data: `https://yc-oss.github.io/api/companies/all.json`.

> **Next.js 16 caveat:** APIs and conventions differ from older versions. Read `node_modules/next/dist/docs/` before writing Next-specific code — your training data may not match.

## Commands

```bash
npm run dev            # next dev (user runs this; do not start it yourself)
npm run build          # next build
npm run lint           # eslint
npm run geocode        # one-shot: backfill lib/city-coords.generated.json

npx tsc --noEmit                       # required after every change
npx eslint app components lib          # required after every change
```

## Repo layout

```
app/
  layout.tsx           shell (NuqsAdapter > CompaniesProvider > chrome)
  page.tsx             root → Overview
  [view]/page.tsx      dynamic route for the 7 non-overview views
  api/companies        cached JSON proxy
  api/ask              streaming LLM with sandboxed tool calls
  globals.css          theme tokens + reusable helper classes
components/
  canvas, header, sidebar, bottom-nav, filter-chip-bar, detail-drawer
  ask-{panel,trigger,turn,event}, companies-provider, theme-*
  overview/  wall/  heatmap/  buzzwords/  boards/  timeline/  compare/  globe/
lib/
  data, types                          fetch + Company type
  store                                Zustand UI store + FilterState type + filterCompanies
  url-state                            nuqs hooks (sole nuqs touch point)
  views, utils, use-mounted
  overview-data, compare-data, phrases, ask-context, ask-sandbox
```

## Data

- `lib/data.ts → loadCompanies()` is `'use cache'` + `cacheLife("days")`. Required because the JSON (~13MB) exceeds Next's 2MB fetch-cache ceiling.
- `app/layout.tsx → loadShellStats()` is also `'use cache'` — `cacheComponents` requires it for static rendering.
- Server components call `loadCompanies()` directly. Client components read from `CompaniesProvider` (which fetches `/api/companies`). **Never** thread the array through RSC props.
- Use only fields yc-oss/api ships (`lib/types.ts`). No founders, funding, acquirers, partners.
- `industry` and `stage` are typed as `string`, not narrow unions — yc-oss adds values without notice.

## URL state

Path = view; query string = filters. Overview lives at `/`; the seven other views route through `app/[view]/page.tsx` with a typed `isViewParam` predicate that `notFound()`s on miss.

`lib/url-state.ts` is the only place that talks to `nuqs`. It exports `useView`, `useFilters`, `usePhrases`, `useCompareBatches`, `useFilteredCompanies`, and `useNavigateToView`. **Do not** add Zustand state for anything that should be in the URL.

- **`FILTER_KEY_TO_URL`** in `lib/url-state.ts` is the single FilterState ↔ URL-key mapping. The `satisfies Record<keyof FilterState, keyof typeof filterParsers>` clause locks both directions. Adding a new filter touches `FilterState`, `filterParsers`, and `FILTER_KEY_TO_URL` — `setFilters`, `clearFilters`, `NavValues` all derive.
- **`useNavigateToView` footgun:** it reads the base from `window.location.search`, so a `setFilters({...})` call in the same tick may not have landed and gets dropped. Fold every change into the patch, or `await` the prior `setFilters` first.
- Booleans serialize as `"1"`/`"0"`; absent ⇒ `null` (tri-state — `false` and "not set" must remain distinguishable).
- Batches are long-form in state ("Winter 2022"), short-coded in URLs ("W22"). Spring uses `P` (`P25`, `P26`); `X` is no longer accepted.

## Non-URL state

`lib/store.ts` Zustand store holds only `selectedCompany`, `askOpen`, `timelineMetric`. `useMounted` (`lib/use-mounted.ts`) survives only for **portal mounters** (`detail-drawer`, `bottom-nav` MoreSheet, `theme-toggle`). Do **not** re-introduce `useMounted` gates around filter reads — nuqs returns URL values on first client render.

## Marker-vs-filter pattern

When the user selects one batch (cohort strip), behavior depends on view kind:

- **Time-series charts** (Growth, Composition, Buzzwords): ignore the batches filter; render against the full set; draw a vertical orange `<ReferenceLine>` at the selected batch.
- **List/grid views** (Wall, Recent Logos tile): filter by batch.
- **Globe**: city-level dots via `extractCity` + `CITY_COORDS` (in `lib/overview-data.ts`, supplemented by `lib/city-coords.generated.json`). Not region-level.
- **Heatmap**: rows/cols come from the unfiltered set (structure stays stable); cell counts use the filtered set; the selected column header turns orange.
- **Boards**: never filter — all-time leaderboards. Selected batch's row gets an orange highlight if present.

`selectedBatch = filters.batches.length === 1 ? filters.batches[0] : null` — read straight from `useFilters()`. No gate.

## Batches

- API returns long-form season + year; missing ⇒ `"Unspecified"`. Most aggregations skip Unspecified.
- Conversion lives in `lib/utils.ts` (`batchToShort`, `batchFromShort`, `batchToSortKey`). State stores long form; convert at render-time / URL-encode-time only.
- `MIN_BATCH_SIZE = 5` (`lib/overview-data.ts`) excludes microbatches and trailing deferral batches. Apply consistently across cohort strip, time-series charts, sidebar batch range, and `findLatestBatch`.
- The composition chart additionally drops batches where <50% of companies have any `tags` populated — guards against under-curated mirror data.

## Views

All eight are built: Overview (`/`), Globe, Timeline, Compare, Buzzwords, Wall, Heatmap, Boards. Nav metadata in `lib/views.ts` (label, icon, group, kbd shortcut). `components/canvas.tsx` reads `useView()` and routes to the matching component, falling back to `ViewPlaceholder`.

FilterChipBar and AskPanel sit inside `<Suspense>` boundaries in the layout — they read `useSearchParams` via nuqs.

## Aesthetic

- **Orange `--primary` = `#ff6600`** is the only saturated brand accent. Used on wordmark, active nav, focus rings, selection markers (cohort bar, ReferenceLine, Heatmap selected-cell ring), the AskBar `/` prefix, the filter chip ×, the Wall hover drop-shadow.
- **Status palette** (Growth chart): Active `#0891b2`, Inactive `#64748b`, Acquired `#10b981`, Public `#a855f7`. Same hex in light + dark.
- **Composition palette**: AI `#8a8df0`, SaaS `#33b1ff`, Fintech `#5cc8a8`, Crypto/Web3 `#d4a93c`, Marketplace `#e87aa8`, Climate `#9bd16a`, Developer Tools `#b483e8`. The 0–30° hue wedge is intentionally empty so YC orange always reads as the brightest hue on screen.
- Hairline borders, no shadows, no gradients.
- Mono for all metadata. Tabular-nums on every number. Sentence case. Mono titles are SMALL CAPS via uppercase + tracking.
- **`app/globals.css` exposes reusable helpers** (`.eyebrow`, `.cap-label`, `.page-head`, `.seg`, `.stat-pill`, `.pill-btn`, `.scroll-fine`, `.bottom-nav-surface`, `.sheet-in`, `.with-bottom-nav`, `.pb-safe`, `.slider-clean`, plus `.ask-*` animations). Use them; don't re-roll Tailwind soup.
- **Mobile**: ≥lg shows Sidebar; <lg drops to `BottomNav` with a "More" sheet. `env(safe-area-inset-*)` via `.pb-safe`. Coarse-pointer media queries bump tap targets and font sizes.

## Code style

- Default to writing no comments. Add one only when the WHY is non-obvious (a hidden constraint, a workaround, a footgun). Don't narrate WHAT well-named code already says.
- No backwards-compat shims, no unused-var renames, no `// removed` placeholders. Delete dead code outright.
- Don't add error handling, fallbacks, or validation for impossible cases. Trust internal code; validate only at system boundaries.
- Prefer editing existing files over creating new ones. Never write Markdown docs unless asked.

## Commits & PRs

Conventional Commits with scope: `feat(view):`, `fix(area):`, `chore(area):`, `perf(area):`, `docs(area):`. Subject in imperative, lowercase, no trailing period. One logical change per commit; don't mix refactor + feature. Don't commit when type-check or lint fails.

## Verification

After every change: `npx tsc --noEmit && npx eslint app components lib`. The user runs `npm run dev` manually — don't start it.
