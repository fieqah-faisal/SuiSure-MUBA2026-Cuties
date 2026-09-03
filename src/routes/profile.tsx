import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut, ShieldCheck, Trash2 } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SUI_CONFIG, shortAddress } from "@/config/sui";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your profile | SuiSure" },
      {
        name: "description",
        content: "Manage your SuiSure account, Sui Testnet address, merchant status and local data.",
      },
      { property: "og:title", content: "Your profile | SuiSure" },
      { property: "og:description", content: "Account, network and merchant settings." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const {
    account,
    isMerchant,
    devMerchantOverride,
    setDevMerchantOverride,
    signOut,
    clearLocalData,
  } = useSession();
  const navigate = useNavigate();

  return (
    <AppShell title="Profile">
      <h1 className="text-xl font-semibold">Profile</h1>

      <section className="surface-card mt-4 p-5">
        <p className="text-sm font-semibold">{account?.displayName}</p>
        {account?.email ? (
          <p className="text-xs text-muted-foreground">{account.email}</p>
        ) : null}
        <p className="mt-3 font-mono text-xs text-muted-foreground">
          {account ? shortAddress(account.address, 10, 8) : ""}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {SUI_CONFIG.networkLabel} · {account?.provider === "wallet" ? "connected wallet" : "signed in with zkLogin"}
        </p>
      </section>

      <section className="surface-card mt-4 flex items-center justify-between p-5">
        <div>
          <p className="text-sm font-semibold">Merchant credential</p>
          <p className="text-xs text-muted-foreground">
            {isMerchant ? "Verified merchant on Sui Testnet." : "No merchant credential found."}
          </p>
        </div>
        {isMerchant ? (
          <ShieldCheck className="h-5 w-5 text-success" />
        ) : (
          <Button asChild size="sm" variant="outline">
            <Link to="/merchant/apply">Apply</Link>
          </Button>
        )}
      </section>

      <section className="surface-card mt-4 flex items-center justify-between p-5">
        <div>
          <p className="text-sm font-semibold">Developer merchant mode</p>
          <p className="text-xs text-muted-foreground">
            Simulate holding a merchant credential while testing.
          </p>
        </div>
        <Switch checked={devMerchantOverride} onCheckedChange={setDevMerchantOverride} />
      </section>

      <div className="mt-5 space-y-2">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => void signOut().then(() => navigate({ to: "/login" }))}
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
        <Button
          variant="ghost"
          className="w-full text-critical"
          onClick={() => {
            clearLocalData();
            void navigate({ to: "/" });
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Clear local data
        </Button>
      </div>
    </AppShell>
  );
}
