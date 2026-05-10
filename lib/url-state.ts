import { batchToShort } from "./utils";

export interface UrlDecoded {
  view?: string;
  status?: string[];
  batches?: string[];
  industries?: string[];
  tags?: string[];
  regions?: string[];
  stage?: string[];
  top_company?: boolean;
  hasFormerNames?: boolean;
  isHiring?: boolean;
  teamSizeMin?: number;
  teamSizeMax?: number;
  search?: string;
  phrases?: string[];
  compareBatches?: string[];
}

export interface UrlInput {
  view: string;
  status: string[];
  batches: string[];
  industries: string[];
  tags: string[];
  regions: string[];
  stage: string[];
  top_company: boolean | null;
  hasFormerNames: boolean | null;
  isHiring: boolean | null;
  teamSizeMin: number | null;
  teamSizeMax: number | null;
  search: string | null;
  phrases: string[];
  compareBatches: string[];
}

const SEASON_FROM_SHORT: Record<string, string> = {
  W: "Winter",
  P: "Spring",
  S: "Summer",
  F: "Fall",
};

function batchFromShort(s: string): string {
  const m = /^([WPSF])(\d{2})$/.exec(s);
  if (!m) return s;
  return `${SEASON_FROM_SHORT[m[1]]} ${2000 + Number(m[2])}`;
}

const enc = encodeURIComponent;

function csvEncode(values: string[]): string {
  return values.map(enc).join(",");
}

function csvDecode(raw: string): string[] {
  return raw
    .split(",")
    .filter(Boolean)
    .map((v) => decodeURIComponent(v));
}

export function encodeHash(state: UrlInput): string {
  const parts: string[] = [];

  if (state.view !== "overview") parts.push(`v=${enc(state.view)}`);
  if (state.status.length) parts.push(`s=${csvEncode(state.status)}`);
  if (state.batches.length) {
    parts.push(`b=${csvEncode(state.batches.map(batchToShort))}`);
  }
  if (state.industries.length) parts.push(`i=${csvEncode(state.industries)}`);
  if (state.tags.length) parts.push(`t=${csvEncode(state.tags)}`);
  if (state.regions.length) parts.push(`r=${csvEncode(state.regions)}`);
  if (state.stage.length) parts.push(`g=${csvEncode(state.stage)}`);
  if (state.top_company !== null) {
    parts.push(`top=${state.top_company ? "1" : "0"}`);
  }
  if (state.hasFormerNames !== null) {
    parts.push(`fn=${state.hasFormerNames ? "1" : "0"}`);
  }
  if (state.isHiring !== null) {
    parts.push(`h=${state.isHiring ? "1" : "0"}`);
  }
  if (state.teamSizeMin !== null) parts.push(`tmin=${state.teamSizeMin}`);
  if (state.teamSizeMax !== null) parts.push(`tmax=${state.teamSizeMax}`);
  if (state.search) parts.push(`q=${enc(state.search)}`);
  if (state.phrases.length) parts.push(`bw=${csvEncode(state.phrases)}`);
  if (state.compareBatches.length) {
    parts.push(`cmp=${csvEncode(state.compareBatches.map(batchToShort))}`);
  }

  return parts.join("&");
}

export function decodeHash(hash: string): UrlDecoded {
  if (!hash) return {};
  const out: UrlDecoded = {};
  const params = new URLSearchParams(hash);

  const v = params.get("v");
  if (v) out.view = v;

  const s = params.get("s");
  if (s) out.status = csvDecode(s);

  const b = params.get("b");
  if (b) out.batches = csvDecode(b).map(batchFromShort);

  const i = params.get("i");
  if (i) out.industries = csvDecode(i);

  const t = params.get("t");
  if (t) out.tags = csvDecode(t);

  const r = params.get("r");
  if (r) out.regions = csvDecode(r);

  const g = params.get("g");
  if (g) out.stage = csvDecode(g);

  const top = params.get("top");
  if (top === "1") out.top_company = true;
  else if (top === "0") out.top_company = false;

  const fn = params.get("fn");
  if (fn === "1") out.hasFormerNames = true;
  else if (fn === "0") out.hasFormerNames = false;

  const h = params.get("h");
  if (h === "1") out.isHiring = true;
  else if (h === "0") out.isHiring = false;

  const tmin = params.get("tmin");
  if (tmin && /^\d+$/.test(tmin)) out.teamSizeMin = Number(tmin);

  const tmax = params.get("tmax");
  if (tmax && /^\d+$/.test(tmax)) out.teamSizeMax = Number(tmax);

  const q = params.get("q");
  if (q) out.search = q;

  const bw = params.get("bw");
  if (bw) out.phrases = csvDecode(bw);

  const cmp = params.get("cmp");
  if (cmp) out.compareBatches = csvDecode(cmp).map(batchFromShort);

  return out;
}
