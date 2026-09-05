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
 *
 * This file has no `@/` imports on purpose: it runs unchanged in the browser,
 * on the server, and under `node --test`.
 */

export const suiObjectIdSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, "Invalid Sui object ID")
  .transform((value) => value.toLowerCase());

/** POST /api/interpret-payment request body. */
export const interpretRequestSchema = z.object({
  message: z.string().trim().min(3).max(280),
  /**
   * Payment request object IDs the browser already knows about — typically
   * requests the merchant created on this same device during a demo. They are
   * read back from Sui and filtered by merchant before use; nothing here is
   * trusted as-is.
   */
  knownIntentIds: z.array(suiObjectIdSchema).max(20).optional(),
  /** Bypasses the server-side merchant cache. */
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
  objectId: suiObjectIdSchema,
  name: z.string().min(1),
  category: z.string(),
  active: z.boolean(),
  logoInitials: z.string().max(4),
});
export type ResolvedMerchant = z.infer<typeof resolvedMerchantSchema>;

export const MATCH_KINDS = ["exact", "partial", "fuzzy", "none"] as const;
export type MatchKind = (typeof MATCH_KINDS)[number];

/**
 * `resolved` — exactly one active registered merchant matched.
 * `ambiguous` — several matched, or the only match needed a spelling
 *   correction; the user picks, never the model.
 * `not-found` — nothing matched, or the only matches are inactive. Blocked.
 */
export const resolutionSchema = z.object({
  status: z.enum(["resolved", "ambiguous", "not-found"]),
  matchKind: z.enum(MATCH_KINDS),
  merchant: resolvedMerchantSchema.optional(),
  candidates: z.array(resolvedMerchantSchema).max(5),
});
export type Resolution = z.infer<typeof resolutionSchema>;

/**
 * An open on-chain payment request, summarised for the review hand-off.
 *
 * Carries the two IDs the QR carries and nothing more sensitive. The review
 * screen re-reads everything from Sui before enabling payment.
 */
export const paymentRequestSummarySchema = z.object({
  paymentIntentId: suiObjectIdSchema,
  merchantObjectId: suiObjectIdSchema,
  amountMyr: z.number().nonnegative(),
  tokenAmount: z.number().nonnegative(),
  tokenType: z.string().min(1),
  description: z.string().max(200),
  orderReference: z.string().max(100),
  expiresAt: z.string().datetime(),
});
export type PaymentRequestSummary = z.infer<typeof paymentRequestSummarySchema>;

/**
 * `matched` — exactly one open request for the resolved merchant carries the
 *   amount the user named. The UI can go straight to review.
 * `choose` — the merchant resolved but the amount is missing, in another
 *   currency, or matches several requests; the user picks from `open`.
 * `none` — the merchant resolved and has no open request for that amount.
 * `skipped` — the merchant did not resolve, so requests were not looked up.
 */
export const requestMatchSchema = z.object({
  status: z.enum(["matched", "choose", "none", "skipped"]),
  match: paymentRequestSummarySchema.optional(),
  open: z.array(paymentRequestSummarySchema).max(40),
});
export type RequestMatch = z.infer<typeof requestMatchSchema>;

export const NEXT_STEP_KINDS = [
  "review",
  "choose-request",
  "no-request",
  "choose-merchant",
  "blocked",
] as const;
export type NextStepKind = (typeof NEXT_STEP_KINDS)[number];

/**
 * What the UI should do next, decided on the server so the wording shown to
 * the user comes from code that has seen the on-chain facts, never from the
 * model alone.
 */
export const nextStepSchema = z.object({
  kind: z.enum(NEXT_STEP_KINDS),
  headline: z.string().min(1).max(400),
  question: z.string().max(200).nullable(),
});
export type NextStep = z.infer<typeof nextStepSchema>;

/** Honest provenance, shown in the UI and read out in the demo. */
export const interpretMetaSchema = z.object({
  /** `model` is a real model call; `heuristic` is the offline regex fallback. */
  source: z.enum(["model", "heuristic"]),
  vendor: z.enum(["google", "none"]),
  model: z.string().nullable(),
  merchantsConsidered: z.number().int().nonnegative(),
  requestsConsidered: z.number().int().nonnegative(),
  elapsedMs: z.number().int().nonnegative(),
});
export type InterpretMeta = z.infer<typeof interpretMetaSchema>;

export const interpretResponseSchema = z.object({
  ok: z.literal(true),
  interpretation: modelOutputSchema,
  resolution: resolutionSchema,
  requests: requestMatchSchema,
  nextStep: nextStepSchema,
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
 *
 * `message` is always safe to show to a user. Internal detail goes in `cause`
 * and is logged server-side only.
 */
export class InterpretError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "InterpretError";
    this.code = code;
  }

  get status(): number {
    return STATUS_BY_CODE[this.code];
  }

  toResponseBody(): ErrorResponse {
    return { ok: false, code: this.code, message: this.message };
  }
}

/** Keys that must never appear in anything this service returns. */
export const FORBIDDEN_RESPONSE_KEYS = [
  "address",
  "payout",
  "payoutAddress",
  "receivingAddress",
  "recipientAddress",
  "recipient",
] as const;

/** Depth-first search for a forbidden key. Returns its path, or null if clean. */
export const findForbiddenKey = (value: unknown, path = "$"): string | null => {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const hit = findForbiddenKey(item, `${path}[${index}]`);
      if (hit) return hit;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if ((FORBIDDEN_RESPONSE_KEYS as readonly string[]).includes(key)) return `${path}.${key}`;
      const hit = findForbiddenKey(item, `${path}.${key}`);
      if (hit) return hit;
    }
  }
  return null;
};
