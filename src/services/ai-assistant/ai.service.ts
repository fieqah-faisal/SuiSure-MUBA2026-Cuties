import { SUI_CONFIG } from "@/config/sui";
import type { AiParsedIntent, VerifiedMerchant } from "@/types/domain";

import { errorResponseSchema, interpretResponseSchema, type ResolvedMerchant } from "./schemas";

/**
 * Browser-side adapter for the AI assistant.
 *
 * The assistant only interprets and explains a payment; its output can never
 * execute or sign a transaction, and it never carries a recipient address.
 *
 * This file runs in the browser, so it holds no API key and no model client — it
 * calls the server route, which owns both. Keep the exported name and the
 * `interpret(message)` signature stable: `src/routes/pay.tsx` calls it.
 */

const ENDPOINT = import.meta.env["VITE_AI_ENDPOINT"] ?? "/api/interpret-payment";

const SUI_OBJECT_ID = /^0x[0-9a-f]{64}$/i;

export const aiAssistantService = {
  async interpret(message: string): Promise<AiParsedIntent> {
    let payload: unknown;

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
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

    const { interpretation, resolution } = parsed.data;
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
      explanation: interpretation.explanation,
      ...(clarificationFor(resolution.status, interpretation.missingInformation)
        ? {
            clarificationQuestion: clarificationFor(
              resolution.status,
              interpretation.missingInformation,
            )!,
          }
        : {}),
    };
  },
};

/**
 * Fills in the payout address by reading the credential from Sui.
 *
 * The endpoint deliberately never sends an address. When the object ID is a real
 * on-chain credential the address is read here, from chain; otherwise it stays
 * empty and the review screen reads it from chain itself before anything is
 * signed. Either way no address ever originates from the assistant.
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
  if (!SUI_OBJECT_ID.test(objectId)) return "";
  try {
    const { getOnChainMerchantCredential } = await import("@/services/sui/merchants");
    const credential = await getOnChainMerchantCredential(objectId);
    return credential?.payout ?? "";
  } catch {
    // A failed read is not a reason to block the review screen, which does its
    // own authoritative read. Leave it empty rather than guess.
    return "";
  }
};

const label = (missing: "merchant" | "amount"): string =>
  missing === "merchant" ? "Merchant" : "Amount";

const clarificationFor = (
  status: "resolved" | "ambiguous" | "not-found",
  missing: readonly ("merchant" | "amount")[],
): string | undefined => {
  if (status === "ambiguous") return "Which of these registered merchants did you mean?";
  if (status === "not-found") return "Which registered merchant would you like to pay?";
  if (missing.includes("amount")) return "How much would you like to pay?";
  return undefined;
};
