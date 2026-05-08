import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { AskBar } from "@/components/ask-bar";
import { CompaniesProvider } from "@/components/companies-provider";
import { HashSync } from "@/components/hash-sync";
import { loadCompanies } from "@/lib/data";
import { MIN_BATCH_SIZE } from "@/lib/overview-data";
import { batchToShort, batchToSortKey } from "@/lib/utils";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "YC Atlas",
  description: "Interactive dashboard for exploring Y Combinator companies",
};

async function loadShellStats() {
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
    return { totalCompanies: companies.length, batchRange: range };
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
        {process.env.NODE_ENV !== "production" && (
          <script
            dangerouslySetInnerHTML={{
              __html: `addEventListener('pageshow',function(e){var n=performance.getEntriesByType('navigation')[0];if(e.persisted||(n&&n.type==='back_forward'))location.reload();});`,
            }}
          />
        )}
        <ThemeProvider>
          <CompaniesProvider>
            <HashSync />
            <div className="flex h-screen flex-col">
              <Header />
              <div className="flex flex-1 overflow-hidden">
                <Sidebar
                  totalCompanies={totalCompanies}
                  batchRange={batchRange}
                />
                <main className="relative flex-1 overflow-hidden">
                  {children}
                  <AskBar />
                </main>
              </div>
            </div>
          </CompaniesProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
