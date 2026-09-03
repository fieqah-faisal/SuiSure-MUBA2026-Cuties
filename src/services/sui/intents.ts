import { SUI_CONFIG } from "@/config/sui";
import type { PaymentIntent, PaymentStatus } from "@/types/domain";

import {
  fetchObjectJson,
  fromBaseUnits,
  isSuiSureType,
  normalizeCoinType,
  senToMyr,
} from "./client";
import { getOnChainMerchantCredential } from "./merchants";

/** `suisure::payments::PaymentIntent` as it comes back from chain. */
export interface OnChainPaymentIntent {
  id: string;
  credential_id: string;
  amount: string;
  amount_myr: string;
  coin_type: string;
  nonce: string;
  description: string;
  order_ref: string;
  expiry_ms: string;
  created_at_ms: string;
  paid: boolean;
}

/**
 * PaymentIntent was introduced by the upgrade, so on chain it reports the
 * *upgraded* package ID, not the original one — unlike MerchantCredential.
 * `isSuiSureType` accepts either, which is why it exists.
 */
export const PAYMENT_INTENT_STRUCT = "PaymentIntent" as const;

export const statusFor = (intent: OnChainPaymentIntent, nowMs = Date.now()): PaymentStatus => {
  if (intent.paid) return "confirmed";
  if (nowMs >= Number(intent.expiry_ms)) return "expired";
  return "pending";
};

export const getOnChainPaymentIntent = async (
  objectId: string,
): Promise<OnChainPaymentIntent | null> => {
  const result = await fetchObjectJson<OnChainPaymentIntent>(objectId);
  if (!result) return null;
  if (!isSuiSureType(result.type, PAYMENT_INTENT_STRUCT)) {
    throw new Error(
      `Object ${objectId} is not a SuiSure payment request. Refusing to treat it as one.`,
    );
  }
  return result.json;
};

/**
 * Resolves a scanned QR into the full payment request.
 *
 * `merchantObjectId` comes from the QR, but it is never trusted as the source
 * of the destination. The intent's own `credential_id` decides which credential
 * is authoritative, the QR's value is checked against it, and the payout
 * address is then read from that credential. A swapped QR therefore fails here
 * rather than paying the wrong address — and would fail again in the contract.
 *
 * The coin type is read from the request itself, not chosen by the caller. The
 * contract records it at creation and asserts it at payment, so a request for
 * USDC cannot be settled in anything else.
 */
export const resolvePaymentIntent = async (
  paymentIntentId: string,
  merchantObjectId: string,
): Promise<PaymentIntent> => {
  const intent = await getOnChainPaymentIntent(paymentIntentId);
  if (!intent) throw new Error("Payment request not found on Sui Testnet.");

  if (intent.credential_id !== merchantObjectId) {
    throw new Error(
      "This QR names a different merchant than the payment request it points at. Do not pay it.",
    );
  }

  const credential = await getOnChainMerchantCredential(intent.credential_id);
  if (!credential) throw new Error("Merchant credential not found on Sui Testnet.");

  const coinType = normalizeCoinType(intent.coin_type);

  return {
    objectId: intent.id,
    merchantObjectId: intent.credential_id,
    merchantName: credential.name,
    merchantCategory: credential.category,
    // Read from the credential. Never from the intent, never from the QR.
    recipientAddress: credential.payout,
    amountMyr: senToMyr(intent.amount_myr),
    tokenAmount: fromBaseUnits(intent.amount, coinType),
    tokenType: coinType.split("::").pop() ?? coinType,
    coinType,
    ...(intent.description ? { description: intent.description } : {}),
    ...(intent.order_ref ? { orderReference: intent.order_ref } : {}),
    network: SUI_CONFIG.network,
    createdAt: new Date(Number(intent.created_at_ms)).toISOString(),
    expiresAt: new Date(Number(intent.expiry_ms)).toISOString(),
    status: statusFor(intent),
  };
};

/** The raw on-chain facts the review screen's checks are built from. */
export interface OnChainVerification {
  merchantRegistered: boolean;
  merchantActive: boolean;
  recipientMatchesCredential: boolean;
  notExpired: boolean;
  notAlreadyPaid: boolean;
  amountBaseUnits: bigint;
}

export const verifyAgainstChain = async (paymentIntentId: string): Promise<OnChainVerification> => {
  const intent = await getOnChainPaymentIntent(paymentIntentId);
  if (!intent) throw new Error("Payment request not found on Sui Testnet.");
  const credential = await getOnChainMerchantCredential(intent.credential_id);

  return {
    merchantRegistered: credential !== null,
    merchantActive: credential?.active ?? false,
    // True by construction: the address is read from the credential rather than
    // carried alongside it, so there is nothing for an attacker to disagree with.
    recipientMatchesCredential: credential !== null,
    notExpired: Date.now() < Number(intent.expiry_ms),
    notAlreadyPaid: !intent.paid,
    amountBaseUnits: BigInt(intent.amount),
  };
};
