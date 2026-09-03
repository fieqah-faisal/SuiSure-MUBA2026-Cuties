import { Link, createFileRoute } from "@tanstack/react-router";
import { Receipt } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import { EmptyState } from "@/components/app/EmptyState";
import { paymentService } from "@/services/payments/payment.service";
import { useSession } from "@/hooks/useSession";
import type { PaymentReceipt } from "@/types/domain";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Payment activity | SuiSure" },
      {
        name: "description",
        content: "Review every SuiSure payment you made on Sui Testnet, with onchain receipts.",
      },
      { property: "og:title", content: "Payment activity | SuiSure" },
      { property: "og:description", content: "Your SuiSure payment history and receipts." },
    ],
  }),
  component: ActivityPage,
});

function ActivityPage() {
  const { account } = useSession();
  const [receipts, setReceipts] = useState<PaymentReceipt[] | null>(null);

  useEffect(() => {
    void paymentService.listReceipts(account?.address).then(setReceipts);
  }, [account?.address]);

  return (
    <AppShell title="Activity">
      <h1 className="text-xl font-semibold">Activity</h1>
      {receipts && receipts.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={Receipt}
            title="No activity yet"
            description="Payments you make to verified merchants will show up here."
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {(receipts ?? []).map((r) => (
            <li key={r.receiptId}>
              <Link
                to="/receipt/$receiptId"
                params={{ receiptId: r.receiptId }}
                className="surface-card flex items-center justify-between p-4"
              >
                <div>
                  <p className="text-sm font-semibold">{r.merchantName}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.timestamp).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">RM{r.approxMyr.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.tokenAmount.toFixed(4)} {r.tokenType}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
