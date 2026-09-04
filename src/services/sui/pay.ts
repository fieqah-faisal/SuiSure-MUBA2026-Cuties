import { Transaction } from "@mysten/sui/transactions";

import { SUI_CONFIG } from "@/config/sui";

import { suiClient } from "./client";

const SUI_COIN_TYPE = "0x2::sui::SUI";
/** The shared Clock object. Fixed address on every network. */
const CLOCK_ID = "0x6";

export interface BuildPaymentInput {
  /** Shared PaymentIntent object ID, from the QR. */
  paymentIntentId: string;
  /** Shared MerchantCredential object ID, from the intent's credential_id. */
  merchantCredentialId: string;
  /** Exact amount in the coin's smallest unit, from the intent. */
  amountBaseUnits: bigint;
  /** Full coin type, e.g. `0x...::usdc::USDC`. */
  coinType: string;
}

/**
 * Builds the payment as a single programmable transaction.
 *
 * Two things make the split mandatory rather than a convenience:
 *
 * 1. Payment Kit aborts unless the coin's value is *exactly* the requested
 *    amount, and a wallet's coin objects are almost never the right size.
 * 2. The split must happen in the same PTB as the call. Splitting in a separate
 *    transaction first would leave a stray coin behind on any failure and adds a
 *    round trip the customer waits through.
 *
 * The current SDK resolves the requested amount from either address balance
 * or owned Coin objects, preserving support for zkLogin and extension wallets.
 */
export const buildPaymentTransaction = (input: BuildPaymentInput): Transaction => {
  const tx = new Transaction();

  // Transaction.coin supports both Sui address balances (used by Enoki
  // zkLogin accounts) and traditional owned Coin objects (used by extension
  // wallets). The SDK resolves the correct source at signing time.
  const exact = tx.coin({
    type: input.coinType,
    balance: input.amountBaseUnits,
    useGasCoin: input.coinType === SUI_COIN_TYPE,
  });

  tx.moveCall({
    // Move calls go to the latest package ID, not the original one.
    target: `${SUI_CONFIG.packageId}::payments::pay_payment_intent`,
    typeArguments: [input.coinType],
    arguments: [
      tx.object(input.merchantCredentialId),
      tx.object(input.paymentIntentId),
      tx.object(SUI_CONFIG.registryId),
      exact,
      tx.object(CLOCK_ID),
    ],
  });

  return tx;
};

/** Total spendable balance of `coinType`, in the coin's smallest unit. */
export const getPayerBalance = async (owner: string, coinType: string): Promise<bigint> => {
  const response = await suiClient.core.getBalance({ owner, coinType });
  return BigInt(response.balance.balance);
};
