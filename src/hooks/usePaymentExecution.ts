import {
  useCurrentAccount,
  useCurrentClient,
  useCurrentNetwork,
  useDAppKit,
} from "@mysten/dapp-kit-react";
import { useCallback, useState } from "react";

import { SUI_CONFIG } from "@/config/sui";
import { useSession } from "@/hooks/useSession";
import { notificationService } from "@/services/notifications/notification.service";
import { paymentService } from "@/services/payments/payment.service";
import type { PaymentIntent, PaymentReceipt } from "@/types/domain";

export type PaymentExecutionPhase =
  "idle" | "preparing" | "awaiting-wallet" | "confirming" | "confirmed" | "failed";

const readablePaymentError = (error: unknown) => {
  const message = error instanceof Error ? error.message : "The payment could not be completed.";
  if (/incorrect password/i.test(message)) {
    return "Your wallet reported an incorrect password. Unlock Slush directly, then retry.";
  }
  if (/rejected|declined|denied|cancelled|canceled/i.test(message)) {
    return "The wallet approval was cancelled. Nothing was sent.";
  }
  return message;
};

/** Owns the wallet-only boundary for signing and confirming a real Sui payment. */
export function usePaymentExecution() {
  const dAppKit = useDAppKit();
  const client = useCurrentClient();
  const currentAccount = useCurrentAccount();
  const currentNetwork = useCurrentNetwork();
  const { refreshBalance } = useSession();
  const [paymentPhase, setPaymentPhase] = useState<PaymentExecutionPhase>("idle");
  const [transactionDigest, setTransactionDigest] = useState<string | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  const resetPaymentState = useCallback(() => {
    setPaymentPhase("idle");
    setTransactionDigest(null);
    setExecutionError(null);
  }, []);

  const executePayment = useCallback(
    async (intent: PaymentIntent): Promise<PaymentReceipt> => {
      setExecutionError(null);
      setTransactionDigest(null);
      setPaymentPhase("preparing");

      try {
        if (!currentAccount) throw new Error("Connect your Sui wallet before paying.");
        if (currentNetwork !== SUI_CONFIG.network) {
          throw new Error(`Switch your wallet to ${SUI_CONFIG.networkLabel} before paying.`);
        }

        const transaction = await paymentService.preparePaymentTransaction(
          intent,
          currentAccount.address,
        );
        setPaymentPhase("awaiting-wallet");
        const result = await dAppKit.signAndExecuteTransaction({ transaction });
        if (result.$kind === "FailedTransaction") {
          throw new Error(
            result.FailedTransaction.status.error?.message ?? "The Sui transaction failed.",
          );
        }

        const digest = result.Transaction.digest;
        setTransactionDigest(digest);
        setPaymentPhase("confirming");
        const confirmed = await client.waitForTransaction({ digest, include: { effects: true } });
        if (confirmed.$kind === "FailedTransaction") {
          throw new Error(
            confirmed.FailedTransaction.status.error?.message ??
              "The payment failed on Sui Testnet.",
          );
        }

        const receipt = paymentService.recordConfirmedPayment(
          intent,
          currentAccount.address,
          digest,
        );
        notificationService.addPaymentConfirmation(receipt);
        setPaymentPhase("confirmed");
        // Confirmation is authoritative even if a follow-up balance refresh is unavailable.
        await refreshBalance().catch(() => undefined);
        return receipt;
      } catch (error) {
        setExecutionError(readablePaymentError(error));
        setPaymentPhase("failed");
        throw error;
      }
    },
    [client, currentAccount, currentNetwork, dAppKit, refreshBalance],
  );

  return {
    executePayment,
    paymentPhase,
    transactionDigest,
    executionError,
    resetPaymentState,
    connectedAddress: currentAccount?.address ?? null,
    currentNetwork,
    readyToPay: Boolean(currentAccount) && currentNetwork === SUI_CONFIG.network,
  };
}
