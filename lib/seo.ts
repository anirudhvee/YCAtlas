import type { ViewId } from "./store";

export const SITE_URL = "https://ycatlas.anirudhvee.com";
export const SITE_NAME = "YC Atlas";
export const SITE_TAGLINE =
  "Interactive dashboard for exploring 5,800+ Y Combinator companies across 46 batches (S05–P26).";
export const SITE_AUTHOR = "Anirudh Venkatachalam";
export const SITE_AUTHOR_URL = "https://www.anirudhvee.com";
export const TWITTER_HANDLE = "@anirudhvee";
export const OG_IMAGE = "/og-image.png";
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const OG_IMAGE_ALT = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const COPYRIGHT_YEAR = new Date().getFullYear();

type ViewSeo = {
  title: string;
  description: string;
};

export const VIEW_SEO: Record<ViewId, ViewSeo> = {
  overview: {
    title: "Overview",
    description:
      "The 21-year YC story at a glance: cohort outcomes, growth trajectory, industry composition, the AI inflection point, and the language each new cohort introduces.",
  },
  globe: {
    title: "Globe",
    description:
      "Every YC company plotted on a 3D globe by city, country, or region. Sized by team, colored by status (Active, Acquired, Inactive, Public). Spot the geographic shifts across 46 batches.",
  },
  timeline: {
    title: "Timeline",
    description:
      "Eight metrics traced batch-by-batch across 21 years (S05–P26): status outcomes, stage mix, top-company rate, industry composition, US vs international, team size, country diversity.",
  },
  compare: {
    title: "Compare",
    description:
      "Side-by-side cohort analysis through four lenses: outcomes, industries, regions, and trending themes. Quantify how each new YC batch differs from the last.",
  },
  buzzwords: {
    title: "Buzzwords",
    description:
      "Track phrase prevalence in YC pitches across every batch. Add custom phrases or surface the words disproportionately common in the latest cohort versus all prior batches.",
  },
  wall: {
    title: "Wall",
    description:
      "Browse every YC company in a sortable grid. Filter by status, batch, industry, region, stage, tags, team size, and hiring. Sort by top-company flag, team size, batch, or status.",
  },
  heatmap: {
    title: "Heatmap",
    description:
      "Cross-tabulate YC cohorts by industry, subindustry, tag, or region. Top 20 categories × 46 batches reveal which themes dominated each season.",
  },
  boards: {
    title: "Boards",
    description:
      "All-time YC leaderboards: highest top-company rate (mature batches), largest teams, most active regions, and public exits — plus the latest batch's tag cloud.",
  },
};
