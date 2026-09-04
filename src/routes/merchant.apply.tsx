import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Copy, ExternalLink, ShieldCheck, Store } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { explorerObjectUrl, shortAddress } from "@/config/sui";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/merchant/apply")({
  head: () => ({
    meta: [
      { title: "Merchant registration | SuiSure" },
      {
        name: "description",
        content: "Learn how administrator-approved SuiSure merchant credentials are issued.",
      },
      { property: "og:title", content: "Merchant registration | SuiSure" },
      {
        property: "og:description",
        content: "Administrator-issued merchant verification on Sui Testnet.",
      },
    ],
  }),
  component: MerchantRegistration,
});

function MerchantRegistration() {
  const { account, credential } = useSession();
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    if (!account?.address) return;
    await navigator.clipboard.writeText(account.address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  };

  return (
    <AppShell title="Merchant registration">
      <h1 className="text-xl font-semibold">Merchant registration</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        SuiSure merchant access is granted by an administrator-issued credential on Sui Testnet.
      </p>

      {credential ? (
        <section className="surface-card mt-5 p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-base font-semibold">Merchant credential active</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {credential.merchantName} is registered and linked to your connected wallet.
          </p>
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            {shortAddress(credential.objectId, 12, 10)}
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button asChild className="flex-1">
              <Link to="/merchant">Open merchant dashboard</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <a href={explorerObjectUrl(credential.objectId)} target="_blank" rel="noreferrer">
                View credential <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </section>
      ) : (
        <>
          <section className="surface-card mt-5 p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Store className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-base font-semibold">Administrator approval required</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              For this Testnet prototype, provide your business name, category and connected wallet
              address to the SuiSure administrator. The administrator verifies the request and calls
              the protected Move registration function using the AdminCap.
            </p>

            <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-4">
              <p className="text-xs font-medium text-muted-foreground">Connected wallet</p>
              <p className="mt-1 break-all font-mono text-xs">{account?.address}</p>
              <Button className="mt-3 w-full" variant="outline" onClick={() => void copyAddress()}>
                {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Address copied" : "Copy wallet address"}
              </Button>
            </div>
          </section>

          <section className="surface-card mt-4 p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" />
              <div>
                <h2 className="text-sm font-semibold">Why registration is controlled</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Only the AdminCap holder can issue or deactivate merchant credentials. Business
                  registration numbers and contact emails are intentionally not stored on-chain.
                </p>
              </div>
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}
