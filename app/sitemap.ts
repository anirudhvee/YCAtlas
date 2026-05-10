import type { MetadataRoute } from "next";
import { NON_OVERVIEW_VIEWS } from "@/lib/store";
import { SITE_URL } from "@/lib/seo";

const lastModified = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
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
