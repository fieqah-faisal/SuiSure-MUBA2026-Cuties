import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect } from "react";

import { SuiSureLogo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";

const GoogleZkLoginOption = lazy(() => import("@/components/GoogleZkLoginOption"));
const WalletConnectOption = lazy(() => import("@/components/WalletConnectOption"));

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in to SuiSure" },
      {
        name: "description",
        content:
          "Sign in with Google zkLogin or connect a self-custodial wallet to pay verified merchants on Sui Testnet.",
      },
      { property: "og:title", content: "Sign in to SuiSure" },
      {
        property: "og:description",
        content: "Use Google zkLogin or your Sui wallet for verified Testnet payments.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { account, ready } = useSession();
  const navigate = useNavigate();

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
          Use your Google account for passwordless zkLogin, or connect a Sui wallet. Only you can
          approve payments.
        </p>

        <div className="mt-6 space-y-3">
          <Suspense
            fallback={
              <Button size="lg" className="w-full" disabled>
                Preparing Google sign-in…
              </Button>
            }
          >
            <GoogleZkLoginOption />
          </Suspense>
          <Button size="lg" variant="outline" className="w-full" disabled>
            Continue with Apple (coming soon)
          </Button>
          <Button size="lg" variant="outline" className="w-full" disabled>
            Continue with Facebook (coming soon)
          </Button>
          <Suspense
            fallback={
              <Button size="lg" className="w-full" disabled>
                Loading wallets…
              </Button>
            }
          >
            <WalletConnectOption />
          </Suspense>
        </div>

        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
          By continuing you agree to the SuiSure Terms of Service and Privacy Notice. Google sign-in
          creates a self-custodial Sui account using zkLogin. Wallet connections use Sui Wallet
          Standard.
        </p>
      </main>
    </div>
  );
}
