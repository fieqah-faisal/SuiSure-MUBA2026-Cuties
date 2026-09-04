import { merchantService } from "@/services/merchant/merchant.service";
import type { AiParsedIntent, VerifiedMerchant } from "@/types/domain";

/**
 * AI assistant adapter. The assistant only interprets and explains a payment;
 * its output can never execute or sign a transaction.
 */
export const aiAssistantService = {
  async interpret(message: string): Promise<AiParsedIntent> {
    const text = message.toLowerCase();

    const myrMatch = text.match(/(?:rm|myr)\s*([0-9]+(?:\.[0-9]{1,2})?)/);
    const suiMatch = text.match(/([0-9]+(?:\.[0-9]+)?)\s*sui/);
    const bareMatch = text.match(/\b([0-9]+(?:\.[0-9]{1,2})?)\b/);

    const displayCurrency: "MYR" | "SUI" = suiMatch && !myrMatch ? "SUI" : "MYR";
    const rawAmount = myrMatch?.[1] ?? (suiMatch ? undefined : bareMatch?.[1]);
    const amount = rawAmount ? Number(rawAmount) : undefined;

    const verified = (await merchantService.listVerifiedMerchants()).filter(
      (merchant) => merchant.verified && merchant.active,
    );
    const candidates: VerifiedMerchant[] = verified.filter((merchant) =>
      merchant.name
        .toLowerCase()
        .split(/\s+/)
        .some((word) => word.length > 3 && text.includes(word)),
    );

    const merchant = candidates.length === 1 ? candidates[0] : undefined;
    const missing: string[] = [];
    if (!merchant) missing.push("Merchant");
    if (amount === undefined) missing.push("Amount");

    const amountLabel = amount === undefined ? "" : `RM${amount.toFixed(2)}`;
    const unsupportedSuiAmount = displayCurrency === "SUI";

    return {
      merchantCandidates: candidates,
      ...(merchant ? { merchant } : {}),
      ...(amount !== undefined ? { amount } : {}),
      displayCurrency,
      paymentToken: "USDC",
      confidence: merchant && amount !== undefined ? 0.92 : candidates.length ? 0.6 : 0.35,
      missingInformation: missing,
      explanation: unsupportedSuiAmount
        ? "SuiSure's current Testnet payment requests are denominated in MYR and settle in Testnet USDC. Enter the amount in RM."
        : merchant
          ? `You want to pay ${merchant.name}${amountLabel ? ` ${amountLabel}` : ""}. The merchant was matched against live Sui Testnet credentials. Scan or upload the merchant's on-chain payment request to verify its canonical amount — I cannot pay on your behalf.`
        : candidates.length > 1
          ? "I found several verified merchants that match. Please choose one."
          : "I could not match a verified merchant from that message.",
      ...(missing.length
        ? {
            clarificationQuestion: unsupportedSuiAmount
              ? "How much would you like to pay in MYR?"
              : !merchant
              ? "Which verified merchant would you like to pay?"
              : "How much would you like to pay?",
          }
        : {}),
    };
  },
};
