import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  Loader2,
  Receipt,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { explorerTxUrl, shortAddress } from "@/config/sui";
import { useSession } from "@/hooks/useSession";
import { notificationService } from "@/services/notifications/notification.service";
import { paymentService } from "@/services/payments/payment.service";
import { listMerchantPaymentActivity } from "@/services/sui/activity";
import type { MerchantPaymentActivity, PaymentReceipt } from "@/types/domain";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Transaction history | SuiSure" },
      {
        name: "description",
        content: "Review outgoing and incoming SuiSure payments verified on Sui Testnet.",
      },
      { property: "og:title", content: "Transaction history | SuiSure" },
      {
        property: "og:description",
        content: "Your outgoing and merchant payment history on Sui Testnet.",
      },
    ],
  }),
  component: ActivityPage,
});

type ActivityFilter = "all" | "sent" | "received";
type ActivityItem =
  | { direction: "sent"; timestamp: string; receipt: PaymentReceipt }
  | { direction: "received"; timestamp: string; payment: MerchantPaymentActivity };

function ActivityPage() {
  const { account, credential } = useSession();
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [sent, setSent] = useState<PaymentReceipt[]>([]);
  const [received, setReceived] = useState<MerchantPaymentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadActivity = useCallback(
    async (refresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const [outgoing, incoming] = await Promise.all([
          paymentService.listReceipts(account?.address),
          credential ? listMerchantPaymentActivity(credential, { refresh }) : Promise.resolve([]),
        ]);
        incoming.forEach((payment) => notificationService.addMerchantPaymentReceived(payment));
        setSent(outgoing);
        setReceived(incoming);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Transaction history could not load.");
      } finally {
        setLoading(false);
      }
    },
    [account?.address, credential],
  );

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  const items = useMemo<ActivityItem[]>(() => {
    const outgoing: ActivityItem[] = sent.map((receipt) => ({
      direction: "sent",
      timestamp: receipt.timestamp,
      receipt,
    }));
    const incoming: ActivityItem[] = received.map((payment) => ({
      direction: "received",
      timestamp: payment.timestamp,
      payment,
    }));
    return [
      ...(filter === "received" ? [] : outgoing),
      ...(filter === "sent" ? [] : incoming),
    ].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  }, [filter, received, sent]);

  const emptyDescription =
    filter === "received"
      ? "Successful payments to your registered merchant address will appear here."
      : filter === "sent"
        ? "Payments you make to verified merchants will appear here."
        : "Your sent and received SuiSure payments will appear here.";

  return (
    <AppShell title="Activity">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Transaction history</h1>
          <p className="mt-1 text-xs text-muted-foreground">Verified using Sui Testnet records</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void loadActivity(true)}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2" aria-label="Transaction type">
        {(["all", "sent", "received"] as const).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={filter === value ? "default" : "outline"}
            onClick={() => setFilter(value)}
            aria-pressed={filter === value}
            className="capitalize"
          >
            {value}
          </Button>
        ))}
      </div>

      {error ? (
        <div className="surface-card mt-4 p-4">
          <p className="text-sm text-critical">{error}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Check your network and press Refresh. No transaction data was fabricated.
          </p>
        </div>
      ) : null}

      {loading && items.length === 0 ? (
        <div className="surface-card mt-4 flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Reading Sui Testnet activity…
        </div>
      ) : items.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon={Receipt} title="No activity yet" description={emptyDescription} />
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((item) =>
            item.direction === "sent" ? (
              <li key={`sent:${item.receipt.receiptId}`}>
                <Link
                  to="/receipt/$receiptId"
                  params={{ receiptId: item.receipt.receiptId }}
                  className="surface-card flex items-center justify-between gap-3 p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                      <ArrowUpRight className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">Sent to {item.receipt.merchantName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {new Date(item.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold">
                      −{item.receipt.tokenAmount.toFixed(6)} {item.receipt.tokenType}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      RM{item.receipt.approxMyr.toFixed(2)}
                    </p>
                  </div>
                </Link>
              </li>
            ) : (
              <li key={`received:${item.payment.activityId}`}>
                <a
                  href={explorerTxUrl(item.payment.transactionDigest)}
                  target="_blank"
                  rel="noreferrer"
                  className="surface-card flex items-center justify-between gap-3 p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                      <ArrowDownLeft className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1 text-sm font-semibold">
                        Payment received <ExternalLink className="h-3.5 w-3.5" />
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        From {shortAddress(item.payment.payerAddress, 8, 6)} ·{" "}
                        {new Date(item.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-success">
                      +{item.payment.tokenAmount.toFixed(6)} {item.payment.tokenType}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      RM{item.payment.approxMyr.toFixed(2)}
                    </p>
                  </div>
                </a>
              </li>
            ),
          )}
        </ul>
      )}
    </AppShell>
  );
}
