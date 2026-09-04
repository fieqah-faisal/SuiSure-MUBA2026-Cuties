import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { PaymentExecutionPhase } from "@/hooks/usePaymentExecution";

interface PaymentRobotProps {
  phase: PaymentExecutionPhase;
  intentId: string;
  transactionDigest?: string | null;
  error?: string | null;
  onDismiss?: () => void;
}

const phaseContent: Record<
  Exclude<PaymentExecutionPhase, "idle">,
  { bubble: string; detail: string; step: number }
> = {
  preparing: {
    bubble: "verifying every on-chain detail…",
    detail: "Building secure transaction bytes",
    step: 1,
  },
  "awaiting-wallet": {
    bubble: "authorizing with your account…",
    detail: "Signing with your connected Sui account",
    step: 2,
  },
  confirming: {
    bubble: "payment sent—checking Sui finality…",
    detail: "Confirming the transaction on Testnet",
    step: 3,
  },
  confirmed: {
    bubble: "confirmed on-chain. nice!",
    detail: "Your receipt is ready",
    step: 4,
  },
  failed: {
    bubble: "payment stopped safely",
    detail: "No local receipt was created",
    step: 0,
  },
};

const shortIdentifier = (value: string) =>
  value.length > 24 ? `${value.slice(0, 14)}…${value.slice(-8)}` : value;

const randomHex = () => Math.floor(Math.random() * 16).toString(16);

const scrambleIdentifier = () => `0x${Array.from({ length: 20 }, randomHex).join("")}…`;

export function PaymentRobot({
  phase,
  intentId,
  transactionDigest,
  error,
  onDismiss,
}: PaymentRobotProps) {
  const failed = phase === "failed";
  const confirmed = phase === "confirmed";
  const identifier = transactionDigest ?? intentId;
  const active = phase !== "idle" && !failed && !confirmed;
  const [animatedIdentifier, setAnimatedIdentifier] = useState(() => shortIdentifier(identifier));

  useEffect(() => {
    if (!active) {
      setAnimatedIdentifier(shortIdentifier(identifier));
      return;
    }

    setAnimatedIdentifier(scrambleIdentifier());
    const timer = window.setInterval(() => setAnimatedIdentifier(scrambleIdentifier()), 85);
    return () => window.clearInterval(timer);
  }, [active, identifier]);

  if (phase === "idle") return null;
  const content = phaseContent[phase];

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-progress-title"
    >
      <div className="w-full max-w-md rounded-3xl border border-border bg-background p-5 shadow-float sm:p-7">
        <div className="mx-auto max-w-xs text-center" role="status" aria-live="polite">
          <h2 id="payment-progress-title" className="sr-only">
            Payment progress
          </h2>

          <div className="relative mx-auto mb-3 w-fit max-w-full rounded-2xl border border-border bg-card px-5 py-3 text-sm font-medium shadow-card">
            {content.bubble}
            {!failed && !confirmed ? (
              <span className="ml-1 inline-block h-4 w-1 animate-pulse rounded-full bg-primary align-middle" />
            ) : null}
            <span className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-border bg-card" />
          </div>

          <div className="mx-auto h-6 w-0.5 bg-primary" />
          <div
            className={`mx-auto h-3 w-3 rounded-full ${
              failed ? "bg-critical" : confirmed ? "bg-success" : "payment-robot-antenna"
            }`}
          />

          <div className="relative mx-auto mt-2 max-w-[19rem] rounded-[2rem] bg-primary p-4 pt-14 shadow-float">
            <div className="absolute left-1/2 top-4 flex -translate-x-1/2 gap-10">
              <span className="payment-robot-eye h-6 w-3 rounded-full bg-primary-foreground" />
              <span className="payment-robot-eye h-6 w-3 rounded-full bg-primary-foreground [animation-delay:90ms]" />
            </div>

            <div className="rounded-2xl bg-slate-950 p-4 text-left text-slate-200 shadow-inner">
              <div className="flex items-center justify-between gap-3">
                <div className="flex gap-1.5" aria-hidden="true">
                  {[1, 2, 3, 4].map((step) => (
                    <span
                      key={step}
                      className={`h-3 w-3 rounded-full transition-colors duration-300 ${
                        failed
                          ? "bg-slate-600"
                          : step <= content.step
                            ? confirmed
                              ? "bg-success"
                              : "bg-primary"
                            : "bg-slate-600"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs text-slate-400">
                  {failed ? "stopped" : `step ${content.step}/4`}
                </span>
              </div>

              <p className={`mt-4 font-mono text-xs ${failed ? "text-critical" : "text-success"}`}>
                {animatedIdentifier}
              </p>
              <div className="my-3 h-px bg-slate-800" />
              <div className="flex items-center gap-2 text-xs text-slate-400">
                {confirmed ? <Check className="h-4 w-4 text-success" /> : null}
                {failed ? <X className="h-4 w-4 text-critical" /> : null}
                <span>{content.detail}</span>
              </div>
            </div>
          </div>

          {error ? <p className="mt-4 text-sm text-critical">{error}</p> : null}
          {failed && onDismiss ? (
            <Button className="mt-5 w-full" variant="outline" onClick={onDismiss}>
              Return to payment review
            </Button>
          ) : null}
          {!failed ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Keep this window open. This payment started only after your confirmation.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
