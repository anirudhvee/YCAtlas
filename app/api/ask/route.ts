import OpenAI from "openai";
import { NextResponse } from "next/server";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionMessageToolCall,
} from "openai/resources/chat/completions";
import { loadCompanies } from "@/lib/data";
import {
  defaultFilters,
  filterCompanies,
  isFilteringActive,
  VIEW_IDS,
  type FilterState,
  type ViewId,
} from "@/lib/store";
import { buildSystemContext } from "@/lib/ask-context";
import { runInSandbox } from "@/lib/ask-sandbox";

const REQUEST_TIMEOUT_MS = 45_000;
const RATE_LIMIT_PER_MINUTE = 12;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_ITERATIONS = 4;
const MAX_HISTORY_TURNS = 5;

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function getClientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "anonymous";
}

function isAllowedOrigin(originOrReferer: string | null): boolean {
  if (!originOrReferer) return false;
  let host: string;
  try {
    host = new URL(originOrReferer).host;
  } catch {
    return false;
  }
  if (
    host === "localhost" ||
    host.startsWith("localhost:") ||
    host === "127.0.0.1" ||
    host.startsWith("127.0.0.1:") ||
    host.endsWith(".local")
  ) {
    return true;
  }
  if (host.endsWith(".vercel.app")) return true;
  const explicit = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL;
  if (explicit) {
    try {
      const allowedHost = new URL(
        explicit.startsWith("http") ? explicit : `https://${explicit}`,
      ).host;
      if (host === allowedHost) return true;
    } catch {
      // ignore malformed env URL
    }
  }
  return false;
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_PER_MINUTE) return false;
  bucket.count += 1;
  return true;
}

const applyToDashboardParameters = {
  type: "object",
  additionalProperties: false,
  required: [
    "view",
    "status",
    "batches",
    "industries",
    "tags",
    "regions",
    "cities",
    "stage",
    "top_company",
    "hasFormerNames",
    "teamSizeMin",
    "teamSizeMax",
    "search",
    "narration",
  ],
  properties: {
    view: { type: "string", enum: [...VIEW_IDS] },
    status: {
      type: "array",
      items: { type: "string", enum: ["Active", "Inactive", "Acquired", "Public"] },
    },
    batches: { type: "array", items: { type: "string" } },
    industries: { type: "array", items: { type: "string" } },
    tags: { type: "array", items: { type: "string" } },
    regions: { type: "array", items: { type: "string" } },
    cities: { type: "array", items: { type: "string" } },
    stage: { type: "array", items: { type: "string" } },
    top_company: { type: ["boolean", "null"] },
    hasFormerNames: { type: ["boolean", "null"] },
    teamSizeMin: { type: ["integer", "null"] },
    teamSizeMax: { type: ["integer", "null"] },
    search: { type: ["string", "null"] },
    narration: { type: "string" },
  },
} as const;

const runQueryParameters = {
  type: "object",
  additionalProperties: false,
  required: ["expression"],
  properties: {
    expression: { type: "string" },
  },
} as const;

const declineParameters = {
  type: "object",
  additionalProperties: false,
  required: ["message"],
  properties: {
    message: {
      type: "string",
      description: "Polite ~1-sentence reason this query is out of scope.",
    },
  },
} as const;

const TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "apply_to_dashboard",
      description:
        "Set filter state and optionally switch the view. Use when the user wants to *see* something on the dashboard. Pure structured action — emit no prose alongside it.",
      parameters: applyToDashboardParameters,
    },
  },
  {
    type: "function",
    function: {
      name: "run_query",
      description:
        "Run a JavaScript expression in a sandbox over the `companies` array. Use to compute facts the dashboard does not show directly.",
      parameters: runQueryParameters,
    },
  },
  {
    type: "function",
    function: {
      name: "decline",
      description:
        "Last-resort tool. Use only when the message is unrelated to YC companies / this dashboard, OR when it has no recoverable meaning at all (random characters, blank fragments). Recoverable shorthand and typos in the context of prior turns are NOT decline cases — answer those by inferring the intent from context. Pass a polite one-sentence message.",
      parameters: declineParameters,
    },
  },
];

interface ApplyToDashboardArgs {
  view: string;
  status: string[];
  batches: string[];
  industries: string[];
  tags: string[];
  regions: string[];
  cities: string[];
  stage: string[];
  top_company: boolean | null;
  hasFormerNames: boolean | null;
  teamSizeMin: number | null;
  teamSizeMax: number | null;
  search: string | null;
  narration: string;
}

function isViewId(v: unknown): v is ViewId {
  return typeof v === "string" && (VIEW_IDS as readonly string[]).includes(v);
}

function coerceFilter(args: ApplyToDashboardArgs): {
  view: ViewId | null;
  filter: FilterState;
  narration: string | null;
} {
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  // Grok sometimes hallucinates `false` or `0` instead of `null` for
  // optional filter fields. `top_company: false` would filter to NON-top
  // companies (rarely desired); `teamSizeMax: 0` would filter out
  // everything. Treat only the meaningful values as filter intent.
  const onlyTrue = (v: unknown): boolean | null => (v === true ? true : null);
  const positiveOrNull = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
  const strOrNull = (v: unknown): string | null =>
    typeof v === "string" && v.trim().length > 0 ? v : null;

  return {
    view: isViewId(args.view) ? args.view : null,
    filter: {
      ...defaultFilters,
      status: arr(args.status),
      batches: arr(args.batches),
      industries: arr(args.industries),
      tags: arr(args.tags),
      regions: arr(args.regions),
      cities: arr(args.cities),
      stage: arr(args.stage),
      top_company: onlyTrue(args.top_company),
      hasFormerNames: onlyTrue(args.hasFormerNames),
      teamSizeMin: positiveOrNull(args.teamSizeMin),
      teamSizeMax: positiveOrNull(args.teamSizeMax),
      search: strOrNull(args.search),
    },
    narration:
      typeof args.narration === "string" && args.narration.trim().length > 0
        ? args.narration.trim()
        : null,
  };
}

interface ClientHistoryTurn {
  user?: unknown;
  assistant?: unknown;
}

function sanitizeHistory(raw: unknown): { user: string; assistant?: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { user: string; assistant?: string }[] = [];
  for (const t of raw as ClientHistoryTurn[]) {
    if (!t || typeof t !== "object") continue;
    const user = typeof t.user === "string" ? t.user.trim() : "";
    if (!user) continue;
    const assistant =
      typeof t.assistant === "string" && t.assistant.trim().length > 0
        ? t.assistant.trim()
        : undefined;
    out.push({ user, assistant });
  }
  return out.slice(-MAX_HISTORY_TURNS);
}

interface AssemblingToolCall {
  id: string;
  name: string;
  arguments: string;
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin") ?? req.headers.get("referer");
  if (!isAllowedOrigin(origin)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing XAI_API_KEY. Add it to the hosting env vars and redeploy." },
      { status: 500 },
    );
  }
  const clientKey = getClientKey(req);
  if (!checkRateLimit(clientKey)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a minute." },
      { status: 429 },
    );
  }

  let body: { query?: unknown; history?: unknown; sessionId?: unknown };
  try {
    body = (await req.json()) as {
      query?: unknown;
      history?: unknown;
      sessionId?: unknown;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) {
    return NextResponse.json({ error: "Missing 'query' string." }, { status: 400 });
  }
  const sessionId =
    typeof body.sessionId === "string" &&
    /^[A-Za-z0-9_-]{8,128}$/.test(body.sessionId)
      ? body.sessionId
      : null;
  if (query.length > 500) {
    return NextResponse.json(
      { error: "Query is too long (max 500 chars)." },
      { status: 400 },
    );
  }
  const history = sanitizeHistory(body.history);

  let context;
  let companies;
  try {
    [context, companies] = await Promise.all([
      buildSystemContext(),
      loadCompanies(),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to load company data: ${msg}` },
      { status: 502 },
    );
  }

  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.x.ai/v1",
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: 1,
  });

  const baseMessages: ChatCompletionMessageParam[] = [
    { role: "system", content: context.prompt },
  ];
  for (const turn of history) {
    baseMessages.push({ role: "user", content: turn.user });
    if (turn.assistant) {
      baseMessages.push({ role: "assistant", content: turn.assistant });
    }
  }
  baseMessages.push({ role: "user", content: query });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      };

      const messages = [...baseMessages];
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          send({ type: "done" });
          controller.close();
        } catch {
          // already closed
        }
      };

      try {
        for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
          const completion = await client.chat.completions.create(
            {
              model: "grok-4-1-fast-reasoning",
              messages,
              tools: TOOLS,
              tool_choice: iter === 0 ? "required" : "auto",
              stream: true,
              stream_options: { include_usage: true },
            },
            sessionId
              ? { headers: { "x-grok-conv-id": sessionId } }
              : undefined,
          );

          const calls = new Map<number, AssemblingToolCall>();
          let assistantContent = "";
          let contentBuffer = "";
          const phase: {
            value: "buffering" | "committed" | "suppressed";
          } = { value: "buffering" };

          const looksLikeLeak = (s: string): boolean => {
            const head = s.replace(/^\s+/, "");
            return (
              /^<function/i.test(head) ||
              /^(call|invoke|using|please run|let me run|let me call)\s+(apply_to_dashboard|run_query|decline)/i.test(
                head,
              ) ||
              /^(apply_to_dashboard|run_query|decline)\s*\(/i.test(head) ||
              /^tool[\s_]?call\s*[:=]/i.test(head) ||
              /^\{\s*"(name|tool|function|view|status|batches|industries|tags|regions|stage|narration|filter|expression|message)"\s*:/i.test(
                head,
              )
            );
          };
          const evaluateBuffer = () => {
            if (phase.value !== "buffering") return;
            const trimmed = contentBuffer.replace(/^\s+/, "");
            if (trimmed.length < 30) return;
            if (looksLikeLeak(contentBuffer)) {
              phase.value = "suppressed";
              contentBuffer = "";
            } else {
              phase.value = "committed";
              assistantContent += contentBuffer;
              send({ type: "thinking", text: contentBuffer });
              contentBuffer = "";
            }
          };

          for await (const chunk of completion) {
            if (chunk.usage) {
              const u = chunk.usage as {
                prompt_tokens?: number;
                completion_tokens?: number;
                total_tokens?: number;
                prompt_tokens_details?: { cached_tokens?: number };
              };
              console.log(
                `[ask] iter=${iter} sessionId=${sessionId ?? "none"} prompt=${
                  u.prompt_tokens ?? 0
                } completion=${u.completion_tokens ?? 0} cached=${
                  u.prompt_tokens_details?.cached_tokens ?? 0
                } total=${u.total_tokens ?? 0}`,
              );
            }
            const choice = chunk.choices?.[0];
            if (!choice) continue;
            const delta = choice.delta as
              | (typeof choice.delta & { reasoning_content?: string })
              | undefined;
            if (delta?.reasoning_content) {
              send({ type: "reasoning", text: delta.reasoning_content });
            }
            if (delta?.content) {
              if (phase.value === "committed") {
                assistantContent += delta.content;
                send({ type: "thinking", text: delta.content });
              } else if (phase.value === "buffering") {
                contentBuffer += delta.content;
                evaluateBuffer();
              }
            }
            if (delta?.tool_calls) {
              for (const piece of delta.tool_calls) {
                const idx = piece.index;
                let acc = calls.get(idx);
                if (!acc) {
                  acc = { id: piece.id ?? "", name: "", arguments: "" };
                  calls.set(idx, acc);
                }
                if (piece.id) acc.id = piece.id;
                if (piece.function?.name) acc.name = piece.function.name;
                if (piece.function?.arguments) {
                  acc.arguments += piece.function.arguments;
                }
              }
            }
          }

          if (phase.value === "buffering" && contentBuffer.length > 0) {
            if (looksLikeLeak(contentBuffer)) {
              phase.value = "suppressed";
            } else {
              phase.value = "committed";
              assistantContent += contentBuffer;
              send({ type: "thinking", text: contentBuffer });
            }
            contentBuffer = "";
          }

          const toolCalls = [...calls.values()].filter((c) => c.name);

          if (toolCalls.length === 0) {
            if (phase.value === "suppressed") {
              send({
                type: "final",
                answer:
                  "I had trouble routing that — try rephrasing or being more specific.",
              });
            } else if (assistantContent.trim().length === 0) {
              send({ type: "final", answer: "I couldn't produce an answer." });
            }
            close();
            return;
          }

          // Check for apply_to_dashboard short-circuit.
          const apply = toolCalls.find(
            (c) => c.name === "apply_to_dashboard",
          );
          if (apply) {
            let parsed: ApplyToDashboardArgs | null = null;
            try {
              parsed = JSON.parse(apply.arguments) as ApplyToDashboardArgs;
            } catch {
              send({
                type: "error",
                message: "apply_to_dashboard returned malformed JSON.",
              });
              close();
              return;
            }
            const { view, filter, narration } = coerceFilter(parsed);
            // A 0-match filter almost always means a made-up value; feed it
            // back rather than steering the dashboard to a blank view.
            const matched = isFilteringActive(filter)
              ? filterCompanies(companies, filter).length
              : companies.length;
            if (matched > 0) {
              send({
                type: "filter",
                view,
                filter,
                narration,
              });
              close();
              return;
            }
            // 0 matches: fall through to feed the note back via the tool loop.
          }

          // Check for decline short-circuit.
          const decline = toolCalls.find((c) => c.name === "decline");
          if (decline) {
            let message = "I can only answer questions about YC Atlas.";
            try {
              const parsed = JSON.parse(decline.arguments) as {
                message?: unknown;
              };
              if (
                typeof parsed.message === "string" &&
                parsed.message.trim().length > 0
              ) {
                message = parsed.message.trim();
              }
            } catch {
              // fall through to default message
            }
            // If the decline message was already streamed via assistantContent,
            // the user has already seen it — don't double-render via a final.
            const streamed = assistantContent.trim();
            const sameAsStreamed =
              streamed.length > 0 &&
              (streamed === message ||
                streamed.includes(message) ||
                message.includes(streamed));
            if (!sameAsStreamed) {
              send({ type: "final", answer: message });
            }
            close();
            return;
          }

          // Otherwise execute every run_query call.
          const apiToolCalls: ChatCompletionMessageToolCall[] = toolCalls.map(
            (c) => ({
              id: c.id,
              type: "function",
              function: { name: c.name, arguments: c.arguments },
            }),
          );
          messages.push({
            role: "assistant",
            content: assistantContent || null,
            tool_calls: apiToolCalls,
          });

          for (const call of toolCalls) {
            if (call.name === "apply_to_dashboard") {
              // Only reached for a 0-match apply; nudge the model to fix it.
              messages.push({
                role: "tool",
                tool_call_id: call.id,
                content: JSON.stringify({
                  applied: false,
                  matched: 0,
                  note: "This filter matches 0 companies, so it was NOT applied. The value is most likely not in the dataset — verify it against INDUSTRIES / TOP TAGS / REGIONS / CITIES / STAGES. Either re-call apply_to_dashboard with a real, related value that has results, or reply in one short sentence that no YC companies match. Never apply a zero-result filter.",
                }),
              });
              continue;
            }
            if (call.name !== "run_query") {
              const errMsg = `Unknown tool: ${call.name}`;
              send({
                type: "tool_call",
                id: call.id,
                tool: call.name,
                args: { error: errMsg },
              });
              send({ type: "tool_result", id: call.id, error: errMsg });
              messages.push({
                role: "tool",
                tool_call_id: call.id,
                content: JSON.stringify({ error: errMsg }),
              });
              continue;
            }

            let parsed: { expression?: unknown };
            try {
              parsed = JSON.parse(call.arguments) as { expression?: unknown };
            } catch {
              const errMsg = "Malformed JSON arguments.";
              send({
                type: "tool_call",
                id: call.id,
                tool: call.name,
                args: { error: errMsg },
              });
              send({ type: "tool_result", id: call.id, error: errMsg });
              messages.push({
                role: "tool",
                tool_call_id: call.id,
                content: JSON.stringify({ error: errMsg }),
              });
              continue;
            }
            const expression =
              typeof parsed.expression === "string" ? parsed.expression : "";
            send({
              type: "tool_call",
              id: call.id,
              tool: call.name,
              args: { expression },
            });

            if (!expression) {
              send({
                type: "tool_result",
                id: call.id,
                error: "Missing expression.",
              });
              messages.push({
                role: "tool",
                tool_call_id: call.id,
                content: JSON.stringify({ error: "Missing expression." }),
              });
              continue;
            }
            try {
              const { value } = await runInSandbox(expression, companies);
              let serialized = JSON.stringify({ value });
              if (serialized.length > 8_000) {
                const ARRAY_HEAD = 50;
                const wasArrayCut =
                  Array.isArray(value) && value.length > ARRAY_HEAD;
                const trimmed = Array.isArray(value)
                  ? value.slice(0, ARRAY_HEAD)
                  : value;
                const note = wasArrayCut
                  ? `result was ${value.length} items; showing first ${ARRAY_HEAD}. Aggregate (.length, sum, group) or .slice() next.`
                  : "result was too large to return in full. Aggregate or pick a subset next.";
                const candidate = JSON.stringify({
                  value: trimmed,
                  truncated: note,
                });
                serialized =
                  candidate.length <= 8_000
                    ? candidate
                    : JSON.stringify({
                        value: null,
                        truncated: `result too large to serialize (${
                          Array.isArray(value)
                            ? `${value.length} items`
                            : "non-array"
                        }); aggregate first.`,
                      });
              }
              send({ type: "tool_result", id: call.id, value });
              messages.push({
                role: "tool",
                tool_call_id: call.id,
                content: serialized,
              });
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              send({ type: "tool_result", id: call.id, error: msg });
              messages.push({
                role: "tool",
                tool_call_id: call.id,
                content: JSON.stringify({ error: msg }),
              });
            }
          }
        }

        send({
          type: "final",
          answer: "I ran several queries but couldn't compose a final answer.",
          truncated: true,
        });
        close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send({ type: "error", message: `Grok request failed: ${msg}` });
        close();
      }
    },
    cancel() {
      // best-effort: nothing to abort beyond letting the loop exit
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
