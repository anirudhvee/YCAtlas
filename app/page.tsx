import { loadCompanies } from "@/lib/data";

export default async function Home() {
  let count: number | null = null;
  let error: string | null = null;
  try {
    const companies = await loadCompanies();
    count = companies.length;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-12">
      <h1 className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
        YC Atlas
      </h1>
      <p className="text-5xl font-semibold tabular-nums">
        {error ? "—" : count?.toLocaleString()}
      </p>
      <p className="text-sm text-muted-foreground">
        {error ?? "companies indexed"}
      </p>
    </main>
  );
}
