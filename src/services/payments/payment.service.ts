import { SUI_CONFIG } from "@/config/sui";
import { MOCK_INTENTS, MOCK_MERCHANTS, MOCK_RATE_MYR_PER_SUI, MOCK_RECEIPTS } from "@/services/mocks/data";
import type {
  PaymentIntent,
  PaymentIntentQRPayload,
  PaymentReceipt,
  RiskAssessment,
  VerificationCheck,
} from "@/types/domain";
import { paymentIntentQrPayloadSchema } from "@/types/domain";

const delay = (ms = 500) => new Promise((r) => setTimeout(r, ms));

const intents: PaymentIntent[] = [...MOCK_INTENTS];
const receipts: PaymentReceipt[] = [...MOCK_RECEIPTS];

const randomDigest = () =>
  Array.from({ length: 43 }, () =>
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789".charAt(
      Math.floor(Math.random() * 57),
    ),
  ).join("");

export const paymentService = {
  encodeQrPayload(intent: PaymentIntent): PaymentIntentQRPayload {
    return {
      v: 1,
      type: "suisure.payment-intent",
      network: intent.network,
      paymentIntentId: intent.objectId,
      merchantObjectId: intent.merchantObjectId,
    };
  },

  decodeQrPayload(raw: string): PaymentIntentQRPayload {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("This QR code is not a SuiSure payment request.");
    }
    const result = paymentIntentQrPayloadSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error("This QR code is not a valid SuiSure payment request.");
    }
    return result.data;
  },

  async getPaymentIntent(objectId: string): Promise<PaymentIntent> {
    await delay(350);
    const found = intents.find((i) => i.objectId === objectId);
    if (!found) throw new Error("Payment request not found on Sui Testnet.");
    return { ...found };
  },

  async listMerchantIntents(merchantObjectId: string): Promise<PaymentIntent[]> {
    await delay(300);
    return intents
      .filter((i) => i.merchantObjectId === merchantObjectId)
      .map((i) => ({ ...i }));
  },

  async createPaymentIntent(input: {
    merchantObjectId: string;
    amountMyr: number;
    description?: string;
    orderReference?: string;
    expiryMinutes: number;
  }): Promise<PaymentIntent> {
    await delay(1100);
    const merchant = MOCK_MERCHANTS.find((m) => m.objectId === input.merchantObjectId);
    if (!merchant) throw new Error("Merchant credential not found.");
    const now = Date.now();
    const intent: PaymentIntent = {
      objectId: `0xintent${randomDigest().slice(0, 16).toLowerCase()}`,
      merchantObjectId: merchant.objectId,
      merchantName: merchant.name,
      merchantCategory: merchant.category,
      recipientAddress: merchant.address,
      amountMyr: input.amountMyr,
      tokenAmount: input.amountMyr / MOCK_RATE_MYR_PER_SUI,
      tokenType: SUI_CONFIG.defaultToken,
      ...(input.description ? { description: input.description } : {}),
      ...(input.orderReference ? { orderReference: input.orderReference } : {}),
      network: SUI_CONFIG.network,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + input.expiryMinutes * 60_000).toISOString(),
      status: "pending",
    };
    intents.unshift(intent);
    return intent;
  },

  /** Runs verification checks against the onchain record. */
  async verifyPaymentIntent(
    intent: PaymentIntent,
    context: { balanceToken: number },
  ): Promise<RiskAssessment> {
    await delay(400);
    const merchant = MOCK_MERCHANTS.find((m) => m.objectId === intent.merchantObjectId);
    const expired = new Date(intent.expiresAt).getTime() < Date.now();
    const checks: VerificationCheck[] = [
      {
        id: "registered",
        label: "Merchant is registered on Sui",
        passed: Boolean(merchant?.verified),
        critical: true,
      },
      {
        id: "active",
        label: "Merchant credential is active",
        passed: Boolean(merchant?.active),
        critical: true,
      },
      {
        id: "recipient",
        label: "Recipient matches the registered address",
        passed: merchant?.address === intent.recipientAddress,
        critical: true,
      },
      {
        id: "expiry",
        label: "Payment request has not expired",
        passed: !expired,
        critical: true,
        ...(expired ? { detail: "This request expired. Ask the merchant for a new QR." } : {}),
      },
      {
        id: "unpaid",
        label: "Payment request has not been paid",
        passed: intent.status !== "confirmed",
        critical: true,
      },
      {
        id: "network",
        label: `Network is ${SUI_CONFIG.networkLabel}`,
        passed: intent.network === SUI_CONFIG.network,
        critical: true,
      },
      {
        id: "balance",
        label: "Sufficient testnet balance",
        passed: context.balanceToken >= intent.tokenAmount,
        critical: true,
      },
      {
        id: "amount",
        label: "Amount matches the canonical onchain request",
        passed: true,
        critical: false,
      },
    ];

    const failedCritical = checks.filter((c) => c.critical && !c.passed);
    const level = failedCritical.length
      ? failedCritical.length > 1
        ? "blocked"
        : "high"
      : checks.some((c) => !c.passed)
        ? "medium"
        : "low";

    return {
      level,
      checks,
      summary: failedCritical.length
        ? `${failedCritical.length} critical check${failedCritical.length > 1 ? "s" : ""} failed. Paying is blocked.`
        : "All Sui verification checks passed for this merchant and request.",
    };
  },

  /**
   * Executes a payment. In mock mode this simulates a signature request and a
   * Sui confirmation. It never signs on the user's behalf: the caller must have
   * captured an explicit Confirm and Pay action first.
   */
  async payPaymentIntent(
    intent: PaymentIntent,
    payerAddress: string,
    onSignatureRequested?: () => void,
  ): Promise<PaymentReceipt> {
    onSignatureRequested?.();
    await delay(1400);
    const receipt: PaymentReceipt = {
      receiptId: `rc_${Math.random().toString(16).slice(2, 8)}`,
      paymentIntentId: intent.objectId,
      status: "confirmed",
      merchantName: intent.merchantName,
      merchantCategory: intent.merchantCategory,
      tokenAmount: intent.tokenAmount,
      tokenType: intent.tokenType,
      approxMyr: intent.amountMyr,
      payerAddress,
      merchantAddress: intent.recipientAddress,
      transactionDigest: randomDigest(),
      network: intent.network,
      timestamp: new Date().toISOString(),
    };
    const target = intents.find((i) => i.objectId === intent.objectId);
    if (target) target.status = "confirmed";
    receipts.unshift(receipt);
    return receipt;
  },

  async getReceipt(receiptId: string): Promise<PaymentReceipt> {
    await delay(250);
    const found = receipts.find((r) => r.receiptId === receiptId);
    if (!found) throw new Error("Receipt not found.");
    return { ...found };
  },

  async listReceipts(): Promise<PaymentReceipt[]> {
    await delay(300);
    return receipts.map((r) => ({ ...r }));
  },

  async getBalance(): Promise<{ token: string; amount: number }> {
    await delay(200);
    return { token: SUI_CONFIG.defaultToken, amount: 12.4213 };
  },
};
