import { loadCompanies } from "@/lib/data";

export async function GET() {
  const companies = await loadCompanies();
  return Response.json(companies, {
    headers: {
      "Cache-Control":
        "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}
