import { interpretPayment } from "./interpret.core";
import { listMerchants, type MerchantSource } from "./merchant-registry";
import { createAnthropicProvider } from "./providers/anthropic";
import { createGeminiProvider } from "./providers/gemini";
import { heuristicProvider } from "./providers/heuristic";
import { InterpretError, interpretRequestSchema } from "./schemas";

import type { ModelProvider } from "./providers/types";

/**
 * Server-side wiring for the AI assistant: environment resolution, abuse
 * controls, and two request handlers.
 *
 * SERVER ONLY. Nothing in `src/routes/*.tsx` or `src/components/**` may import
 * this file — it reads `process.env` and constructs a client holding the model
 * API key. The browser talks to it over HTTP through `ai.service.ts`, never by
 * import.
 */

const env = (key: string): string | undefined => {
  const value = process.env[key];
  return value && value.trim() ? value.trim() : undefined;
};

export const merchantSourceFromEnv = (): MerchantSource => ({
  // Defaults to mock so a missing variable degrades to a working demo rather
  // than to a broken one. Flip to `chain` in the host's environment.
  kind: env("MERCHANT_SOURCE") === "chain" ? "chain" : "mock",
});

/**
 * Picks the model provider.
 *
 * Order: an explicit AI_PROVIDER wins; otherwise whichever vendor has a key,
 * Gemini first; otherwise the offline heuristic. A missing key degrades to a
 * working demo rather than a 500, and /api/health always says which one ran.
 */
export const providerFromEnv = (): ModelProvider => {
  const forced = env("AI_PROVIDER")?.toLowerCase();
  if (forced === "heuristic") return heuristicProvider;

  const timeoutMs = Number(env("AI_TIMEOUT_MS"));
  const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? { timeoutMs } : {};

  const geminiKey = env("GEMINI_API_KEY");
  if (geminiKey && (forced === "gemini" || !forced)) {
    return createGeminiProvider({
      apiKey: geminiKey,
      ...(env("GEMINI_MODEL") ? { model: env("GEMINI_MODEL")! } : {}),
      ...timeout,
    });
  }

  const anthropicKey = env("ANTHROPIC_API_KEY");
  if (anthropicKey && (forced === "anthropic" || !forced)) {
    return createAnthropicProvider({
      apiKey: anthropicKey,
      ...(env("AI_MODEL") ? { model: env("AI_MODEL")! } : {}),
      ...timeout,
    });
  }

  return heuristicProvider;
};

/* -------------------------------------------------------------------------- */
/* Abuse controls                                                             */
/* -------------------------------------------------------------------------- */

const WINDOW_MS = 60_000;
const DEFAULT_MAX_PER_WINDOW = 10;
const hits = new Map<string, { count: number; resetAt: number }>();

/**
 * Requests per IP per minute. Raise it locally when running the smoke script
 * (`AI_RATE_LIMIT_PER_MINUTE=100 npm run dev`); leave it at the default in
 * anything the public can reach.
 */
const maxPerWindow = (): number => {
  const configured = Number(env("AI_RATE_LIMIT_PER_MINUTE"));
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_PER_WINDOW;
};

/**
 * In-memory, per-instance, resets on restart. Good enough to stop a demo
 * audience draining the model budget; not production rate limiting, and the
 * README says so rather than implying otherwise.
 */
export const rateLimit = (key: string, now = Date.now()): void => {
  for (const [existing, entry] of hits) {
    if (now > entry.resetAt) hits.delete(existing);
  }

  const entry = hits.get(key);
  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  entry.count += 1;
  if (entry.count > maxPerWindow()) {
    throw new InterpretError("RATE_LIMITED", "Too many requests. Wait a minute and try again.");
  }
};

export const resetRateLimit = (): void => {
  hits.clear();
};

const clientKey = (request: Request): string =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
  request.headers.get("x-real-ip")?.trim() ??
  "anonymous";

/**
 * Cross-origin calls are refused unless ALLOWED_ORIGINS names them. Same-origin
 * browser requests send no Origin header, so the app itself is unaffected.
 */
export const assertAllowedOrigin = (request: Request): void => {
  const origin = request.headers.get("origin");
  if (!origin) return;

  const allowed = (env("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (allowed.length === 0 || allowed.includes(origin)) return;
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

export const handleInterpretRequest = async (request: Request): Promise<Response> => {
  try {
    assertAllowedOrigin(request);
    rateLimit(clientKey(request));

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new InterpretError("BAD_REQUEST", 'Send JSON: { "message": "Pay RM12 to Kopitiam" }.');
    }

    const parsed = interpretRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new InterpretError(
        "BAD_REQUEST",
        'Send { "message": string } between 3 and 280 characters.',
      );
    }

    const result = await interpretPayment(parsed.data.message, {
      provider: providerFromEnv(),
      merchantSource: {
        ...merchantSourceFromEnv(),
        ...(parsed.data.refresh ? { refresh: true } : {}),
      },
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
 * Deployment probe. Answers the one question that decides where this endpoint
 * lives: does the host actually expose the model API key to the server at
 * runtime? Never returns the key or any part of it.
 */
export const handleHealthRequest = async (request: Request): Promise<Response> => {
  const provider = providerFromEnv();
  const merchantSource = merchantSourceFromEnv();

  const body: Record<string, unknown> = {
    ok: true,
    // True only when a real model will run. The demo must never claim AI ran
    // when the offline fallback answered.
    hasKey: provider.kind === "model",
    provider: provider.kind,
    vendor: provider.vendor,
    model: provider.model,
    keys: {
      gemini: Boolean(env("GEMINI_API_KEY")),
      anthropic: Boolean(env("ANTHROPIC_API_KEY")),
    },
    merchantSource: merchantSource.kind,
  };

  // ?probe=chain does a real read against Sui. Kept opt-in so an uptime check
  // does not hammer the RPC.
  if (new URL(request.url).searchParams.get("probe") === "chain") {
    try {
      const merchants = await listMerchants({ kind: "chain", refresh: true });
      body["chain"] = { ok: true, merchants: merchants.length };
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
    if (error.cause) console.error(`[interpret-payment] ${error.code}`, error.cause);
    return json(error.toResponseBody(), error.status);
  }

  console.error("[interpret-payment] unhandled", error);
  return json(
    { ok: false, code: "AI_UNAVAILABLE", message: "Unexpected error. Try the QR flow." },
    503,
  );
};
