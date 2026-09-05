import {
  formatMyr,
  matchOpenRequests,
  resolveMerchantQuery,
  type MatchableMerchant,
  type MerchantResolution,
} from "./matching.ts";
import {
  InterpretError,
  interpretResponseSchema,
  type InterpretResponse,
  type ModelOutput,
  type NextStep,
  type PaymentRequestSummary,
  type RequestMatch,
} from "./schemas.ts";

import type { ModelProvider } from "./providers/types.ts";

/**
 * The whole endpoint, as a pure function over injected dependencies.
 *
 * Keeping it host-agnostic means the TanStack server route is a thin wrapper,
 * the same code could run inside a Firebase Function if hosting ever changes,
 * and it is directly callable from a test with no HTTP and no chain involved.
 *
 * Order of operations, and why it is fixed:
 *   1. the model reads the sentence — the only non-deterministic step
 *   2. the merchant query is resolved against on-chain credentials, in code
 *   3. only for a resolved merchant, that merchant's open on-chain requests
 *      are read and matched by amount
 *   4. status, missing information, confidence and every sentence the user
 *      acts on are computed from steps 2 and 3, never taken from step 1
 */

export interface InterpretDeps {
  provider: ModelProvider;
  listMerchants: (options: { refresh?: boolean }) => Promise<readonly MatchableMerchant[]>;
  listOpenRequests: (
    merchantObjectId: string,
    options: { knownIntentIds?: readonly string[]; refresh?: boolean },
  ) => Promise<{ open: PaymentRequestSummary[]; considered: number }>;
}

export interface InterpretInput {
  message: string;
  knownIntentIds?: readonly string[] | undefined;
  refresh?: boolean | undefined;
}

export const interpretPayment = async (
  input: InterpretInput,
  deps: InterpretDeps,
): Promise<InterpretResponse> => {
  const startedAt = Date.now();
  const refresh = input.refresh === true;

  const raw = await deps.provider.interpret(input.message);

  const merchants = await deps.listMerchants({ refresh });
  const resolution = resolveMerchantQuery(raw.merchantQuery, merchants);

  let requests: RequestMatch = { status: "skipped", open: [] };
  let requestsConsidered = 0;
  if (resolution.status === "resolved" && resolution.merchant) {
    const listed = await deps.listOpenRequests(resolution.merchant.objectId, {
      ...(input.knownIntentIds ? { knownIntentIds: input.knownIntentIds } : {}),
      refresh,
    });
    requestsConsidered = listed.considered;
    requests = matchOpenRequests(raw.amount, raw.displayCurrency, listed.open);
  }

  const response = {
    ok: true as const,
    interpretation: {
      ...raw,
      // Recomputed, never taken from the model. The model does not get to say a
      // merchant was found, and it does not get to say nothing is missing.
      missingInformation: missingFor(raw, resolution),
      // The model's own confidence is a wording hint. The on-chain lookup is the
      // fact, so an unresolved merchant is capped well below anything the UI
      // would present as certain.
      confidence: resolution.status === "resolved" ? raw.confidence : Math.min(raw.confidence, 0.5),
    },
    resolution: {
      status: resolution.status,
      matchKind: resolution.matchKind,
      ...(resolution.merchant ? { merchant: resolution.merchant } : {}),
      candidates: resolution.candidates,
    },
    requests,
    nextStep: nextStepFor(raw, resolution, requests),
    meta: {
      source: deps.provider.kind,
      vendor: deps.provider.vendor,
      model: deps.provider.model,
      merchantsConsidered: merchants.filter((m) => m.verified && m.active).length,
      requestsConsidered,
      // Clamped: a clock step backwards mid-request (seen on WSL2) must not
      // turn a good answer into a validation failure.
      elapsedMs: Math.max(0, Date.now() - startedAt),
    },
  };

  // Parsing on the way out is the last guard on the wire contract: zod strips
  // any key the schema does not declare, so a stray address on a merchant or
  // request object cannot reach the browser even if one were introduced
  // upstream by mistake.
  const validated = interpretResponseSchema.safeParse(response);
  if (!validated.success) {
    throw new InterpretError(
      "AI_INVALID_OUTPUT",
      "Built a response that failed its own validation.",
      validated.error,
    );
  }
  return validated.data;
};

const missingFor = (
  raw: ModelOutput,
  resolution: MerchantResolution,
): ModelOutput["missingInformation"] => {
  const missing: ModelOutput["missingInformation"] = [];
  if (resolution.status !== "resolved") missing.push("merchant");
  if (raw.amount === null) missing.push("amount");
  return missing;
};

const looksLikeAddress = (value: string): boolean => /0x[0-9a-f]{6,}/i.test(value);

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? "" : "s"}`;

/** "for Mee goreng mamak (KOPI-004)", or an empty string when the request carries neither. */
const describe = (request: PaymentRequestSummary): string => {
  const parts: string[] = [];
  if (request.description) parts.push(`for ${request.description}`);
  if (request.orderReference) parts.push(`(${request.orderReference})`);
  return parts.length ? ` ${parts.join(" ")}` : "";
};

/**
 * Every sentence the user acts on is written here, in code that has seen the
 * on-chain facts. A model sentence claiming a merchant was found while
 * resolution says otherwise would be the worst kind of bug.
 */
export const nextStepFor = (
  raw: ModelOutput,
  resolution: MerchantResolution,
  requests: RequestMatch,
): NextStep => {
  const named = raw.merchantQuery.trim();

  if (resolution.status === "ambiguous") {
    const names = resolution.candidates.map((candidate) => candidate.name);
    if (resolution.matchKind === "fuzzy") {
      return {
        kind: "choose-merchant",
        headline:
          names.length === 1
            ? `No merchant is registered as "${named}". Did you mean ${names[0]}?`
            : `No merchant is registered as "${named}". Did you mean one of: ${names.join(", ")}?`,
        question: "Confirm the merchant you meant.",
      };
    }
    return {
      kind: "choose-merchant",
      headline: named
        ? `Several registered merchants match "${named}": ${names.join(", ")}.`
        : `Several registered merchants match that description: ${names.join(", ")}.`,
      question: "Which merchant did you mean?",
    };
  }

  if (resolution.status === "not-found" || !resolution.merchant) {
    if (looksLikeAddress(named) || looksLikeAddress(raw.explanation)) {
      return {
        kind: "blocked",
        headline:
          "That looks like a wallet address. SuiSure only pays merchants registered on Sui, never a raw address, so this is blocked.",
        question: "Name the merchant, or scan their QR.",
      };
    }
    if (!named) {
      return {
        kind: "blocked",
        headline: "I could not tell which merchant you meant.",
        question: "Name the merchant, or scan their QR.",
      };
    }
    return {
      kind: "blocked",
      headline: `No active merchant registered on Sui matches "${named}", so this payment is blocked.`,
      question: "Check the name, or scan the merchant's QR instead.",
    };
  }

  const merchant = resolution.merchant;
  const openCount = requests.open.length;

  if (requests.status === "matched" && requests.match) {
    return {
      kind: "review",
      headline: `Pay ${formatMyr(requests.match.amountMyr)} to ${merchant.name}${describe(requests.match)}. The amount and the payout address come from the merchant's on-chain request, which you review before signing.`,
      question: null,
    };
  }

  if (openCount === 0) {
    return {
      kind: "no-request",
      headline: `${merchant.name} is registered on Sui but has no open payment request right now. Ask the merchant to create one and scan its QR.`,
      question: null,
    };
  }

  if (raw.amount === null) {
    return {
      kind: "choose-request",
      headline: `${merchant.name} is registered on Sui and has ${plural(openCount, "open request")}.`,
      question: "Which one were you asked to pay?",
    };
  }

  if (raw.displayCurrency !== "MYR") {
    return {
      kind: "choose-request",
      headline: `${merchant.name} is registered on Sui. Its requests are priced in ringgit and settle in Testnet USDC, so I cannot match a ${raw.displayCurrency} amount.`,
      question: "Pick the request you were given.",
    };
  }

  if (requests.status === "choose") {
    return {
      kind: "choose-request",
      headline: `${merchant.name} has more than one open request for ${formatMyr(raw.amount)}.`,
      question: "Pick the one you were given.",
    };
  }

  return {
    kind: "choose-request",
    headline: `${merchant.name} is registered on Sui, but has no open request for ${formatMyr(raw.amount)}. The assistant cannot create one — only the merchant can.`,
    question: "Pick one of its open requests, or ask the merchant for a new QR.",
  };
};
