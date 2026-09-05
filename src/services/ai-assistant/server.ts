import { interpretPayment } from "./interpret.core.ts";
import { clearMerchantCache, listRegisteredMerchants } from "./merchant-registry.ts";
import { createGeminiProvider, DEFAULT_GEMINI_MODEL } from "./providers/gemini.ts";
import { heuristicProvider } from "./providers/heuristic.ts";
import { clearRequestCache, listOpenRequests } from "./request-registry.ts";
import { InterpretError, interpretRequestSchema } from "./schemas.ts";

import type { ModelProvider } from "./providers/types.ts";

/**
 * Server-side wiring for the AI assistant: environment resolution, abuse
 * controls, and the request handlers.
 *
 * SERVER ONLY. Nothing in `src/routes/*.tsx` or `src/components/**` may import
 * this file — it reads `process.env` and holds the model API key. The browser
 * talks to it over HTTP through `ai.service.ts`, never by import. The route
 * files `src/routes/api.*.ts` are the only importers.
 */

const env = (key: string): string | undefined => {
  const value = process.env[key];
  return value && value.trim() ? value.trim() : undefined;
};

/**
 * Picks the model provider.
 *
 * An explicit `AI_PROVIDER=heuristic` wins; otherwise Gemini when a key is
 * present; otherwise the offline heuristic. A missing key degrades to a working
 * demo rather than a 500, and /api/health always says which one ran.
 */
export const providerFromEnv = (): ModelProvider => {
  if (env("AI_PROVIDER")?.toLowerCase() === "heuristic") return heuristicProvider;

  const apiKey = env("GEMINI_API_KEY");
  if (!apiKey) return heuristicProvider;

  const timeoutMs = Number(env("AI_TIMEOUT_MS"));
  const model = env("GEMINI_MODEL");
  return createGeminiProvider({
    apiKey,
    ...(model ? { model } : {}),
    ...(Number.isFinite(timeoutMs) && timeoutMs > 0 ? { timeoutMs } : {}),
  });
};

/* -------------------------------------------------------------------------- */
/* Abuse controls                                                             */
/* -------------------------------------------------------------------------- */

const WINDOW_MS = 60_000;
const DEFAULT_PER_CLIENT = 10;
const DEFAULT_GLOBAL = 120;
const GLOBAL_KEY = " global";
const hits = new Map<string, { count: number; resetAt: number }>();

const limitFromEnv = (key: string, fallback: number): number => {
  const configured = Number(env(key));
  return Number.isFinite(configured) && configured > 0 ? configured : fallback;
};

const bump = (key: string, limit: number, now: number): boolean => {
  const entry = hits.get(key);
  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
};

/**
 * Two ceilings per minute: one per client address, one for the whole instance
 * so a crowd of distinct addresses still cannot drain the model quota.
 *
 * In-memory, per instance, resets on restart. Good enough to stop a demo
 * audience burning the budget; not production rate limiting, and the docs say
 * so rather than implying otherwise.
 */
export const rateLimit = (clientKey: string, now = Date.now()): void => {
  if (hits.size > 5_000) {
    for (const [key, entry] of hits) if (now > entry.resetAt) hits.delete(key);
  }
  const perClient = bump(
    clientKey,
    limitFromEnv("AI_RATE_LIMIT_PER_MINUTE", DEFAULT_PER_CLIENT),
    now,
  );
  const global = bump(
    GLOBAL_KEY,
    limitFromEnv("AI_RATE_LIMIT_GLOBAL_PER_MINUTE", DEFAULT_GLOBAL),
    now,
  );
  if (!perClient || !global) {
    throw new InterpretError("RATE_LIMITED", "Too many requests. Wait a minute and try again.");
  }
};

export const resetRateLimit = (): void => {
  hits.clear();
};

const clientKey = (request: Request): string =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  request.headers.get("x-real-ip")?.trim() ||
  "anonymous";

const hostOf = (value: string | null): string | null => {
  if (!value) return null;
  const first = value.split(",")[0]?.trim() ?? "";
  try {
    return new URL(first.includes("://") ? first : `http://${first}`).host.toLowerCase();
  } catch {
    return null;
  }
};

/**
 * Browsers send an `Origin` header on every POST, including same-origin ones,
 * so "no Origin means same-origin" would be wrong. The rule is: the app's own
 * host is always allowed, anything named in ALLOWED_ORIGINS is allowed, and
 * everything else is refused. Requests without an Origin (curl, server to
 * server) pass here and are governed by the rate limit instead.
 */
export const assertAllowedOrigin = (request: Request): void => {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return;

  const originHost = hostOf(origin);
  const requestHost =
    hostOf(request.headers.get("x-forwarded-host")) ??
    hostOf(request.headers.get("host")) ??
    hostOf(request.url);
  if (originHost && requestHost && originHost === requestHost) return;

  const allowed = (env("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase().replace(/\/$/, ""))
    .filter(Boolean);
  if (allowed.includes(origin.toLowerCase().replace(/\/$/, ""))) return;

  throw new InterpretError("BAD_REQUEST", "Origin not allowed.");
};

/* -------------------------------------------------------------------------- */
/* Handlers                                                                   */
/* -------------------------------------------------------------------------- */

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const MAX_BODY_BYTES = 8_192;

const readJsonBody = async (request: Request): Promise<unknown> => {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_BODY_BYTES) throw new InterpretError("BAD_REQUEST", "Request body too large.");
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    throw new InterpretError("BAD_REQUEST", "Request body too large.");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new InterpretError("BAD_REQUEST", 'Send JSON: { "message": "Pay RM12 to Kopitiam" }.');
  }
};

export const handleInterpretRequest = async (request: Request): Promise<Response> => {
  try {
    assertAllowedOrigin(request);
    rateLimit(clientKey(request));

    const parsed = interpretRequestSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      throw new InterpretError(
        "BAD_REQUEST",
        'Send { "message": string } between 3 and 280 characters.',
      );
    }

    const result = await interpretPayment(parsed.data, {
      provider: providerFromEnv(),
      listMerchants: listRegisteredMerchants,
      listOpenRequests,
    });
    return json(result);
  } catch (error) {
    return errorResponse(error);
  }
};

/**
 * Anything other than POST on the interpret route. Without this the request
 * falls through to SSR and a mistyped method answers with an HTML page and a
 * 200, which is a confusing thing to debug at 2am.
 */
export const handleMethodNotAllowed = (allow: string): Response =>
  new Response(
    JSON.stringify({ ok: false, code: "BAD_REQUEST", message: `Use ${allow} on this endpoint.` }),
    {
      status: 405,
      headers: {
        "content-type": "application/json; charset=utf-8",
        allow,
        "cache-control": "no-store",
      },
    },
  );

/**
 * Deployment probe. Answers the one question that decides whether the AI demo
 * is real: does the host expose the model API key to the server at runtime?
 * Never returns the key or any part of it.
 */
export const handleHealthRequest = async (request: Request): Promise<Response> => {
  const provider = providerFromEnv();

  const body: Record<string, unknown> = {
    ok: true,
    // True only when a real model will run. The demo must never claim AI ran
    // when the offline fallback answered.
    hasKey: provider.kind === "model",
    provider: provider.kind,
    vendor: provider.vendor,
    model: provider.model,
    defaultModel: DEFAULT_GEMINI_MODEL,
    merchantSource: "chain",
  };

  // ?probe=chain does a real read against Sui. Kept opt-in so an uptime check
  // does not hammer the RPC.
  if (new URL(request.url).searchParams.get("probe") === "chain") {
    try {
      clearMerchantCache();
      clearRequestCache();
      const merchants = await listRegisteredMerchants({ refresh: true });
      const requests = await Promise.all(
        merchants.map(async (merchant) => ({
          merchant: merchant.name,
          openRequests: (await listOpenRequests(merchant.objectId, { refresh: true })).open.length,
        })),
      );
      body["chain"] = { ok: true, merchants: merchants.length, requests };
    } catch (error) {
      body["chain"] = {
        ok: false,
        message: error instanceof Error ? error.message : "Unknown chain error.",
      };
    }
  }

  return json(body);
};

const errorResponse = (error: unknown): Response => {
  if (error instanceof InterpretError) {
    if (error.cause !== undefined) console.error(`[interpret-payment] ${error.code}`, error.cause);
    return json(error.toResponseBody(), error.status);
  }

  console.error("[interpret-payment] unhandled", error);
  return json(
    { ok: false, code: "AI_UNAVAILABLE", message: "Unexpected error. Try the QR flow." },
    503,
  );
};
