import { SUI_CONFIG } from "@/config/sui";
import { persistence } from "@/services/storage/persistence.service";
import { getOnChainMerchantCredential } from "@/services/sui/merchants";
import type { AiParsedIntent, AiPaymentRequestSummary, VerifiedMerchant } from "@/types/domain";

import {
  errorResponseSchema,
  interpretResponseSchema,
  type PaymentRequestSummary,
  type ResolvedMerchant,
} from "./schemas.ts";

/**
 * Browser-side adapter for the AI assistant.
 *
 * The assistant only interprets and explains a payment; its output can never
 * execute or sign a transaction, and it never carries a recipient address.
 *
 * This file runs in the browser, so it holds no API key and no model client —
 * it calls the server route, which owns both. The exported name and the
 * `interpret(message)` signature are stable: `src/routes/pay.tsx` calls it.
 */

const ENDPOINT = import.meta.env["VITE_AI_ENDPOINT"]?.trim() || "/api/interpret-payment";
const MAX_KNOWN_INTENTS = 20;

/**
 * Payment requests this browser has seen the merchant create. Sent so the
 * server can include a request made live on stage, seconds ago, on this same
 * device. The server verifies every one of them on chain before use.
 */
const knownIntentIds = (): string[] => {
  const index = persistence.read<Record<string, string[]>>("merchant-intents", {});
  return [...new Set(Object.values(index).flat())].slice(0, MAX_KNOWN_INTENTS);
};

export const aiAssistantService = {
  async interpret(message: string): Promise<AiParsedIntent> {
    let payload: unknown;

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, knownIntentIds: knownIntentIds() }),
      });
      payload = await response.json();
    } catch (error) {
      throw new Error("Could not reach the assistant. Check your connection or scan a QR code.", {
        cause: error,
      });
    }

    const failure = errorResponseSchema.safeParse(payload);
    if (failure.success) throw new Error(failure.data.message);

    const parsed = interpretResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error("The assistant returned an unexpected response. Try the QR flow.");
    }

    const { interpretation, resolution, requests, nextStep, meta } = parsed.data;
    const merchant = resolution.merchant
      ? await toVerifiedMerchant(resolution.merchant)
      : undefined;
    const candidates = await Promise.all(resolution.candidates.map(toVerifiedMerchant));

    return {
      merchantCandidates: candidates,
      ...(merchant ? { merchant } : {}),
      ...(interpretation.amount !== null ? { amount: interpretation.amount } : {}),
      displayCurrency: interpretation.displayCurrency,
      // Advisory only. The coin actually accepted is fixed by the on-chain
      // request's coin_type and asserted by the contract at payment time.
      paymentToken: SUI_CONFIG.defaultToken,
      confidence: interpretation.confidence,
      missingInformation: interpretation.missingInformation.map(label),
      // Written by server code that has seen the on-chain facts, not by the model.
      explanation: nextStep.headline,
      ...(nextStep.question ? { clarificationQuestion: nextStep.question } : {}),
      merchantQuery: interpretation.merchantQuery,
      assistantNote: interpretation.explanation,
      nextStep: nextStep.kind,
      ...(requests.match ? { matchedRequest: toRequestSummary(requests.match) } : {}),
      openRequests: requests.open.map(toRequestSummary),
      source: meta.source,
      model: meta.model,
    };
  },
};

/**
 * Fills in the payout address by reading the credential from Sui.
 *
 * The endpoint deliberately never sends an address. The `VerifiedMerchant`
 * type used by the UI has one, so it is read here from the on-chain
 * credential — the same object the review screen and the contract read. If
 * the read fails it stays empty rather than guessed; the review screen does
 * its own authoritative read before anything is signed.
 */
const toVerifiedMerchant = async (merchant: ResolvedMerchant): Promise<VerifiedMerchant> => ({
  objectId: merchant.objectId,
  name: merchant.name,
  category: merchant.category,
  address: await payoutAddress(merchant.objectId),
  verified: true,
  active: merchant.active,
  logoInitials: merchant.logoInitials,
});

const payoutAddress = async (objectId: string): Promise<string> => {
  try {
    return (await getOnChainMerchantCredential(objectId))?.payout ?? "";
  } catch {
    return "";
  }
};

const toRequestSummary = (request: PaymentRequestSummary): AiPaymentRequestSummary => ({
  paymentIntentId: request.paymentIntentId,
  merchantObjectId: request.merchantObjectId,
  amountMyr: request.amountMyr,
  tokenAmount: request.tokenAmount,
  tokenType: request.tokenType,
  ...(request.description ? { description: request.description } : {}),
  ...(request.orderReference ? { orderReference: request.orderReference } : {}),
  expiresAt: request.expiresAt,
});

const label = (missing: "merchant" | "amount"): string =>
  missing === "merchant" ? "Merchant" : "Amount";
