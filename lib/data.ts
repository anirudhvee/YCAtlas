import { cacheLife } from "next/cache";
import type { Company } from "./types";

const SOURCE_URL = "https://yc-oss.github.io/api/companies/all.json";

export async function loadCompanies(): Promise<Company[]> {
  "use cache";
  cacheLife("days");

  const res = await fetch(SOURCE_URL);
  if (!res.ok) {
    throw new Error(`Failed to load companies: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as Company[];
}
