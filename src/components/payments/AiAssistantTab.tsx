import {
  ArrowRight,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SUI_CONFIG } from "@/config/sui";
import { aiAssistantService } from "@/services/ai-assistant/ai.service";
import type {
  AiParsedIntent,
  AiPaymentRequestSummary,
  PaymentIntentQRPayload,
  VerifiedMerchant,
} from "@/types/domain";

/**
 * The "Ask" tab: one sentence in, a reviewable on-chain request out.
 *
 * The assistant never signs, never submits and never carries an address. Every
 * path out of this panel goes to the same `ReviewStage` the QR flow uses,
 * with the same two IDs a QR carries, so the on-chain checks run exactly as
 * they would for a scanned code.
 */

interface AiAssistantTabProps {
  onOpenIntent: (payload: PaymentIntentQRPayload) => void;
}

const EXAMPLES = [
  "Pay RM12 to Kopitiam Seri Damai",
  "Bayar Olive's RM9.90",
  "campus cafe 5",
];

const MAX_ALTERNATIVES = 5;

const formatMyr = (amount: number) => `RM${amount.toFixed(2)}`;

const shortIdentifier = (value: string) =>
  value.length > 24 ? `${value.slice(0, 12)}…${value.slice(-8)}` : value;

export function AiAssistantTab({ onOpenIntent }: AiAssistantTabProps) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<AiParsedIntent | null>(null);
  const [selectedRequest, setSelectedRequest] =
    useState<AiPaymentRequestSummary | null>(null);
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const interpret = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    void aiAssistantService
      .interpret(trimmed)
      .then((result) => {
        setParsed(result);
        setSelectedRequest(result.matchedRequest ?? null);
        setAssessmentOpen(true);
        setMessage(trimmed);
      })
      .catch((caught: unknown) => {
        setParsed(null);
        setSelectedRequest(null);
        setAssessmentOpen(false);
        setError(
          caught instanceof Error
            ? caught.message
            : "The assistant is unavailable.",
        );
      })
      .finally(() => setBusy(false));
  };

  const review = (request: AiPaymentRequestSummary) => {
    setAssessmentOpen(false);
    onOpenIntent({
      v: 1,
      type: "suisure.payment-intent",
      network: SUI_CONFIG.network,
      paymentIntentId: request.paymentIntentId,
      merchantObjectId: request.merchantObjectId,
    });
  };

  const openAssessment = (request?: AiPaymentRequestSummary) => {
    setSelectedRequest(request ?? parsed?.matchedRequest ?? null);
    setAssessmentOpen(true);
  };

  const chooseMerchant = (merchant: VerifiedMerchant) =>
    interpret(
      parsed?.amount !== undefined
        ? `Pay ${formatMyr(parsed.amount)} to ${merchant.name}`
        : `Pay ${merchant.name}`,
    );

  return (
    <div className="surface-card p-4">
      <p className="text-sm text-muted-foreground">
        Describe the payment in plain language. The assistant reads it, SuiSure
        looks the merchant up on {SUI_CONFIG.networkLabel}, and you review the
        merchant's real on-chain request. It can never sign or send a payment.
      </p>
      <Textarea
        className="mt-3"
        rows={3}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            interpret(message);
          }
        }}
        placeholder={EXAMPLES[0]}
        maxLength={280}
        aria-label="Describe the payment"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
            disabled={busy}
            onClick={() => interpret(example)}
          >
            {example}
          </button>
        ))}
      </div>
      <Button
        className="mt-3 w-full"
        disabled={!message.trim() || busy}
        onClick={() => interpret(message)}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          "Interpret request"
        )}
      </Button>

      {error ? (
        <div className="mt-4 flex items-start gap-2 rounded-2xl bg-critical/10 p-4 text-sm text-critical">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      {parsed ? (
        <AssistantResult
          parsed={parsed}
          onChooseMerchant={chooseMerchant}
          onOpenAssessment={openAssessment}
        />
      ) : null}

      {parsed && assessmentOpen ? (
        <AssistantAssessmentRobot
          parsed={parsed}
          request={selectedRequest}
          onCancel={() => setAssessmentOpen(false)}
          onReview={review}
        />
      ) : null}
    </div>
  );
}

interface AssistantResultProps {
  parsed: AiParsedIntent;
  onChooseMerchant: (merchant: VerifiedMerchant) => void;
  onOpenAssessment: (request?: AiPaymentRequestSummary) => void;
}

function AssistantResult({
  parsed,
  onChooseMerchant,
  onOpenAssessment,
}: AssistantResultProps) {
  const blocked = parsed.nextStep === "blocked";
  const highlightId = parsed.matchedRequest?.paymentIntentId;

  return (
    <div className="mt-4 rounded-2xl bg-muted/50 p-4">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => onOpenAssessment()}
      >
        <span className="flex min-w-0 items-center gap-2">
          {blocked ? (
            <ShieldAlert className="h-5 w-5 shrink-0 text-critical" />
          ) : (
            <ShieldCheck className="h-5 w-5 shrink-0 text-success" />
          )}
          <span>
            <span className="block text-sm font-medium">
              {blocked
                ? "The assistant blocked this request"
                : parsed.nextStep === "review"
                  ? "AI and Sui checks found a matching request"
                  : "The assistant needs your selection"}
            </span>
            <span className="block text-xs text-muted-foreground">
              View assessment and explanation
            </span>
          </span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {parsed.nextStep === "choose-merchant" &&
      parsed.merchantCandidates.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {parsed.merchantCandidates.map((merchant) => (
            <li key={merchant.objectId}>
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => onChooseMerchant(merchant)}
              >
                <span className="truncate">{merchant.name}</span>
                <span className="text-xs text-muted-foreground">
                  {merchant.category}
                </span>
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {(parsed.nextStep === "choose-request" || parsed.nextStep === "review") &&
      parsed.openRequests.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground">
            {parsed.nextStep === "review"
              ? `Other open requests from ${parsed.merchant?.name ?? "this merchant"}`
              : `Open on-chain requests from ${parsed.merchant?.name ?? "this merchant"}`}
          </p>
          <ul className="mt-2 space-y-2">
            {parsed.openRequests
              .filter((request) => request.paymentIntentId !== highlightId)
              .slice(
                0,
                parsed.nextStep === "review"
                  ? MAX_ALTERNATIVES
                  : parsed.openRequests.length,
              )
              .map((request) => (
                <li key={request.paymentIntentId}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-xl border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                    onClick={() => onOpenAssessment(request)}
                  >
                    <span className="min-w-0">
                      <span className="font-semibold">
                        {formatMyr(request.amountMyr)}
                      </span>
                      {request.description ? (
                        <span className="ml-2 truncate text-muted-foreground">
                          {request.description}
                        </span>
                      ) : null}
                      {request.orderReference ? (
                        <span className="ml-2 font-mono text-xs text-muted-foreground">
                          {request.orderReference}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      Review
                      <ArrowRight className="h-3 w-3" />
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

interface AssistantAssessmentRobotProps {
  parsed: AiParsedIntent;
  request: AiPaymentRequestSummary | null;
  onCancel: () => void;
  onReview: (request: AiPaymentRequestSummary) => void;
}

function AssistantAssessmentRobot({
  parsed,
  request,
  onCancel,
  onReview,
}: AssistantAssessmentRobotProps) {
  const blocked = parsed.nextStep === "blocked";
  const ready = parsed.nextStep === "review" && request !== null;
  const status = blocked ? "Blocked" : ready ? "Low risk" : "Needs attention";
  const bubble = blocked
    ? "I stopped this request safely"
    : ready
      ? "I found a verified match"
      : request
        ? "Review this choice carefully"
        : "I need a little more detail";
  const statusColor = blocked
    ? "text-critical"
    : ready
      ? "text-success"
      : "text-warning";
  const dotColor = blocked
    ? "bg-critical"
    : ready
      ? "bg-success"
      : "bg-warning";
  const canContinue = request !== null && !blocked;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assistant-assessment-title"
    >
      <div className="my-4 w-full max-w-lg rounded-3xl border border-border bg-background p-5 shadow-float sm:p-7">
        <div className="mx-auto max-w-sm text-center">
          <div className="relative mx-auto mb-3 w-fit max-w-full rounded-2xl border border-border bg-card px-5 py-3 text-sm font-medium shadow-card">
            {bubble}
            <span className="ml-1 inline-block h-4 w-1 animate-pulse rounded-full bg-primary align-middle" />
            <span className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-border bg-card" />
          </div>

          <div className="mx-auto h-6 w-0.5 bg-primary" />
          <div className="payment-robot-antenna mx-auto h-3 w-3 rounded-full" />

          <div className="relative mx-auto mt-2 rounded-[2rem] bg-primary p-4 pt-14 shadow-float">
            <div className="absolute left-1/2 top-4 flex -translate-x-1/2 gap-10">
              <span className="payment-robot-eye h-6 w-3 rounded-full bg-primary-foreground" />
              <span className="payment-robot-eye h-6 w-3 rounded-full bg-primary-foreground [animation-delay:90ms]" />
            </div>

            <div className="rounded-2xl bg-slate-950 p-4 text-left text-slate-200 shadow-inner">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {blocked ? (
                    <ShieldAlert className="h-5 w-5 text-critical" />
                  ) : (
                    <ShieldCheck
                      className={`h-5 w-5 ${ready ? "text-success" : "text-warning"}`}
                    />
                  )}
                  <span className="text-xs uppercase tracking-wide text-slate-400">
                    Risk status
                  </span>
                </div>
                <span className={`text-sm font-semibold ${statusColor}`}>
                  {status}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-900 px-3 py-2">
                <span className="text-xs text-slate-400">
                  AI interpretation confidence
                </span>
                <span className="font-mono text-sm text-slate-100">
                  {(parsed.confidence * 100).toFixed(0)}%
                </span>
              </div>

              <div className="mt-3 flex gap-1.5" aria-hidden="true">
                {[1, 2, 3, 4].map((step) => (
                  <span
                    key={step}
                    className={`h-2 flex-1 rounded-full ${step <= (blocked ? 4 : ready ? 1 : 2) ? dotColor : "bg-slate-700"}`}
                  />
                ))}
              </div>

              <h2
                id="assistant-assessment-title"
                className="mt-4 text-sm font-semibold text-white"
              >
                What SuiSure found
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-300">
                {parsed.explanation}
              </p>

              {parsed.clarificationQuestion ? (
                <p className="mt-3 text-sm font-medium text-warning">
                  {parsed.clarificationQuestion}
                </p>
              ) : null}

              {request ? (
                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-white">
                        {formatMyr(request.amountMyr)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {request.description ?? "On-chain payment request"}
                      </p>
                    </div>
                    <span className="rounded-full bg-success/15 px-2 py-1 text-[0.65rem] font-medium text-success">
                      Found on Sui
                    </span>
                  </div>
                  {request.orderReference ? (
                    <p className="mt-2 font-mono text-xs text-slate-400">
                      {request.orderReference}
                    </p>
                  ) : null}
                  <p className="mt-2 font-mono text-[0.65rem] text-slate-500">
                    {shortIdentifier(request.paymentIntentId)}
                  </p>
                </div>
              ) : null}

              {parsed.assistantNote && parsed.source === "model" ? (
                <div className="mt-4 border-l-2 border-primary pl-3">
                  <p className="text-[0.65rem] uppercase tracking-wide text-slate-500">
                    AI interpretation
                  </p>
                  <p className="mt-1 text-xs text-slate-300">
                    {parsed.assistantNote}
                  </p>
                </div>
              ) : null}

              <div className="my-4 h-px bg-slate-800" />
              <ul className="space-y-2 text-xs text-slate-400">
                <li className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${parsed.merchant ? "bg-success" : "bg-warning"}`}
                  />
                  {parsed.merchant
                    ? `Merchant identity resolved against ${SUI_CONFIG.networkLabel}`
                    : `Merchant identity is not yet resolved on ${SUI_CONFIG.networkLabel}`}
                </li>
                <li className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${request ? "bg-success" : "bg-warning"}`}
                  />
                  {request
                    ? "Payment request selected from on-chain records"
                    : "No on-chain payment request selected"}
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  Final contract checks run again in payment review
                </li>
              </ul>

              <p className="mt-4 flex items-center gap-1 text-[0.65rem] text-slate-500">
                <Sparkles className="h-3 w-3" />
                {parsed.source === "model"
                  ? `Interpreted by ${parsed.model ?? "the configured model"}`
                  : "Offline fallback used; no model ran"}
              </p>
            </div>
          </div>

          {canContinue ? (
            <Button
              className="mt-5 w-full"
              size="lg"
              onClick={() => {
                if (request) onReview(request);
              }}
            >
              Continue to payment review
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : null}
          <Button className="mt-2 w-full" variant="outline" onClick={onCancel}>
            {blocked ? "Return and edit request" : "Cancel"}
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            AI explains the request. Sui remains the source of truth, and you
            make the final decision.
          </p>
        </div>
      </div>
    </div>
  );
}
