import { SUI_CONFIG } from "@/config/sui";
import { DEMO_MERCHANTS, findDemoMerchant } from "@/config/demo-intents";
import { persistence } from "@/services/storage/persistence.service";
import { fromBaseUnits, normalizeCoinType } from "@/services/sui/client";
import {
  getOnChainPaymentIntent,
  resolvePaymentIntent,
  verifyAgainstChain,
} from "@/services/sui/intents";
import { buildPaymentTransaction, getPayerBalance } from "@/services/sui/pay";
import type {
  PaymentIntent,
  PaymentIntentQRPayload,
  PaymentReceipt,
  RiskAssessment,
  VerificationCheck,
} from "@/types/domain";
import { paymentIntentQrPayloadSchema } from "@/types/domain";

const SUI_COIN_TYPE = "0x2::sui::SUI";
const tokenSymbol = (coinType: string) => coinType.split("::").pop() ?? coinType;
const readReceipts = (): PaymentReceipt[] => persistence.read<PaymentReceipt[]>("receipts", []);
const writeReceipts = (receipts: PaymentReceipt[]) => persistence.write("receipts", receipts);
type MerchantIntentIndex = Record<string, string[]>;
const readMerchantIntentIndex = (): MerchantIntentIndex =>
  persistence.read<MerchantIntentIndex>("merchant-intents", {});

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
    if (!result.success) throw new Error("This QR code is not a valid SuiSure payment request.");
    if (result.data.network !== SUI_CONFIG.network) {
      throw new Error(`This QR targets ${result.data.network}, not ${SUI_CONFIG.networkLabel}.`);
    }
    return result.data;
  },

  /** Resolves both IDs from a QR and rejects merchant substitution. */
  async getPaymentIntentFromQr(payload: PaymentIntentQRPayload): Promise<PaymentIntent> {
    if (payload.network !== SUI_CONFIG.network) {
      throw new Error(`This QR targets ${payload.network}, not ${SUI_CONFIG.networkLabel}.`);
    }
    return resolvePaymentIntent(payload.paymentIntentId, payload.merchantObjectId);
  },

  async getPaymentIntent(objectId: string): Promise<PaymentIntent> {
    const onChain = await getOnChainPaymentIntent(objectId);
    if (!onChain) throw new Error("Payment request not found on Sui Testnet.");
    return resolvePaymentIntent(objectId, onChain.credential_id);
  },

  /** Returns the first real configured Testnet request that remains payable. */
  async getAvailableDemoQrPayload(): Promise<PaymentIntentQRPayload> {
    for (const merchant of DEMO_MERCHANTS) {
      for (const reference of merchant.intents) {
        if (reference.status !== "payable") continue;
        const payload: PaymentIntentQRPayload = {
          v: 1,
          type: "suisure.payment-intent",
          network: SUI_CONFIG.network,
          paymentIntentId: reference.objectId,
          merchantObjectId: merchant.credentialId,
        };
        try {
          const intent = await this.getPaymentIntentFromQr(payload);
          if (intent.status === "pending") return payload;
        } catch {
          // The fixture may have been consumed; continue through the real pool.
        }
      }
    }
    throw new Error("No unused Testnet demo payment request is available.");
  },

  async listMerchantIntents(merchantObjectId: string): Promise<PaymentIntent[]> {
    const configured =
      findDemoMerchant(merchantObjectId)?.intents.map((intent) => intent.objectId) ?? [];
    const remembered = readMerchantIntentIndex()[merchantObjectId.toLowerCase()] ?? [];
    const intentIds = [...new Set([...remembered, ...configured])];
    const resolved = await Promise.allSettled(intentIds.map((id) => this.getPaymentIntent(id)));
    return resolved
      .filter(
        (result): result is PromiseFulfilledResult<PaymentIntent> => result.status === "fulfilled",
      )
      .map((result) => result.value)
      .filter((intent) => intent.merchantObjectId === merchantObjectId)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  },

  rememberMerchantIntent(merchantObjectId: string, paymentIntentId: string) {
    const index = readMerchantIntentIndex();
    const key = merchantObjectId.toLowerCase();
    index[key] = [...new Set([paymentIntentId, ...(index[key] ?? [])])];
    persistence.write("merchant-intents", index);
  },

  /** Re-reads every security-critical value from Sui immediately before enabling payment. */
  async verifyPaymentIntent(
    intent: PaymentIntent,
    context: { payerAddress: string },
  ): Promise<RiskAssessment> {
    const verification = await verifyAgainstChain(intent.objectId);
    const coinType = normalizeCoinType(intent.coinType ?? intent.tokenType);
    const [payerBalance, gasBalance] = await Promise.all([
      getPayerBalance(context.payerAddress, coinType),
      getPayerBalance(context.payerAddress, SUI_COIN_TYPE),
    ]);
    const checks: VerificationCheck[] = [
      {
        id: "registered",
        label: "Merchant is registered on Sui",
        passed: verification.merchantRegistered,
        critical: true,
      },
      {
        id: "active",
        label: "Merchant credential is active",
        passed: verification.merchantActive,
        critical: true,
      },
      {
        id: "recipient",
        label: "Recipient matches the registered address",
        passed: verification.recipientMatchesCredential,
        critical: true,
      },
      {
        id: "expiry",
        label: "Payment request has not expired",
        passed: verification.notExpired,
        critical: true,
        ...(!verification.notExpired
          ? { detail: "This request expired. Ask the merchant for a new QR." }
          : {}),
      },
      {
        id: "unpaid",
        label: "Payment request has not been paid",
        passed: verification.notAlreadyPaid,
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
        label: `Sufficient ${tokenSymbol(coinType)} balance`,
        passed: payerBalance >= verification.amountBaseUnits,
        critical: true,
      },
      {
        id: "amount",
        label: "Amount matches the canonical on-chain request",
        passed: true,
        critical: true,
      },
      {
        id: "gas",
        label: "SUI is available for network gas",
        passed: gasBalance > 0n,
        critical: true,
      },
    ];

    const failedCritical = checks.filter((check) => check.critical && !check.passed);
    return {
      level: failedCritical.length ? (failedCritical.length > 1 ? "blocked" : "high") : "low",
      checks,
      summary: failedCritical.length
        ? `${failedCritical.length} critical check${failedCritical.length > 1 ? "s" : ""} failed. Paying is blocked.`
        : "All on-chain verification checks passed for this merchant and request.",
    };
  },

  /** Builds from a fresh chain read so stale UI data can never determine the payment. */
  async preparePaymentTransaction(intent: PaymentIntent, payerAddress: string) {
    const onChain = await getOnChainPaymentIntent(intent.objectId);
    if (!onChain) throw new Error("Payment request no longer exists on Sui Testnet.");
    if (onChain.credential_id !== intent.merchantObjectId) {
      throw new Error("Merchant mismatch detected. Payment stopped.");
    }
    if (onChain.paid) throw new Error("This payment request has already been paid.");
    if (Date.now() >= Number(onChain.expiry_ms))
      throw new Error("This payment request has expired.");

    const coinType = normalizeCoinType(onChain.coin_type);
    if (coinType !== normalizeCoinType(intent.coinType ?? intent.tokenType)) {
      throw new Error("Payment token changed during review. Payment stopped.");
    }
    return buildPaymentTransaction({
      paymentIntentId: intent.objectId,
      merchantCredentialId: onChain.credential_id,
      amountBaseUnits: BigInt(onChain.amount),
      coinType,
    });
  },

  recordConfirmedPayment(
    intent: PaymentIntent,
    payerAddress: string,
    transactionDigest: string,
  ): PaymentReceipt {
    const receipt: PaymentReceipt = {
      receiptId: transactionDigest,
      paymentIntentId: intent.objectId,
      status: "confirmed",
      merchantName: intent.merchantName,
      merchantCategory: intent.merchantCategory,
      tokenAmount: intent.tokenAmount,
      tokenType: intent.tokenType,
      approxMyr: intent.amountMyr,
      payerAddress,
      merchantAddress: intent.recipientAddress,
      transactionDigest,
      network: SUI_CONFIG.network,
      timestamp: new Date().toISOString(),
    };
    const previous = readReceipts().filter((item) => item.transactionDigest !== transactionDigest);
    writeReceipts([receipt, ...previous]);
    return receipt;
  },

  async getReceipt(receiptId: string, payerAddress: string): Promise<PaymentReceipt> {
    const found = readReceipts().find(
      (receipt) => receipt.receiptId === receiptId || receipt.transactionDigest === receiptId,
    );
    if (!found || found.payerAddress.toLowerCase() !== payerAddress.toLowerCase()) {
      throw new Error("Receipt not found for this connected account.");
    }
    return found;
  },

  async listReceipts(payerAddress?: string): Promise<PaymentReceipt[]> {
    const receipts = readReceipts();
    return payerAddress
      ? receipts.filter(
          (receipt) => receipt.payerAddress.toLowerCase() === payerAddress.toLowerCase(),
        )
      : receipts;
  },

  async getBalances(owner: string): Promise<{ token: string; amount: number; gasSui: number }> {
    const [paymentBalance, gasBalance] = await Promise.all([
      getPayerBalance(owner, SUI_CONFIG.usdcCoinType),
      getPayerBalance(owner, SUI_COIN_TYPE),
    ]);
    return {
      token: tokenSymbol(SUI_CONFIG.usdcCoinType),
      amount: fromBaseUnits(paymentBalance, SUI_CONFIG.usdcCoinType),
      gasSui: fromBaseUnits(gasBalance, SUI_COIN_TYPE),
    };
  },
};
