import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { SuiSureLogo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Connect to SuiSure" },
      {
        name: "description",
        content:
          "Connect a self-custodial Sui wallet to pay verified merchants safely on Sui Testnet.",
      },
      { property: "og:title", content: "Connect to SuiSure" },
      {
        property: "og:description",
        content: "Connect your Sui wallet to review and approve verified Testnet payments.",
      },
    ],
  }),
  component: LoginPage,
});

function WalletConnectOption() {
  return (
    <div className="suisure-wallet-connect">
      <ConnectButton
        className="suisure-wallet-connect-control"
        style={{ display: "block", width: "100%" }}
      />
    </div>
  );
}

function LoginPage() {
  const { account, signInWithWallet, ready } = useSession();
  const walletAccount = useCurrentAccount();
  const walletAddress = walletAccount?.address;
  const navigate = useNavigate();

  useEffect(() => {
    if (walletAddress) signInWithWallet(walletAddress);
  }, [walletAddress, signInWithWallet]);

  useEffect(() => {
    if (ready && account) void navigate({ to: "/app" });
  }, [ready, account, navigate]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto flex h-16 w-full max-w-md items-center justify-between px-5">
        <Link to="/">
          <SuiSureLogo />
        </Link>
        <span className="rounded-full bg-warning-soft px-2.5 py-1 text-[11px] font-semibold text-warning-foreground">
          Testnet
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-12">
        <h1 className="text-2xl font-bold tracking-tight text-navy">Sign in or create account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Connect a self-custodial Sui wallet. SuiSure cannot approve payments without you.
        </p>

        <div className="mt-6 space-y-3">
          <Button size="lg" className="w-full" disabled>
            Continue with Google (coming soon)
          </Button>
          <Button size="lg" variant="outline" className="w-full" disabled>
            Continue with Apple (coming soon)
          </Button>
          <Button size="lg" variant="outline" className="w-full" disabled>
            Continue with Facebook (coming soon)
          </Button>
          <WalletConnectOption />
        </div>

        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
          By continuing you agree to the SuiSure Terms of Service and Privacy Notice. Wallet
          connections use Sui Wallet Standard. Social zkLogin is coming soon.
        </p>
      </main>
    </div>
  );
}
