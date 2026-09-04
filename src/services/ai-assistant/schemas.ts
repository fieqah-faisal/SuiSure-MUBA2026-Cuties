import { z } from "zod";

/**
 * Wire contract for the AI payment assistant.
 *
 * Two rules govern every schema in this file and neither is negotiable:
 *
 * 1. No recipient address appears anywhere in a response. The payout address
 *    lives in the on-chain `MerchantCredential` and is read from there by the
 *    review screen and again by the Move contract. If an address could travel
 *    in an AI response, the product's security claim would be false.
 * 2. Nothing the model says is trusted as fact. The model proposes a merchant
 *    *query string* and an amount; the server resolves that query against
 *    on-chain objects and recomputes anything the UI treats as a status.
 */

/** POST /api/interpret-payment request body. */
export const interpretRequestSchema = z.object({
  message: z.string().trim().min(3).max(280),
  /** Bypasses the merchant cache — used when a merchant is registered live on stage. */
  refresh: z.boolean().optional(),
});
export type InterpretRequest = z.infer<typeof interpretRequestSchema>;

/**
 * Exactly what the model is allowed to produce.
 *
 * There is deliberately no address, no object ID, no coin type and no
 * "verified" flag here. The model cannot know any of them, so it is not given
 * a field to guess into.
 *
 * `displayCurrency` is what the *user typed*, not what the payment settles in.
 * Settlement currency is fixed by the on-chain request's `coin_type` and
 * asserted by the contract.
 */
export const modelOutputSchema = z.object({
  merchantQuery: z.string().trim().max(80),
  amount: z.number().positive().max(10_000).nullable(),
  displayCurrency: z.enum(["MYR", "SUI"]),
  confidence: z.number().min(0).max(1),
  missingInformation: z.array(z.enum(["merchant", "amount"])).max(2),
  explanation: z.string().trim().min(1).max(280),
});
export type ModelOutput = z.infer<typeof modelOutputSchema>;

/** A merchant as the endpoint is allowed to describe it. Note the absent address. */
export const resolvedMerchantSchema = z.object({
  objectId: z.string().min(3),
  name: z.string().min(1),
  category: z.string(),
  active: z.boolean(),
  logoInitials: z.string().max(4),
});
export type ResolvedMerchant = z.infer<typeof resolvedMerchantSchema>;

/**
 * `resolved` — exactly one active registered merchant matched.
 * `ambiguous` — several matched; the user picks, never the model.
 * `not-found` — nothing matched, or the only matches are inactive. Blocked.
 */
export const resolutionSchema = z.object({
  status: z.enum(["resolved", "ambiguous", "not-found"]),
  merchant: resolvedMerchantSchema.optional(),
  candidates: z.array(resolvedMerchantSchema).max(5),
});
export type Resolution = z.infer<typeof resolutionSchema>;

/** Honest provenance, shown in the UI and read out in the demo. */
export const interpretMetaSchema = z.object({
  /** `model` is a real Claude call; `heuristic` is the offline regex fallback. */
  source: z.enum(["model", "heuristic"]),
  /** Where the merchant list came from. `chain` is the one that counts. */
  merchantSource: z.enum(["chain", "mock"]),
  merchantsConsidered: z.number().int().nonnegative(),
  elapsedMs: z.number().int().nonnegative(),
});
export type InterpretMeta = z.infer<typeof interpretMetaSchema>;

export const interpretResponseSchema = z.object({
  ok: z.literal(true),
  interpretation: modelOutputSchema,
  resolution: resolutionSchema,
  meta: interpretMetaSchema,
});
export type InterpretResponse = z.infer<typeof interpretResponseSchema>;

export const ERROR_CODES = [
  "BAD_REQUEST",
  "RATE_LIMITED",
  "AI_TIMEOUT",
  "AI_INVALID_OUTPUT",
  "AI_UNAVAILABLE",
  "CHAIN_UNAVAILABLE",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const errorResponseSchema = z.object({
  ok: z.literal(false),
  code: z.enum(ERROR_CODES),
  message: z.string().min(1),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  RATE_LIMITED: 429,
  AI_TIMEOUT: 504,
  AI_INVALID_OUTPUT: 502,
  AI_UNAVAILABLE: 503,
  CHAIN_UNAVAILABLE: 503,
};

/**
 * The only error type this service throws outwards. Every failure path — bad
 * input, model timeout, unusable model output, dead RPC — arrives at the route
 * handler as one of these, so the client always sees the same JSON shape.
 */
export class InterpretError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "InterpretError";
  }

  get status(): number {
    return STATUS_BY_CODE[this.code];
  }

  toResponseBody(): ErrorResponse {
    return { ok: false, code: this.code, message: this.message };
  }
}
