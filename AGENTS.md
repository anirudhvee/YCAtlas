# YC Atlas

Interactive dashboard for exploring Y Combinator companies.

## Stack

- Next.js 16 (App Router, Turbopack), React 19, TypeScript
- Tailwind v4, shadcn/ui (new-york), lucide icons, Geist Sans/Mono
- Zustand, Recharts
- Maps: `d3-geo` + `topojson-client` + `world-atlas` for the flat 2D Geography tile on Overview; `react-globe.gl` for the upcoming Globe view (currently a stub)
- Data: yc-oss/api (`https://yc-oss.github.io/api/companies/all.json`)

> **Next.js 16 caveat:** APIs, conventions, and file structure differ from older Next versions. Before writing any Next-specific code (App Router, caching, server components, route handlers), read the relevant guide in `node_modules/next/dist/docs/` and heed deprecation notices — your training data may not match.

## Data

- `lib/data.ts → loadCompanies()` uses Next 16 `'use cache'` with `cacheLife("days")`. The JSON is ~13MB which exceeds Next's 2MB fetch cache ceiling, so `'use cache'` is required. `next.config.ts` has `cacheComponents: true`.
- Server components call `loadCompanies()` directly. Client components fetch via `/api/companies` through `CompaniesProvider`. Don't pass the array through RSC props.
- Only use fields yc-oss/api actually ships — no founders, funding, acquirers, partners.
- `industry` and `stage` are typed as `string`, not narrow unions.

## State

- One Zustand store at `lib/store.ts`: `view`, `filters`, `phrases`, `filterRevision`.
- `phrases` (Buzzwords user-added phrases) lives outside `FilterState` so `clearFilters` doesn't wipe them. `addPhrase` does case-insensitive dedup so URL-hash variants don't leak past the store.
- Store syncs to URL hash via `components/hash-sync.tsx`. Synchronous hydration in `getInitialState()` so first paint is correct. Writes debounce 150ms. SSR/hydration safety via `useMounted` (`useSyncExternalStore`).
- URL keys are short: `v` (view), `s` (status), `b` (batches), `i` (industries), `t` (tags), `r` (regions), `g` (stage), `top`, `fn` (formerNames), `tmin`/`tmax` (team size), `q` (search), `bw` (buzzword phrases). Batches encode as short codes (W12/P25/S25/F24); the store holds the long form. Spring uses `P` (YC's current code, e.g. `P25`/`P26`) — `X` is no longer accepted.

## Marker-vs-filter pattern

When the user selects one batch via the cohort strip, filter handling depends on view type:

- **Time-series charts** (Growth, Composition, Buzzwords) ignore the batches filter and render against the full set, drawing a vertical orange `<ReferenceLine>` at the selected batch position.
- **List/grid views** (Wall, Recent Logos tile, Geography dots) filter by batch. Geography is **city-level** — `extractCity` parses `all_locations` and resolves against the `CITY_COORDS` lookup table in `lib/overview-data.ts` (source of truth, ~110 cities with spelling aliases). Not region-level.
- **Heatmap** rows/cols come from the unfiltered set so structure stays stable; cell counts come from the filtered set; the selected batch column header turns orange and gets a faint primary wash.
- **Leaderboards** (Top Batches tile) never filter — they're all-time. The selected batch's row gets an orange highlight if present.

`selectedBatch = filters.batches.length === 1 ? filters.batches[0] : null` (gated by `useMounted`).

Pre-mount renders fall back to the unfiltered set everywhere — the `useMounted` gate exists for SSR/hydration safety (the store reads `location.hash` at module load on the client, which the server doesn't see), not as a feature toggle.

## Batches

- API returns long-form season + year (e.g. "Winter 2012"). Companies with unknown batch are tagged `"Unspecified"` — most aggregations skip these.
- `lib/utils.ts` has `batchToShort` and `batchToSortKey`. Store the long form; convert only at render time.
- `MIN_BATCH_SIZE = 5` (in `lib/overview-data.ts`) excludes tiny historical microbatches and trailing deferral batches that aren't fully populated yet. Apply consistently across cohort strip, time-series charts, sidebar batch range, and `findLatestBatch`.
- The composition chart additionally drops batches where <50% of companies have any `tags` populated — filters out under-curated upstream data when the yc-oss mirror lags YC's own tag backfill.

## Views

- **Built**: Overview (default), Wall, Heatmap, Buzzwords, Boards, Globe, Timeline.
- `lib/views.ts` holds the nav metadata; `canvas.tsx` routes view ids to components and falls back to `ViewPlaceholder` if a new id is added without a component.

## Files

```
app/
  layout.tsx               server: stats, providers
  page.tsx                 renders <Canvas />
  api/companies/route.ts   cached JSON proxy for client fetch
  globals.css              theme tokens (light + dark)
components/
  canvas.tsx               view router; FilterChipBar at top
  filter-chip-bar.tsx      replaces the old DebugStrip
  hash-sync.tsx            store ↔ URL hash bridge
  companies-provider.tsx   client-side fetch + context
  header.tsx, sidebar.tsx, ask-bar.tsx, theme-*.tsx
  ui/                      shadcn primitives
  overview/                cohort strip, growth, composition, 4 tiles
  wall/, heatmap/, buzzwords/
  boards/                  six all-time leaderboards (3×2 grid)
  globe/                   3D react-globe.gl view (dynamic-imported, ssr:false)
  timeline/                area + 100%-stacked fate charts, with metric pills
lib/
  data.ts, types.ts, store.ts, utils.ts
  url-state.ts             encode/decode hash
  overview-data.ts         aggregations + STATUS/COMPOSITION palettes + city coords
  views.ts                 nav metadata
  use-mounted.ts           useSyncExternalStore mount detector
```

## Aesthetic

- **Orange `--primary` = `#ff6600`** (canonical YC) is the only saturated brand accent. Used on wordmark, active nav, focus rings, selection markers (cohort bar, ReferenceLine on every time-series chart, Heatmap selected-cell ring), the AskBar `/` prefix, the filter chip ×, and the Wall hover drop-shadow that traces the logo silhouette.
- **Status palette** (Growth chart): `Active #0891b2`, `Inactive #64748b`, `Acquired #10b981`, `Public #a855f7`. Tailwind 500–600 for dual-theme contrast. Same hex in light + dark; mirrored as `--status-*` vars in `app/globals.css`.
- **Composition palette** (multi-line chart): `AI #8a8df0`, `SaaS #33b1ff`, `Fintech #5cc8a8`, `Crypto/Web3 #d4a93c`, `Marketplace #e87aa8`, `Climate #9bd16a`, `Developer Tools #b483e8`. The 0–30° hue wedge is left empty so the YC orange marker is always the brightest hue on screen.
- Hairline borders, no shadows, no gradients.
- Mono for all metadata: batch IDs, counts, peak labels, "live · yc-oss/api". Tabular-nums on every number.
- Sentence case. Mono titles are SMALL CAPS via uppercase + tracking.

## Verification

After changes, run `npx tsc --noEmit` and `npx eslint app components lib`. The user runs dev manually.
