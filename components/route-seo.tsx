import { SITE_NAME, SITE_TAGLINE, VIEW_SEO } from "@/lib/seo";
import type { ViewId } from "@/lib/store";

export function RouteSeo({ view }: { view: ViewId }) {
  const seo = VIEW_SEO[view];
  const isOverview = view === "overview";
  return (
    <div className="sr-only">
      <h1>{isOverview ? SITE_NAME : `${seo.title} · ${SITE_NAME}`}</h1>
      <p>{isOverview ? SITE_TAGLINE : seo.description}</p>
      <nav aria-label="Views">
        <ul>
          {Object.entries(VIEW_SEO).map(([id, v]) => (
            <li key={id}>
              <a href={id === "overview" ? "/" : `/${id}`}>
                {v.title}: {v.description}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
