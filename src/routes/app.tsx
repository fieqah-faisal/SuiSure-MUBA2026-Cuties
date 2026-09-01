import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  ArrowUpRight,
  ChevronRight,
  MessageSquareText,
  QrCode,
  Store,
  Upload,
} from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import { BalanceWidget } from "@/components/app/BalanceWidget";
import { EmptyState } from "@/components/app/EmptyState";
import { OnboardingDialog } from "@/components/app/OnboardingDialog";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";
import { merchantService } from "@/services/merchant/merchant.service";
import { paymentService } from "@/services/payments/payment.service";
import type { PaymentReceipt, VerifiedMerchant } from "@/types/domain";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Your SuiSure wallet" },
      {
        name: "description",
        content:
          "Check your Sui Testnet balance, pay verified merchants by QR or plain language, and review recent activity.",
      },
      { property: "og:title", content: "Your SuiSure wallet" },
      {
        property: "og:description",
        content: "Scan, upload or ask to pay verified merchants on Sui Testnet.",
      },
    ],
  }),
  component: CustomerDashboard,
});

function CustomerDashboard() {
  const { account, balance, balanceToken, isMerchant, viewMode, setViewMode } = useSession();
  const [receipts, setReceipts] = useState<PaymentReceipt[] | null>(null);
  const [merchants, setMerchants] = useState<VerifiedMerchant[]>([]);

  useEffect(() => {
    void paymentService.listReceipts().then(setReceipts);
    void merchantService.listVerifiedMerchants().then(setMerchants);
  }, []);

  return (
    <AppShell>
      <OnboardingDialog />

      <BalanceWidget
        balance={balance}
        balanceToken={balanceToken}
        address={account?.address}
        displayName={account?.displayName}
      />

      <section className="mt-5 grid grid-cols-4 gap-2">
        {[
          { to: "/pay" as const, label: "Scan", icon: QrCode, search: { tab: "scan" as const } },
          { to: "/pay" as const, label: "Upload", icon: Upload, search: { tab: "upload" as const } },
          { to: "/pay" as const, label: "Ask AI", icon: MessageSquareText, search: { tab: "ai" as const } },
          { to: "/activity" as const, label: "Activity", icon: Activity, search: undefined },
        ].map((action) => (
          <Link
            key={action.label}
            to={action.to}
            {...(action.search ? { search: action.search } : {})}
            className="flex flex-col items-center gap-2 text-center transition-transform active:scale-95"
          >
            <span
              className={
                action.label === "Scan"
                  ? "flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-card)]"
                  : "flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card text-foreground"
              }
            >
              <action.icon className="h-5 w-5" />
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">{action.label}</span>
          </Link>
        ))}
      </section>



      {isMerchant ? (
        <section className="surface-card mt-5 flex items-center justify-between p-4">
          <div>
            <p className="text-sm font-semibold">
              {viewMode === "merchant" ? "Merchant Dashboard" : "Personal Wallet"}
            </p>
            <p className="text-xs text-muted-foreground">
              Verified merchant credential found on Sui.
            </p>
          </div>
          <Button
            asChild
            variant="outline"
            size="sm"
            onClick={() => setViewMode(viewMode === "merchant" ? "customer" : "merchant")}
          >
            <Link to="/merchant">Merchant Mode</Link>
          </Button>
        </section>
      ) : (
        <Link
          to="/merchant/apply"
          className="surface-card mt-5 flex items-center justify-between p-4"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Store className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">Apply as Merchant</p>
              <p className="text-xs text-muted-foreground">Accept SuiSure payments at your shop.</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      )}

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Verified merchants</h2>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {merchants.map((m) => (
            <Link
              key={m.objectId}
              to="/pay"
              search={{ tab: "ai" as const }}
              className="surface-card flex w-28 shrink-0 flex-col items-center gap-2 p-3 text-center"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-navy text-xs font-bold text-navy-foreground">
                {m.logoInitials}
              </span>
              <span className="line-clamp-2 text-[11px] font-medium">{m.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">Recent activity</h2>
          <Link to="/activity" className="text-xs font-semibold text-primary">
            See all
          </Link>
        </div>
        {receipts && receipts.length === 0 ? (
          <EmptyState
            icon={QrCode}
            title="No payments yet"
            description="Your SuiSure payments will appear here once you pay a verified merchant."
            action={
              <Button asChild size="sm">
                <Link to="/pay" search={{ tab: "scan" as const }}>
                  Make Your First Payment
                </Link>
              </Button>
            }
          />
        ) : (
          <ul className="space-y-2">
            {(receipts ?? []).slice(0, 4).map((r) => (
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
                    <p
                      className={
                        r.status === "confirmed"
                          ? "text-xs font-medium text-success"
                          : "text-xs font-medium text-critical"
                      }
                    >
                      {r.status}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
            {!receipts ? (
              <li className="surface-card h-16 animate-pulse bg-muted/40" aria-hidden />
            ) : null}
          </ul>
        )}
      </section>

      <Link
        to="/pay"
        search={{ tab: "scan" as const }}
        className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-primary"
      >
        Start a payment <ArrowUpRight className="h-4 w-4" />
      </Link>
    </AppShell>
  );
}
