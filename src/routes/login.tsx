import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertCircle, Loader2, Wallet } from "lucide-react";
import { useEffect, useState } from "react";

import { SuiSureLogo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { SUI_CONFIG } from "@/config/sui";
import { useSession } from "@/hooks/useSession";
import type { AuthProvider } from "@/services/auth/zkLogin.service";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in to SuiSure" },
      {
        name: "description",
        content:
          "Sign in to SuiSure with zkLogin to create a self-custodial Sui account and pay verified merchants safely.",
      },
      { property: "og:title", content: "Sign in to SuiSure" },
      {
        property: "og:description",
        content: "Create a self-custodial Sui account through your familiar login.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { account, signIn, ready } = useSession();
  const navigate = useNavigate();
  const [pending, setPending] = useState<AuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && account) void navigate({ to: "/app" });
  }, [ready, account, navigate]);

  const handle = async (provider: AuthProvider) => {
    setError(null);
    setPending(provider);
    try {
      await signIn(provider);
      await navigate({ to: "/app" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed. Please try again.");
    } finally {
      setPending(null);
    }
  };

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
          A self-custodial Sui account is created through your familiar login. SuiSure cannot
          approve payments without you.
        </p>

        {error ? (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2 rounded-xl bg-critical-soft px-4 py-3 text-sm text-critical"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          <Button
            size="lg"
            className="w-full"
            disabled={pending !== null}
            onClick={() => void handle("google")}
          >
            {pending === "google" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Continue with Google
          </Button>
          <Button size="lg" variant="outline" className="w-full" disabled>
            Continue with Apple (coming soon)
          </Button>
          <Button size="lg" variant="outline" className="w-full" disabled>
            Continue with Facebook (coming soon)
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="w-full"
            disabled={pending !== null}
            onClick={() => void handle("wallet")}
          >
            {pending === "wallet" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Wallet className="mr-2 h-4 w-4" />
            )}
            Connect Sui Wallet (developer)
          </Button>
        </div>

        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
          By continuing you agree to the SuiSure Terms of Service and Privacy Notice. Authentication
          uses Sui zkLogin.{" "}
          {SUI_CONFIG.mockMode ? "zkLogin currently runs in mock mode for development." : null}
        </p>
      </main>
    </div>
  );
}
