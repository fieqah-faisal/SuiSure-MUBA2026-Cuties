import { Eye, EyeOff, Fuel } from "lucide-react";
import { useState } from "react";
import { SUI_CONFIG, shortAddress } from "@/config/sui";

export function BalanceWidget({
  balance,
  balanceToken,
  gasBalance,
  address,
  displayName,
}: {
  balance: number;
  balanceToken: string;
  gasBalance: number;
  address?: string | undefined;
  displayName?: string | undefined;
}) {
  const [hidden, setHidden] = useState(false);
  return (
    <div className="surface-card relative overflow-hidden rounded-3xl p-5">
      <div className="pointer-events-none absolute inset-x-0 -top-24 h-56 bg-[radial-gradient(35rem_16rem_at_50%_0%,color-mix(in_oklab,var(--primary)_22%,transparent),transparent_70%)]" />
      <div className="relative z-10 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Spendable Testnet balance
        </span>
        <button
          type="button"
          aria-label={hidden ? "Show balance" : "Hide balance"}
          onClick={() => setHidden((value) => !value)}
          className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground"
        >
          {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <div className="relative z-10 mt-4 flex items-baseline gap-2">
        <span className="text-5xl font-bold tracking-tighter text-card-foreground">
          {hidden ? "••••" : balance.toFixed(4)}
        </span>
        <span className="text-xl font-semibold text-muted-foreground">{balanceToken}</span>
      </div>
      <div className="relative z-10 mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-success-soft px-2.5 py-1 font-semibold text-success">
          Live on {SUI_CONFIG.networkLabel}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1">
          <Fuel className="h-3.5 w-3.5" />
          Gas {gasBalance.toFixed(4)} SUI
        </span>
      </div>
      <p className="relative z-10 mt-3 font-mono text-xs text-muted-foreground">
        {address ? shortAddress(address, 8, 6) : ""}
        {displayName ? ` · ${displayName}` : ""}
      </p>
    </div>
  );
}
