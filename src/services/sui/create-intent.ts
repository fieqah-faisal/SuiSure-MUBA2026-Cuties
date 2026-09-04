import { Transaction } from "@mysten/sui/transactions";

import { SUI_CONFIG } from "@/config/sui";
import { myrToSen, toBaseUnits } from "@/services/sui/client";

const CLOCK_ID = "0x6";

/**
 * Reference rate used by the pre-created Testnet fixtures.
 * This is deliberately labelled as a demo rate, not a live market quote.
 */
export const TESTNET_MYR_PER_USDC = 4.7;

export interface BuildMerchantIntentInput {
  merchantCredentialId: string;
  amountMyr: number;
  description?: string;
  orderReference?: string;
  expiryMinutes: number;
}

export const testnetUsdcForMyr = (amountMyr: number): number => amountMyr / TESTNET_MYR_PER_USDC;

/** Builds the real wallet-signed call that creates a shared PaymentIntent. */
export const buildCreatePaymentIntentTransaction = (
  input: BuildMerchantIntentInput,
): Transaction => {
  if (!Number.isFinite(input.amountMyr) || input.amountMyr <= 0) {
    throw new Error("Enter a valid amount in MYR.");
  }
  if (
    !Number.isInteger(input.expiryMinutes) ||
    input.expiryMinutes < 1 ||
    input.expiryMinutes > 10_080
  ) {
    throw new Error("Expiry must be between 1 minute and 7 days.");
  }

  const tx = new Transaction();
  const amountUsdc = testnetUsdcForMyr(input.amountMyr);
  const expiryMs = BigInt(Date.now() + input.expiryMinutes * 60_000);
  const nonce = globalThis.crypto.randomUUID();

  tx.moveCall({
    target: `${SUI_CONFIG.packageId}::payments::create_payment_intent`,
    typeArguments: [SUI_CONFIG.usdcCoinType],
    arguments: [
      tx.object(input.merchantCredentialId),
      tx.pure.u64(toBaseUnits(amountUsdc, SUI_CONFIG.usdcCoinType)),
      tx.pure.u64(myrToSen(input.amountMyr)),
      tx.pure.string(nonce),
      tx.pure.string(input.description?.trim() ?? ""),
      tx.pure.string(input.orderReference?.trim() ?? ""),
      tx.pure.u64(expiryMs),
      tx.object(CLOCK_ID),
    ],
  });

  return tx;
};
