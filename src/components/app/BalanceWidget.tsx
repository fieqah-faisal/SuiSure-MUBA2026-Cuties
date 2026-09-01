import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Eye, EyeOff, TrendingUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { SUI_CONFIG, shortAddress } from "@/config/sui";
import { MOCK_RATE_MYR_PER_SUI } from "@/services/mocks/data";
import { cn } from "@/lib/utils";

type Denomination = "SUI" | "MYR";

const chartPath =
  "M 0 120 C 50 110, 80 120, 130 85 C 170 55, 210 70, 260 35 C 290 15, 320 20, 320 20";
const fillPath = `${chartPath} L 320 160 L 0 160 Z`;

export function BalanceWidget({
  balance,
  balanceToken,
  address,
  displayName,
}: {
  balance: number;
  balanceToken: string;
  address?: string | undefined;
  displayName?: string | undefined;
}) {
  const [denom, setDenom] = useState<Denomination>("SUI");
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState("1W");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const myr = balance * MOCK_RATE_MYR_PER_SUI;
  const isMyr = denom === "MYR";
  const symbol = isMyr ? "RM" : balanceToken;
  const value = isMyr ? myr : balance;
  const [whole, decimals] = (
    isMyr
      ? value.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : value.toFixed(4)
  ).split(".");

  return (
    <div className="surface-card relative overflow-hidden rounded-3xl p-5">
      <div className="pointer-events-none absolute inset-x-0 -top-24 h-56 bg-[radial-gradient(35rem_16rem_at_50%_0%,color-mix(in_oklab,var(--primary)_22%,transparent),transparent_70%)]" />

      <div className="relative z-10 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Total balance · {denom}
          <button
            type="button"
            aria-label={hidden ? "Show balance" : "Hide balance"}
            onClick={() => setHidden((v) => !v)}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </span>

        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-card-foreground transition-colors hover:bg-muted/50"
          >
            {denom}
            <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="h-3 w-3 opacity-70" />
            </motion.span>
          </button>

          <AnimatePresence>
            {open ? (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute right-0 top-full z-50 mt-2 w-32 rounded-xl border border-border bg-popover p-1 shadow-md"
              >
                {(["SUI", "MYR"] as Denomination[]).map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      setDenom(code);
                      setOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-popover-foreground transition-colors hover:bg-muted"
                  >
                    <span>{code}</span>
                    {denom === code ? <Check className="h-3 w-3 text-primary" /> : null}
                  </button>
                ))}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <div className="relative z-10 mt-4 flex items-baseline gap-1">
        <span className="text-2xl font-semibold text-muted-foreground">{symbol}</span>
        <motion.span
          key={`${denom}-${hidden}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl font-bold tracking-tighter text-card-foreground"
        >
          {hidden ? "••••" : whole}
        </motion.span>
        {!hidden && decimals ? (
          <span className="text-2xl font-semibold text-muted-foreground">.{decimals}</span>
        ) : null}
      </div>

      <div className="relative z-10 mt-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-semibold text-success">
          <TrendingUp className="h-3 w-3" />
          Live on {SUI_CONFIG.networkLabel}
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {address ? shortAddress(address, 8, 6) : ""}
        </span>
        {displayName ? (
          <span className="text-xs text-muted-foreground">· {displayName}</span>
        ) : null}
      </div>

      <div className="relative z-0 mt-4 h-28">
        <svg
          viewBox="0 0 320 160"
          className="h-full w-full text-primary"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="suisureFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <motion.path
            key={`fill-${denom}-${range}`}
            d={fillPath}
            fill="url(#suisureFill)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.1 }}
          />
          <motion.path
            key={`chart-${denom}-${range}`}
            d={chartPath}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: "easeInOut" }}
          />
        </svg>
      </div>

      <div className="relative z-10 mt-3 flex gap-2">
        {["1H", "1D", "1W", "1M", "1Y"].map((period) => (
          <button
            key={period}
            type="button"
            onClick={() => setRange(period)}
            className={cn(
              "flex-1 rounded-lg py-1.5 text-[11px] font-bold transition-colors",
              period === range
                ? "bg-primary text-primary-foreground"
                : "bg-muted/40 text-muted-foreground hover:text-foreground",
            )}
          >
            {period}
          </button>
        ))}
      </div>
    </div>
  );
}
