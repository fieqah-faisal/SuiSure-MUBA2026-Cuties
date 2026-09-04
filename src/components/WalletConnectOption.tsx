import { isEnokiWallet } from "@mysten/enoki";
import { useDAppKit, useWalletConnection, useWallets } from "@mysten/dapp-kit-react";
import { Check, ExternalLink, LogOut, Wallet } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function WalletConnectOption() {
  const dAppKit = useDAppKit();
  const wallets = useWallets();
  const connection = useWalletConnection();
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [error, setError] = useState<string>();

  const externalWallets = useMemo(
    () => wallets.filter((wallet) => !isEnokiWallet(wallet)),
    [wallets],
  );
  const busy = connection.status === "connecting" || connection.status === "reconnecting";
  const address = connection.status === "connected" ? connection.account.address : undefined;
  const connectedWallet = connection.status === "connected" ? connection.wallet : undefined;

  async function connect(wallet: (typeof wallets)[number]) {
    setError(undefined);
    try {
      await dAppKit.connectWallet({ wallet });
      setWalletDialogOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Wallet connection failed.");
    }
  }

  return (
    <>
      <Button
        size="lg"
        className="w-full"
        disabled={busy}
        onClick={() => {
          setError(undefined);
          if (address) setAccountDialogOpen(true);
          else setWalletDialogOpen(true);
        }}
      >
        <Wallet className="h-5 w-5" />
        {busy
          ? "Connecting…"
          : address
            ? `${address.slice(0, 6)}…${address.slice(-4)}`
            : "Connect Wallet"}
      </Button>

      <Dialog open={walletDialogOpen} onOpenChange={setWalletDialogOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Choose a Sui wallet</DialogTitle>
            <DialogDescription>Select an installed wallet or Slush web wallet.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {externalWallets.length ? (
              externalWallets.map((wallet, index) => (
                <Button
                  key={`${wallet.name}-${index}`}
                  variant="outline"
                  className="h-12 w-full justify-start gap-3"
                  disabled={busy}
                  onClick={() => void connect(wallet)}
                >
                  {wallet.icon ? (
                    <img src={wallet.icon} alt="" className="h-6 w-6 rounded-md" />
                  ) : null}
                  <span>{wallet.name}</span>
                </Button>
              ))
            ) : (
              <div className="rounded-xl border border-border p-4 text-sm">
                <p className="font-medium text-foreground">No compatible Sui wallet found</p>
                <p className="mt-1 text-muted-foreground">
                  Install a Sui Wallet Standard-compatible extension or continue with Slush web
                  wallet.
                </p>
                <a
                  href="https://slush.app"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  Open Slush <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Connected account</DialogTitle>
            <DialogDescription>Manage the Sui account used by SuiSure.</DialogDescription>
          </DialogHeader>

          {connectedWallet && connection.status === "connected" ? (
            <div className="space-y-4">
              <div className="flex w-full min-w-0 items-start gap-3 rounded-xl border border-border p-3">
                {connectedWallet.icon ? (
                  <img src={connectedWallet.icon} alt="" className="h-9 w-9 rounded-lg" />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <Wallet className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{connectedWallet.name}</p>
                  <p className="mt-1 break-all whitespace-normal font-mono text-xs leading-relaxed text-muted-foreground">
                    {address}
                  </p>
                </div>
              </div>

              {connectedWallet.accounts.length > 1 ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Switch account
                  </p>
                  <div className="space-y-2">
                    {connectedWallet.accounts.map((account) => {
                      const selected = account.address === address;
                      return (
                        <Button
                          key={account.address}
                          type="button"
                          variant="outline"
                          className="h-12 w-full justify-between"
                          onClick={() => {
                            if (!selected) dAppKit.switchAccount({ account });
                            setAccountDialogOpen(false);
                          }}
                        >
                          <span className="min-w-0 truncate font-mono text-sm">
                            {account.label ||
                              `${account.address.slice(0, 8)}…${account.address.slice(-6)}`}
                          </span>
                          {selected ? <Check className="h-4 w-4 shrink-0 text-success" /> : null}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <Button
                type="button"
                variant="outline"
                className="w-full border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  setAccountDialogOpen(false);
                  void dAppKit.disconnectWallet();
                }}
              >
                <LogOut className="h-4 w-4" />
                Disconnect account
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
