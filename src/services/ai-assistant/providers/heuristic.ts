import { modelOutputSchema, InterpretError, type ModelOutput } from "../schemas";

import type { ModelProvider } from "./types";

/**
 * Deterministic fallback extractor. No network, no API key, no model.
 *
 * It exists for three reasons: the endpoint stays developable before a key is
 * provisioned, local development costs nothing, and the demo still works if the
 * model API is unreachable from the venue's network. It reports itself honestly
 * as `heuristic` in the response metadata — never claim a model ran when one did
 * not.
 */

const AMOUNT_MYR = /(?:rm|myr)\s*([0-9]+(?:\.[0-9]{1,2})?)/i;
const AMOUNT_SUI = /([0-9]+(?:\.[0-9]+)?)\s*sui\b/i;
const AMOUNT_BARE = /\b([0-9]+(?:\.[0-9]{1,2})?)\b/;

const FILLER =
  /\b(pay|paying|send|sending|transfer|to|for|please|money|payment|the|a|an|of|my|bill|at)\b/gi;

const extractAmount = (message: string): { amount: number | null; currency: "MYR" | "SUI" } => {
  const myr = message.match(AMOUNT_MYR);
  if (myr?.[1]) return { amount: Number(myr[1]), currency: "MYR" };

  const sui = message.match(AMOUNT_SUI);
  if (sui?.[1]) return { amount: Number(sui[1]), currency: "SUI" };

  const bare = message.match(AMOUNT_BARE);
  if (bare?.[1]) return { amount: Number(bare[1]), currency: "MYR" };

  return { amount: null, currency: "MYR" };
};

const extractMerchantQuery = (message: string): string => {
  const afterTo = message.match(/\bto\s+(.+)$/i)?.[1];
  return (afterTo ?? message)
    .replace(AMOUNT_MYR, " ")
    .replace(AMOUNT_SUI, " ")
    .replace(/\b[0-9]+(?:\.[0-9]+)?\b/g, " ")
    .replace(FILLER, " ")
    .replace(/[^\p{L}\p{N}\s'&-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
};

export const heuristicProvider: ModelProvider = {
  kind: "heuristic",
  vendor: "none",
  model: null,
  interpret(message: string): Promise<ModelOutput> {
    const { amount, currency } = extractAmount(message);
    const merchantQuery = extractMerchantQuery(message);

    const missingInformation: ModelOutput["missingInformation"] = [];
    if (!merchantQuery) missingInformation.push("merchant");
    if (amount === null) missingInformation.push("amount");

    const parsed = modelOutputSchema.safeParse({
      merchantQuery,
      amount,
      displayCurrency: currency,
      // Fixed and modest on purpose: this is pattern matching, not understanding.
      confidence: 0.55,
      missingInformation,
      explanation: "Read from your message without the assistant. Check the details before paying.",
    } satisfies ModelOutput);

    if (!parsed.success) {
      return Promise.reject(
        new InterpretError(
          "AI_INVALID_OUTPUT",
          "Could not read a payment from that message.",
          parsed.error,
        ),
      );
    }
    return Promise.resolve(parsed.data);
  },
};
