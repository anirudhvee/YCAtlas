import type { MetadataRoute } from "next";
import { cacheLife } from "next/cache";
import { NON_OVERVIEW_VIEWS } from "@/lib/store";
import { SITE_URL } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  "use cache";
  cacheLife("days");

  const lastModified = new Date();
  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...NON_OVERVIEW_VIEWS.map((view) => ({
      url: `${SITE_URL}/${view}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
