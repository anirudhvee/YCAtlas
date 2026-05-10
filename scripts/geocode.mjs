#!/usr/bin/env node
// Manual geocoder. `npm run geocode` to populate
// lib/city-coords.generated.json from yc-oss + Nominatim. Re-run after
// new batches if the Globe's "unmapped cities" count climbs.

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const COMPANIES_URL = "https://yc-oss.github.io/api/companies/all.json";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "YCAtlas-Geocoder/1.0 (github.com/anirudhvee/YCAtlas)";
const REQUEST_DELAY_MS = 1100;

const DATA_PATH = join(process.cwd(), "lib", "city-coords.generated.json");

const NON_CITY_TOKENS = new Set([
  "",
  "Remote",
  "Partly Remote",
  "Fully Remote",
  "Worldwide",
  "Global",
]);

// Mirror of CITY_ALIASES + NON_CITY_BLOCKLIST in lib/overview-data.ts.
// Keep in sync.
const CITY_ALIASES = {
  "New York City": "New York",
  "Tel Aviv-Yafo": "Tel Aviv",
  Bangalore: "Bengaluru",
  Bombay: "Mumbai",
};
const NON_CITY_BLOCKLIST = new Set([
  "England",
  "India",
  "Algeria",
  "Federal Capital Territory",
  "Antioquia",
  "Sindh",
  "West Java",
  "NCR",
  "Alexandria Governorate",
  "Columbia",
]);

function extractCity(allLocations) {
  if (!allLocations) return null;
  let first = allLocations.split(/[,;]/)[0]?.trim();
  if (!first) return null;
  if (NON_CITY_TOKENS.has(first)) return null;
  if (first.length <= 2) return null;
  if (NON_CITY_BLOCKLIST.has(first)) return null;
  first = CITY_ALIASES[first] ?? first;
  return first;
}

function loadJson(path, fallback) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : fallback;
}

function saveJson(path, data) {
  const sorted = Object.fromEntries(
    Object.entries(data).sort(([a], [b]) => a.localeCompare(b)),
  );
  writeFileSync(path, JSON.stringify(sorted, null, 2) + "\n");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function nominatimLookup(city) {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", city);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("featuretype", "city");
  const r = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const arr = await r.json();
  if (!arr.length) return null;
  const lat = Number(arr[0].lat);
  const lon = Number(arr[0].lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return [Number(lat.toFixed(4)), Number(lon.toFixed(4))];
}

async function main() {
  console.log("→ Fetching yc-oss…");
  const r = await fetch(COMPANIES_URL);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const companies = await r.json();
  console.log(`  ${companies.length.toLocaleString()} companies`);

  const counts = new Map();
  for (const c of companies) {
    const city = extractCity(c.all_locations);
    if (!city) continue;
    counts.set(city, (counts.get(city) ?? 0) + 1);
  }
  // Most-frequent cities first so partial runs maximise coverage.
  const cities = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, n]) => ({ name, n }));
  console.log(`  ${cities.length} unique cities`);

  const data = loadJson(DATA_PATH, {});
  let queried = 0;
  let added = 0;
  let missed = 0;

  for (let i = 0; i < cities.length; i++) {
    const { name, n } = cities[i];
    if (Object.prototype.hasOwnProperty.call(data, name)) continue;
    process.stdout.write(`[${i + 1}/${cities.length}] ${name} (${n})… `);
    try {
      const coord = await nominatimLookup(name);
      data[name] = coord;
      // Save after each query so a crash mid-run preserves progress.
      saveJson(DATA_PATH, data);
      if (coord) {
        added++;
        console.log(`${coord[0]}, ${coord[1]}`);
      } else {
        missed++;
        console.log("(no match)");
      }
    } catch (err) {
      console.log(`error: ${err.message}`);
    }
    queried++;
    await sleep(REQUEST_DELAY_MS);
  }

  saveJson(DATA_PATH, data);
  const known = Object.values(data).filter((v) => v !== null).length;
  console.log(`\n✓ ${known} cities resolved · +${added} new · ${missed} no-match`);
}

main().catch((err) => {
  console.error("Geocoding failed:", err);
  process.exit(1);
});
