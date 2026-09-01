import { MOCK_MERCHANTS, MOCK_RATE_MYR_PER_SUI } from "@/services/mocks/data";
import type { AiParsedIntent, VerifiedMerchant } from "@/types/domain";

/**
 * AI assistant adapter. The assistant only interprets and explains a payment;
 * its output can never execute or sign a transaction.
 */
export const aiAssistantService = {
  async interpret(message: string): Promise<AiParsedIntent> {
    await new Promise((r) => setTimeout(r, 800));
    const text = message.toLowerCase();

    const myrMatch = text.match(/(?:rm|myr)\s*([0-9]+(?:\.[0-9]{1,2})?)/);
    const suiMatch = text.match(/([0-9]+(?:\.[0-9]+)?)\s*sui/);
    const bareMatch = text.match(/\b([0-9]+(?:\.[0-9]{1,2})?)\b/);

    const displayCurrency: "MYR" | "SUI" = suiMatch && !myrMatch ? "SUI" : "MYR";
    const rawAmount = myrMatch?.[1] ?? suiMatch?.[1] ?? bareMatch?.[1];
    const amount = rawAmount ? Number(rawAmount) : undefined;

    const verified = MOCK_MERCHANTS.filter((m) => m.verified);
    const candidates: VerifiedMerchant[] = verified.filter((m) =>
      m.name
        .toLowerCase()
        .split(/\s+/)
        .some((word) => word.length > 3 && text.includes(word)),
    );

    const merchant = candidates.length === 1 ? candidates[0] : undefined;
    const missing: string[] = [];
    if (!merchant) missing.push("Merchant");
    if (amount === undefined) missing.push("Amount");

    const amountLabel =
      amount === undefined
        ? ""
        : displayCurrency === "MYR"
          ? `RM${amount.toFixed(2)} (~${(amount / MOCK_RATE_MYR_PER_SUI).toFixed(4)} SUI)`
          : `${amount} SUI (~RM${(amount * MOCK_RATE_MYR_PER_SUI).toFixed(2)})`;

    return {
      merchantCandidates: candidates,
      ...(merchant ? { merchant } : {}),
      ...(amount !== undefined ? { amount } : {}),
      displayCurrency,
      paymentToken: "SUI",
      confidence: merchant && amount !== undefined ? 0.92 : candidates.length ? 0.6 : 0.35,
      missingInformation: missing,
      explanation: merchant
        ? `You want to pay ${merchant.name}${amountLabel ? ` ${amountLabel}` : ""}. ${
            displayCurrency === "MYR"
              ? "MYR is converted to Testnet SUI at review time."
              : "The amount is already in Testnet SUI."
          } I will prepare a request for you to review — I cannot pay on your behalf.`
        : candidates.length > 1
          ? "I found several verified merchants that match. Please choose one."
          : "I could not match a verified merchant from that message.",
      ...(missing.length
        ? {
            clarificationQuestion: !merchant
              ? "Which verified merchant would you like to pay?"
              : "How much would you like to pay?",
          }
        : {}),
    };
  },
};
