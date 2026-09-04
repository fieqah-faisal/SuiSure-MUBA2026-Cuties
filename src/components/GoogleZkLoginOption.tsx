import { isGoogleWallet } from "@mysten/enoki";
import { useDAppKit, useWalletConnection, useWallets } from "@mysten/dapp-kit-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { ENOKI_CONFIG } from "@/config/dapp-kit";

const readableGoogleError = (cause: unknown): string => {
  const message = cause instanceof Error ? cause.message : "Google sign-in failed.";
  if (/popup closed/i.test(message)) return "Google sign-in was cancelled.";
  if (/failed to open popup/i.test(message)) {
    return "Your browser blocked the Google sign-in window. Allow pop-ups for SuiSure and retry.";
  }
  if (/redirect_uri_mismatch/i.test(message)) {
    return "Google rejected this site URL. Check the authorized redirect URI for this environment.";
  }
  return message;
};

export default function GoogleZkLoginOption() {
  const dAppKit = useDAppKit();
  const wallets = useWallets();
  const connection = useWalletConnection();
  const [error, setError] = useState<string>();

  const googleWallet = useMemo(() => wallets.find(isGoogleWallet), [wallets]);
  const busy = connection.status === "connecting" || connection.status === "reconnecting";
  const preparing = ENOKI_CONFIG.configured && !googleWallet;

  async function signIn() {
    if (!googleWallet) {
      setError(
        ENOKI_CONFIG.configured
          ? "Google zkLogin is still loading. Please retry in a moment."
          : "Google zkLogin is not configured for this deployment.",
      );
      return;
    }

    setError(undefined);
    try {
      await dAppKit.connectWallet({ wallet: googleWallet });
    } catch (cause) {
      setError(readableGoogleError(cause));
    }
  }

  return (
    <div>
      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={!ENOKI_CONFIG.configured || preparing || busy}
        onClick={() => void signIn()}
      >
        {busy
          ? "Signing in with Google…"
          : preparing
            ? "Preparing Google sign-in…"
            : "Continue with Google"}
      </Button>
      {!ENOKI_CONFIG.configured ? (
        <p className="mt-2 text-xs text-destructive">
          Google zkLogin is unavailable because this deployment is missing its public configuration.
        </p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
