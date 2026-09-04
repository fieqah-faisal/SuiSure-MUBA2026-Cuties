import {
  useCurrentAccount,
  useCurrentClient,
  useCurrentNetwork,
  useDAppKit,
} from "@mysten/dapp-kit-react";
import { useCallback, useState } from "react";

import { SUI_CONFIG } from "@/config/sui";
import { paymentService } from "@/services/payments/payment.service";
import { isSuiSureType, normalizeAddress } from "@/services/sui/client";
import {
  buildCreatePaymentIntentTransaction,
  type BuildMerchantIntentInput,
} from "@/services/sui/create-intent";
import type { MerchantCredential, PaymentIntent } from "@/types/domain";

export type MerchantIntentCreationPhase =
  "idle" | "preparing" | "awaiting-wallet" | "confirming" | "confirmed" | "failed";

export interface CreatedMerchantIntent {
  intent: PaymentIntent;
  transactionDigest: string;
}

const readableCreationError = (error: unknown): string => {
  const message =
    error instanceof Error ? error.message : "The payment request could not be created.";
  if (/rejected|declined|denied|cancelled|canceled/i.test(message)) {
    return "The wallet approval was cancelled. No payment request was created.";
  }
  return message;
};

/** Owns the wallet boundary for creating a real on-chain merchant request. */
export function useMerchantIntentCreation() {
  const dAppKit = useDAppKit();
  const client = useCurrentClient();
  const currentAccount = useCurrentAccount();
  const currentNetwork = useCurrentNetwork();
  const [phase, setPhase] = useState<MerchantIntentCreationPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const createIntent = useCallback(
    async (
      credential: MerchantCredential,
      input: Omit<BuildMerchantIntentInput, "merchantCredentialId">,
    ): Promise<CreatedMerchantIntent> => {
      setError(null);
      setPhase("preparing");

      try {
        if (!currentAccount) throw new Error("Connect your Sui wallet before creating a request.");
        if (currentNetwork !== SUI_CONFIG.network) {
          throw new Error(`Switch your wallet to ${SUI_CONFIG.networkLabel} first.`);
        }
        if (
          normalizeAddress(currentAccount.address) !== normalizeAddress(credential.receivingAddress)
        ) {
          throw new Error("The connected wallet is not this merchant's registered payout wallet.");
        }
        if (!credential.active) throw new Error("This merchant credential is inactive.");

        const transaction = buildCreatePaymentIntentTransaction({
          ...input,
          merchantCredentialId: credential.objectId,
        });

        setPhase("awaiting-wallet");
        const result = await dAppKit.signAndExecuteTransaction({
          transaction,
          network: SUI_CONFIG.network,
        });
        if (result.$kind === "FailedTransaction") {
          throw new Error(
            result.FailedTransaction.status.error?.message ??
              "The create-request transaction failed.",
          );
        }

        const digest = result.Transaction.digest;
        setPhase("confirming");
        const confirmed = await client.waitForTransaction({
          digest,
          include: { effects: true, objectTypes: true },
        });
        if (confirmed.$kind === "FailedTransaction") {
          throw new Error(
            confirmed.FailedTransaction.status.error?.message ??
              "The payment request failed on Sui Testnet.",
          );
        }

        const transactionResult = confirmed.Transaction;
        const created = transactionResult.effects.changedObjects.find((change) => {
          const objectType = transactionResult.objectTypes[change.objectId] ?? "";
          return change.idOperation === "Created" && isSuiSureType(objectType, "PaymentIntent");
        });
        if (!created) {
          throw new Error(
            "Sui confirmed the transaction, but the new PaymentIntent object could not be identified.",
          );
        }

        paymentService.rememberMerchantIntent(credential.objectId, created.objectId);
        const intent = await paymentService.getPaymentIntent(created.objectId);
        setPhase("confirmed");
        return { intent, transactionDigest: digest };
      } catch (caught) {
        setError(readableCreationError(caught));
        setPhase("failed");
        throw caught;
      }
    },
    [client, currentAccount, currentNetwork, dAppKit],
  );

  const reset = useCallback(() => {
    setError(null);
    setPhase("idle");
  }, []);

  return {
    createIntent,
    phase,
    error,
    reset,
    ready: Boolean(currentAccount) && currentNetwork === SUI_CONFIG.network,
  };
}
