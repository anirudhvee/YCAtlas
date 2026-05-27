import {
  getQuickJS,
  shouldInterruptAfterDeadline,
} from "quickjs-emscripten";
import type { Company } from "./types";

const MEMORY_LIMIT_BYTES = 64 * 1024 * 1024;
const EXECUTION_TIMEOUT_MS = 5_000;

// Mirrors lib/utils.ts. Inlined as source so the sandbox has zero imports.
// Keep in sync if the host helpers change.
const HELPER_SOURCE = `
const __SEASON_TO_SHORT = { Winter: "W", Spring: "P", Summer: "S", Fall: "F" };
const __SEASON_ORDER = { Winter: 0, Spring: 1, Summer: 2, Fall: 3 };
globalThis.batchToShort = function batchToShort(batch) {
  if (batch === "Unspecified") return "—";
  const parts = String(batch).split(" ");
  const season = parts[0], year = parts[1];
  const code = __SEASON_TO_SHORT[season];
  if (!code || !/^\\d{4}$/.test(year || "")) return batch;
  return code + year.slice(2);
};
globalThis.batchToSortKey = function batchToSortKey(batch) {
  if (batch === "Unspecified") return Infinity;
  const parts = String(batch).split(" ");
  const season = parts[0], year = parts[1];
  const order = __SEASON_ORDER[season];
  if (order === undefined || !/^\\d{4}$/.test(year || "")) return Infinity;
  return Number(year) * 10 + order;
};
`;

export interface SandboxResult {
  value: unknown;
}

let cachedSeedKey: string | null = null;
let cachedSeedProgram: string | null = null;

function buildSeedProgram(companies: Company[]): string {
  const first = companies[0]?.id ?? -1;
  const last = companies[companies.length - 1]?.id ?? -1;
  const key = `${companies.length}|${first}|${last}`;
  if (cachedSeedKey === key && cachedSeedProgram !== null) {
    return cachedSeedProgram;
  }
  const seedJson = JSON.stringify(companies).replace(/</g, "\\u003c");
  const program = `${HELPER_SOURCE}\nglobalThis.companies = Object.freeze(JSON.parse(${JSON.stringify(seedJson)}));`;
  cachedSeedKey = key;
  cachedSeedProgram = program;
  return program;
}

export async function runInSandbox(
  expression: string,
  companies: Company[],
): Promise<SandboxResult> {
  const QuickJS = await getQuickJS();
  const runtime = QuickJS.newRuntime();
  runtime.setMemoryLimit(MEMORY_LIMIT_BYTES);
  runtime.setInterruptHandler(
    shouldInterruptAfterDeadline(Date.now() + EXECUTION_TIMEOUT_MS),
  );
  const ctx = runtime.newContext();
  try {
    const seed = ctx.evalCode(buildSeedProgram(companies));
    if (seed.error) {
      const msg = ctx.dump(seed.error);
      seed.error.dispose();
      throw new Error(`failed to seed sandbox: ${formatError(msg)}`);
    }
    seed.value.dispose();

    // The model writes the snippet in several shapes and the old
    // `/\breturn\b/` heuristic misclassified most of them:
    //   1. a single expression           `companies.filter(...).length`
    //   2. expr with a nested return      `companies.filter(c => { return x; })`
    //   3. statements + trailing expr     `const re = …; companies.filter(re)`
    //   4. statements + top-level return  `const x = …; return x;`
    // Evaluate via the program's *completion value* (what `eval` yields:
    // the value of the last expression statement). That covers 1–3,
    // including nested returns, and ignores leading declarations. Only a
    // genuine top-level `return` (4) is a SyntaxError inside `eval`; for
    // that we fall back to a function wrap. Runtime errors from the
    // completion eval are surfaced as-is, never masked by the fallback.
    const completionWrap = `JSON.stringify((0, eval)(${JSON.stringify(expression)}));`;
    const fnWrap = `JSON.stringify((function(){ ${expression}\n })());`;
    let result = ctx.evalCode(completionWrap, "ask.js");
    if (result.error) {
      const dumped = ctx.dump(result.error) as { name?: string };
      result.error.dispose();
      const isSyntaxError =
        dumped && typeof dumped === "object" && dumped.name === "SyntaxError";
      if (!isSyntaxError) {
        throw new Error(formatError(dumped));
      }
      result = ctx.evalCode(fnWrap, "ask.js");
      if (result.error) {
        const msg = ctx.dump(result.error);
        result.error.dispose();
        throw new Error(formatError(msg));
      }
    }
    const json = ctx.dump(result.value) as unknown;
    result.value.dispose();
    if (typeof json !== "string") {
      throw new Error("expression did not return a JSON-serializable value");
    }
    let value: unknown;
    try {
      value = JSON.parse(json);
    } catch {
      throw new Error("expression returned non-JSON output");
    }
    return { value };
  } finally {
    ctx.dispose();
    runtime.dispose();
  }
}

function formatError(dumped: unknown): string {
  if (dumped && typeof dumped === "object") {
    const obj = dumped as { name?: string; message?: string };
    if (obj.message === "interrupted")
      return `execution timed out after ${EXECUTION_TIMEOUT_MS}ms`;
    return `${obj.name ?? "Error"}: ${obj.message ?? String(dumped)}`;
  }
  return String(dumped);
}
