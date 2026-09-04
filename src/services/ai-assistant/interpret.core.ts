import { resolveMerchant, type MerchantSource } from "./merchant-registry";
import {
  InterpretError,
  interpretResponseSchema,
  type InterpretResponse,
  type ModelOutput,
  type Resolution,
} from "./schemas";

import type { ModelProvider } from "./providers/types";

/**
 * The whole endpoint, as a pure function over injected dependencies.
 *
 * Keeping it host-agnostic means the TanStack server route is a thin wrapper,
 * the same code can run inside a Firebase Function if hosting ever changes, and
 * it is directly callable from a test or a script with no HTTP involved.
 */

export interface InterpretDeps {
  provider: ModelProvider;
  merchantSource: MerchantSource;
}

export const interpretPayment = async (
  message: string,
  deps: InterpretDeps,
): Promise<InterpretResponse> => {
  const startedAt = Date.now();

  const raw = await deps.provider.interpret(message);
  const { resolution, considered } = await resolveMerchant(raw.merchantQuery, deps.merchantSource);

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
      // For anything other than a clean resolution the sentence shown to the
      // user is written here, in code. A model sentence claiming a merchant was
      // found while resolution says otherwise would be the worst kind of bug.
      explanation:
        resolution.status === "resolved" ? raw.explanation : blockedExplanation(raw, resolution),
    },
    resolution,
    meta: {
      source: deps.provider.kind,
      merchantSource: deps.merchantSource.kind,
      merchantsConsidered: considered,
      elapsedMs: Date.now() - startedAt,
    },
  };

  // Parsing on the way out is the last guard on the wire contract: zod strips
  // any key the schema does not declare, so a stray address on a merchant object
  // cannot reach the browser even if one were introduced upstream.
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
  resolution: Resolution,
): ModelOutput["missingInformation"] => {
  const missing: ModelOutput["missingInformation"] = [];
  if (resolution.status !== "resolved") missing.push("merchant");
  if (raw.amount === null) missing.push("amount");
  return missing;
};

const blockedExplanation = (raw: ModelOutput, resolution: Resolution): string => {
  const named = raw.merchantQuery.trim();

  if (resolution.status === "ambiguous") {
    return named
      ? `Several registered merchants match "${named}". Choose which one you mean.`
      : "Several registered merchants match that name. Choose which one you mean.";
  }

  if (!named) {
    return "I could not tell which merchant you meant. Name the merchant, or scan their QR.";
  }

  return `No active merchant registered on Sui matches "${named}", so this payment is blocked. Scan the merchant's QR instead.`;
};
