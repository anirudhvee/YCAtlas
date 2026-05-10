import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { BottomNav } from "@/components/bottom-nav";
import { AskPanel } from "@/components/ask-panel";
import { CompaniesProvider } from "@/components/companies-provider";
import { FilterChipBar } from "@/components/filter-chip-bar";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { loadCompanies } from "@/lib/data";
import { MIN_BATCH_SIZE, canonicalCount } from "@/lib/overview-data";
import { batchToShort, batchToSortKey } from "@/lib/utils";
import {
  OG_IMAGE,
  OG_IMAGE_ALT,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  SITE_AUTHOR,
  SITE_AUTHOR_URL,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
  TWITTER_HANDLE,
} from "@/lib/seo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_TAGLINE,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_AUTHOR, url: SITE_AUTHOR_URL }],
  creator: SITE_AUTHOR,
  publisher: SITE_AUTHOR,
  keywords: [
    "Y Combinator",
    "YC",
    "YC companies",
    "YC batches",
    "startups",
    "startup data",
    "startup dashboard",
    "AI startups",
    "Y Combinator analytics",
    "YC Atlas",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    url: SITE_URL,
    title: SITE_NAME,
    description: SITE_TAGLINE,
    locale: "en_US",
    images: [
      {
        url: OG_IMAGE,
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        alt: OG_IMAGE_ALT,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: TWITTER_HANDLE,
    creator: TWITTER_HANDLE,
    title: SITE_NAME,
    description: SITE_TAGLINE,
    images: [OG_IMAGE],
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  category: "technology",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ff6600" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0c" },
  ],
  colorScheme: "dark light",
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_TAGLINE,
      publisher: { "@id": `${SITE_URL}#person` },
      inLanguage: "en-US",
    },
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}#app`,
      name: SITE_NAME,
      url: SITE_URL,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Any",
      browserRequirements: "Requires JavaScript. Requires HTML5.",
      description: SITE_TAGLINE,
      featureList: [
        "Overview dashboard of YC cohort outcomes",
        "Interactive 3D globe of company locations",
        "Timeline of cohort metrics across 21 years",
        "Side-by-side cohort comparison",
        "Buzzword phrase tracking across pitches",
        "Sortable wall of all companies",
        "Industry × batch heatmap",
        "All-time leaderboards",
      ],
      author: { "@id": `${SITE_URL}#person` },
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      about: {
        "@type": "Organization",
        name: "Y Combinator",
        url: "https://www.ycombinator.com",
      },
      isBasedOn: {
        "@type": "Dataset",
        name: "yc-oss/api",
        url: "https://github.com/yc-oss/api",
      },
    },
    {
      "@type": "Person",
      "@id": `${SITE_URL}#person`,
      name: SITE_AUTHOR,
      url: SITE_AUTHOR_URL,
    },
  ],
};

async function loadShellStats() {
  "use cache";
  try {
    const companies = await loadCompanies();
    const counts = new Map<string, number>();
    for (const c of companies) {
      if (c.batch === "Unspecified") continue;
      counts.set(c.batch, (counts.get(c.batch) ?? 0) + 1);
    }
    const sorted = [...counts.entries()]
      .filter(([, n]) => n >= MIN_BATCH_SIZE)
      .map(([b]) => b)
      .sort((a, b) => batchToSortKey(a) - batchToSortKey(b));
    const range =
      sorted.length > 0
        ? `${batchToShort(sorted[0])} – ${batchToShort(sorted[sorted.length - 1])}`
        : "—";
    return { totalCompanies: canonicalCount(companies), batchRange: range };
  } catch {
    return { totalCompanies: 0, batchRange: "—" };
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { totalCompanies, batchRange } = await loadShellStats();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <link rel="preload" as="fetch" href="/api/companies" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        {process.env.NODE_ENV !== "production" && (
          <script
            dangerouslySetInnerHTML={{
              __html: `addEventListener('pageshow',function(e){var n=performance.getEntriesByType('navigation')[0];if(e.persisted||(n&&n.type==='back_forward'))location.reload();});`,
            }}
          />
        )}
        <ThemeProvider>
          <NuqsAdapter>
            <CompaniesProvider>
              <div className="flex h-screen flex-col">
                <Header />
                <Suspense fallback={null}>
                  <FilterChipBar />
                </Suspense>
                <div className="flex flex-1 overflow-hidden">
                  <Sidebar
                    totalCompanies={totalCompanies}
                    batchRange={batchRange}
                  />
                  <main className="relative flex-1 overflow-hidden">
                    {children}
                    <Suspense fallback={null}>
                      <AskPanel />
                    </Suspense>
                  </main>
                </div>
                <BottomNav
                  totalCompanies={totalCompanies}
                  batchRange={batchRange}
                />
              </div>
            </CompaniesProvider>
          </NuqsAdapter>
        </ThemeProvider>
      </body>
    </html>
  );
}
