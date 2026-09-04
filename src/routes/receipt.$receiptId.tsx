import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { SUI_CONFIG, explorerTxUrl, shortAddress } from "@/config/sui";
import { useSession } from "@/hooks/useSession";
import { paymentService } from "@/services/payments/payment.service";
import type { PaymentReceipt } from "@/types/domain";

export const Route = createFileRoute("/receipt/$receiptId")({
  head: () => ({
    meta: [
      { title: "Payment receipt | SuiSure" },
      {
        name: "description",
        content: "Onchain SuiSure payment receipt with transaction digest and merchant details.",
      },
      { property: "og:title", content: "Payment receipt | SuiSure" },
      { property: "og:description", content: "Verified Sui Testnet payment receipt." },
    ],
  }),
  component: ReceiptPage,
});

function ReceiptPage() {
  const { receiptId } = Route.useParams();
  const { account } = useSession();
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!account?.address) return;
    setReceipt(null);
    setError(null);
    void paymentService
      .getReceipt(receiptId, account.address)
      .then(setReceipt)
      .catch((e: Error) => setError(e.message));
  }, [receiptId, account?.address]);

  return (
    <AppShell title="Receipt">
      {error ? (
        <p className="surface-card p-6 text-center text-sm text-critical">{error}</p>
      ) : !receipt ? (
        <div className="surface-card h-48 animate-pulse bg-muted/40" />
      ) : (
        <>
          <section className="surface-card p-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
            <h1 className="mt-3 text-lg font-semibold">Payment {receipt.status}</h1>
            <p className="mt-1 text-3xl font-bold">RM{receipt.approxMyr.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">
              {receipt.tokenAmount.toFixed(4)} {receipt.tokenType} · {SUI_CONFIG.networkLabel}
            </p>
          </section>

          <dl className="surface-card mt-4 space-y-3 p-5 text-sm">
            <Row label="Merchant" value={receipt.merchantName} />
            <Row label="Category" value={receipt.merchantCategory} />
            <Row label="From" value={shortAddress(receipt.payerAddress, 8, 6)} mono />
            <Row label="To" value={shortAddress(receipt.merchantAddress, 8, 6)} mono />
            <Row label="Digest" value={shortAddress(receipt.transactionDigest, 8, 6)} mono />
            <Row label="Time" value={new Date(receipt.timestamp).toLocaleString()} />
          </dl>

          <a
            href={explorerTxUrl(receipt.transactionDigest)}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-primary"
          >
            View on Sui explorer <ExternalLink className="h-4 w-4" />
          </a>

          <Button asChild className="mt-5 w-full" variant="outline">
            <Link to="/app">Back to home</Link>
          </Button>
        </>
      )}
    </AppShell>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono text-xs" : "font-medium"}>{value}</dd>
    </div>
  );
}
