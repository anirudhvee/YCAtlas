import { cacheLife } from "next/cache";
import { loadCompanies } from "@/lib/data";
import type { ViewId } from "@/lib/store";
import type { Company, CompanyStatus } from "@/lib/types";
import { extractCity } from "@/lib/overview-data";
import { batchToShort, batchToSortKey } from "@/lib/utils";

const MIN_BATCH_SIZE = 5;

export async function ViewContent({ view }: { view: ViewId }) {
  "use cache";
  cacheLife("days");
  const companies = await loadCompanies();
  return (
    <section className="sr-only" aria-label={`${view} index`}>
      {renderView(view, companies)}
    </section>
  );
}

function renderView(view: ViewId, companies: Company[]) {
  switch (view) {
    case "overview":
      return <OverviewContent companies={companies} />;
    case "wall":
      return <WallContent companies={companies} />;
    case "boards":
      return <BoardsContent companies={companies} />;
    case "heatmap":
      return <HeatmapContent companies={companies} />;
    case "timeline":
      return <TimelineContent companies={companies} />;
    case "buzzwords":
      return <BuzzwordsContent companies={companies} />;
    case "globe":
      return <GlobeContent companies={companies} />;
    case "compare":
      return <CompareContent companies={companies} />;
  }
}

function batches(companies: Company[]) {
  const counts = new Map<string, number>();
  for (const c of companies) {
    if (c.batch === "Unspecified") continue;
    counts.set(c.batch, (counts.get(c.batch) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= MIN_BATCH_SIZE)
    .sort((a, b) => batchToSortKey(a[0]) - batchToSortKey(b[0]));
}

function statusCounts(companies: Company[]): Record<CompanyStatus, number> {
  const acc: Record<CompanyStatus, number> = {
    Active: 0,
    Inactive: 0,
    Acquired: 0,
    Public: 0,
  };
  for (const c of companies) acc[c.status] = (acc[c.status] ?? 0) + 1;
  return acc;
}

function OverviewContent({ companies }: { companies: Company[] }) {
  const bs = batches(companies);
  const latest = bs.at(-1)?.[0];
  const status = statusCounts(companies);
  const latestTop = companies
    .filter((c) => c.batch === latest && c.top_company === true)
    .slice(0, 20);
  return (
    <>
      <h2>YC Atlas — overview</h2>
      <p>
        YC Atlas tracks {companies.length.toLocaleString()} Y Combinator
        companies across {bs.length} batches, from {batchToShort(bs[0][0])} to{" "}
        {latest ? batchToShort(latest) : "—"}. {status.Active.toLocaleString()}{" "}
        are active, {status.Public.toLocaleString()} are publicly traded,{" "}
        {status.Acquired.toLocaleString()} have been acquired, and{" "}
        {status.Inactive.toLocaleString()} are inactive.
      </p>
      {latest && latestTop.length > 0 && (
        <>
          <h3>Top companies in the latest batch ({batchToShort(latest)})</h3>
          <ul>
            {latestTop.map((c) => (
              <li key={c.id}>
                {c.name} — {c.one_liner}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function WallContent({ companies }: { companies: Company[] }) {
  const sorted = [...companies].sort((a, b) => {
    const at = a.top_company ? 1 : 0;
    const bt = b.top_company ? 1 : 0;
    if (at !== bt) return bt - at;
    return batchToSortKey(b.batch) - batchToSortKey(a.batch);
  });
  const list = sorted.slice(0, 200);
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "YC companies — wall",
    numberOfItems: list.length,
    itemListElement: list.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `https://www.ycombinator.com/companies/${c.slug}`,
      name: c.name,
    })),
  };
  return (
    <>
      <h2>YC companies — wall</h2>
      <p>
        Showing {list.length} of {companies.length.toLocaleString()} Y
        Combinator companies. Top-company picks first, then by most-recent
        batch.
      </p>
      <ul>
        {list.map((c) => (
          <li key={c.id}>
            {c.name} ({batchToShort(c.batch)}, {c.status}) — {c.one_liner}
          </li>
        ))}
      </ul>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(itemList).replace(/</g, "\\u003c"),
        }}
      />
    </>
  );
}

function BoardsContent({ companies }: { companies: Company[] }) {
  const teamLeaders = [...companies]
    .filter((c) => (c.team_size ?? 0) > 0)
    .sort((a, b) => (b.team_size ?? 0) - (a.team_size ?? 0))
    .slice(0, 15);
  const publics = companies.filter((c) => c.status === "Public").slice(0, 25);
  const acquired = companies
    .filter((c) => c.status === "Acquired" && c.top_company === true)
    .slice(0, 20);
  return (
    <>
      <h2>YC leaderboards</h2>
      <h3>Largest teams</h3>
      <ul>
        {teamLeaders.map((c) => (
          <li key={c.id}>
            {c.name} — {c.team_size?.toLocaleString()} ({batchToShort(c.batch)})
          </li>
        ))}
      </ul>
      <h3>Public exits</h3>
      <ul>
        {publics.map((c) => (
          <li key={c.id}>
            {c.name} ({batchToShort(c.batch)}) — {c.one_liner}
          </li>
        ))}
      </ul>
      <h3>Top-company acquisitions</h3>
      <ul>
        {acquired.map((c) => (
          <li key={c.id}>
            {c.name} ({batchToShort(c.batch)}) — {c.one_liner}
          </li>
        ))}
      </ul>
    </>
  );
}

function HeatmapContent({ companies }: { companies: Company[] }) {
  const industries = new Map<string, number>();
  for (const c of companies) {
    if (!c.industry) continue;
    industries.set(c.industry, (industries.get(c.industry) ?? 0) + 1);
  }
  const top = [...industries.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25);
  return (
    <>
      <h2>YC industries × batches</h2>
      <p>
        Cross-tabulation of {companies.length.toLocaleString()} companies by
        industry and batch.
      </p>
      <h3>Top industries</h3>
      <ul>
        {top.map(([name, n]) => (
          <li key={name}>
            {name} — {n.toLocaleString()} companies
          </li>
        ))}
      </ul>
    </>
  );
}

function TimelineContent({ companies }: { companies: Company[] }) {
  const aggs = batches(companies).map(([batch, total]) => {
    const inBatch = companies.filter((c) => c.batch === batch);
    const active = inBatch.filter((c) => c.status === "Active").length;
    const top = inBatch.filter((c) => c.top_company === true).length;
    return { batch, total, active, top };
  });
  return (
    <>
      <h2>YC timeline — all batches</h2>
      <p>
        Batch-by-batch metrics across {aggs.length} cohorts of Y Combinator,
        spanning {batchToShort(aggs[0].batch)} to{" "}
        {batchToShort(aggs[aggs.length - 1].batch)}.
      </p>
      <ul>
        {aggs.map(({ batch, total, active, top }) => (
          <li key={batch}>
            {batchToShort(batch)}: {total.toLocaleString()} companies,{" "}
            {active.toLocaleString()} active, {top.toLocaleString()} top
          </li>
        ))}
      </ul>
    </>
  );
}

function BuzzwordsContent({ companies }: { companies: Company[] }) {
  const tags = new Map<string, number>();
  for (const c of companies) {
    for (const t of c.tags) tags.set(t, (tags.get(t) ?? 0) + 1);
  }
  const top = [...tags.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60);
  return (
    <>
      <h2>YC buzzwords — phrase prevalence</h2>
      <p>Most common tags across {companies.length.toLocaleString()} YC pitches.</p>
      <ul>
        {top.map(([tag, n]) => (
          <li key={tag}>
            {tag} — {n.toLocaleString()}
          </li>
        ))}
      </ul>
    </>
  );
}

function GlobeContent({ companies }: { companies: Company[] }) {
  const cities = new Map<string, number>();
  for (const c of companies) {
    const city = extractCity(c.all_locations);
    if (!city) continue;
    cities.set(city, (cities.get(city) ?? 0) + 1);
  }
  const top = [...cities.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60);
  return (
    <>
      <h2>YC companies by location</h2>
      <p>Top cities by YC company headcount.</p>
      <ul>
        {top.map(([city, n]) => (
          <li key={city}>
            {city} — {n.toLocaleString()}
          </li>
        ))}
      </ul>
    </>
  );
}

function CompareContent({ companies }: { companies: Company[] }) {
  const bs = batches(companies).slice(-6);
  return (
    <>
      <h2>Compare YC batches</h2>
      <p>Recent batch comparison across outcomes, regions, and themes.</p>
      <ul>
        {bs.map(([batch, total]) => {
          const inBatch = companies.filter((c) => c.batch === batch);
          const active = inBatch.filter((c) => c.status === "Active").length;
          const top = inBatch.filter((c) => c.top_company === true).length;
          return (
            <li key={batch}>
              {batchToShort(batch)}: {total.toLocaleString()} companies,{" "}
              {active.toLocaleString()} active, {top.toLocaleString()} top
            </li>
          );
        })}
      </ul>
    </>
  );
}
