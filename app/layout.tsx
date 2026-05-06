import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { AskBar } from "@/components/ask-bar";
import { loadCompanies } from "@/lib/data";
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
    const sorted = [...new Set(companies.map((c) => c.batch))]
      .filter((b) => b !== "Unspecified")
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
        <ThemeProvider>
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
        </ThemeProvider>
      </body>
    </html>
  );
}
