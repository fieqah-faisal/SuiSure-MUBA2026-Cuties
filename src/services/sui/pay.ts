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
  /**
   * The payer's coins of `coinType`, exactly as `listPayerCoins` returns them.
   * Ignored when paying in SUI, where the split comes off the gas coin.
   */
  paymentCoins: PayerCoin[];
}

export interface PayerCoin {
  objectId: string;
  balance: bigint;
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
 * When paying in SUI the split comes off the gas coin. For any other coin the
 * caller's coins are merged first, because the exact amount may not exist in a
 * single object.
 */
export const buildPaymentTransaction = (input: BuildPaymentInput): Transaction => {
  const tx = new Transaction();

  let source;
  if (input.coinType === SUI_COIN_TYPE) {
    source = tx.gas;
  } else {
    // Largest first, so the common case needs no merge at all.
    const sorted = [...input.paymentCoins].sort((a, b) => (a.balance < b.balance ? 1 : -1));
    const total = sorted.reduce((sum, coin) => sum + coin.balance, 0n);
    if (total < input.amountBaseUnits) {
      throw new Error(
        `Not enough ${input.coinType.split("::").pop() ?? "balance"} to pay this request. ` +
          `Need ${input.amountBaseUnits}, wallet holds ${total}.`,
      );
    }

    // Take only as many coins as the amount needs rather than merging the whole
    // wallet into one object.
    const needed: PayerCoin[] = [];
    let running = 0n;
    for (const coin of sorted) {
      needed.push(coin);
      running += coin.balance;
      if (running >= input.amountBaseUnits) break;
    }

    const [primary, ...rest] = needed;
    if (!primary) {
      throw new Error(`No ${input.coinType} coins available to pay with.`);
    }
    source = tx.object(primary.objectId);
    if (rest.length > 0) {
      tx.mergeCoins(
        source,
        rest.map((coin) => tx.object(coin.objectId)),
      );
    }
  }

  const [exact] = tx.splitCoins(source, [tx.pure.u64(input.amountBaseUnits)]);

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

/** Coin objects the payer holds of a given type, newest page first. */
export const listPayerCoins = async (
  owner: string,
  coinType: string,
): Promise<PayerCoin[]> => {
  const response = await suiClient.core.listCoins({ owner, coinType });
  return response.objects.map((coin) => ({
    objectId: coin.objectId,
    balance: BigInt(coin.balance),
  }));
};

/** Total spendable balance of `coinType`, in the coin's smallest unit. */
export const getPayerBalance = async (owner: string, coinType: string): Promise<bigint> => {
  const response = await suiClient.core.getBalance({ owner, coinType });
  return BigInt(response.balance.balance);
};
