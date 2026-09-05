import { ArrowRight, Loader2, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";
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

const EXAMPLES = ["Pay RM12 to Kopitiam Seri Damai", "Bayar Olive's RM9.90", "campus cafe 5"];

const MAX_ALTERNATIVES = 5;

const formatMyr = (amount: number) => `RM${amount.toFixed(2)}`;

export function AiAssistantTab({ onOpenIntent }: AiAssistantTabProps) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<AiParsedIntent | null>(null);
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
        setMessage(trimmed);
      })
      .catch((caught: unknown) => {
        setParsed(null);
        setError(caught instanceof Error ? caught.message : "The assistant is unavailable.");
      })
      .finally(() => setBusy(false));
  };

  const review = (request: AiPaymentRequestSummary) =>
    onOpenIntent({
      v: 1,
      type: "suisure.payment-intent",
      network: SUI_CONFIG.network,
      paymentIntentId: request.paymentIntentId,
      merchantObjectId: request.merchantObjectId,
    });

  const chooseMerchant = (merchant: VerifiedMerchant) =>
    interpret(
      parsed?.amount !== undefined
        ? `Pay ${formatMyr(parsed.amount)} to ${merchant.name}`
        : `Pay ${merchant.name}`,
    );

  return (
    <div className="surface-card p-4">
      <p className="text-sm text-muted-foreground">
        Describe the payment in plain language. The assistant reads it, SuiSure looks the merchant
        up on {SUI_CONFIG.networkLabel}, and you review the merchant's real on-chain request. It can
        never sign or send a payment.
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
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Interpret request"}
      </Button>

      {error ? (
        <div className="mt-4 flex items-start gap-2 rounded-2xl bg-critical/10 p-4 text-sm text-critical">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      {parsed ? (
        <AssistantResult parsed={parsed} onReview={review} onChooseMerchant={chooseMerchant} />
      ) : null}
    </div>
  );
}

interface AssistantResultProps {
  parsed: AiParsedIntent;
  onReview: (request: AiPaymentRequestSummary) => void;
  onChooseMerchant: (merchant: VerifiedMerchant) => void;
}

function AssistantResult({ parsed, onReview, onChooseMerchant }: AssistantResultProps) {
  const blocked = parsed.nextStep === "blocked";
  const highlightId = parsed.matchedRequest?.paymentIntentId;

  return (
    <div className="mt-4 rounded-2xl bg-muted/50 p-4">
      <div className="flex items-start gap-2">
        {blocked ? (
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-critical" />
        ) : (
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" />
        )}
        <p className="text-sm">{parsed.explanation}</p>
      </div>
      {parsed.clarificationQuestion ? (
        <p className="mt-2 text-sm font-medium text-warning">{parsed.clarificationQuestion}</p>
      ) : null}

      {parsed.nextStep === "review" && parsed.matchedRequest ? (
        <Button className="mt-4 w-full" size="lg" onClick={() => onReview(parsed.matchedRequest!)}>
          Continue to review
          <ArrowRight className="h-4 w-4" />
        </Button>
      ) : null}

      {parsed.nextStep === "choose-merchant" && parsed.merchantCandidates.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {parsed.merchantCandidates.map((merchant) => (
            <li key={merchant.objectId}>
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => onChooseMerchant(merchant)}
              >
                <span className="truncate">{merchant.name}</span>
                <span className="text-xs text-muted-foreground">{merchant.category}</span>
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
              // A matched request is the answer; a handful of alternatives is
              // context, twenty is noise.
              .slice(
                0,
                parsed.nextStep === "review" ? MAX_ALTERNATIVES : parsed.openRequests.length,
              )
              .map((request) => (
                <li key={request.paymentIntentId}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-xl border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                    onClick={() => onReview(request)}
                  >
                    <span className="min-w-0">
                      <span className="font-semibold">{formatMyr(request.amountMyr)}</span>
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

      <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
        <Sparkles className="h-3 w-3" />
        {parsed.source === "model"
          ? `Read by ${parsed.model ?? "the model"} · confidence ${(parsed.confidence * 100).toFixed(0)}%`
          : "Read by the offline fallback, no model ran"}
        {" · "}merchant and amount verified on {SUI_CONFIG.networkLabel}
      </p>
      {parsed.assistantNote && parsed.source === "model" ? (
        <p className="mt-1 text-xs text-muted-foreground/80">
          Assistant read: {parsed.assistantNote}
        </p>
      ) : null}
      <p className="mt-1 text-xs text-muted-foreground">
        You must review and confirm every payment in your wallet.
      </p>
    </div>
  );
}
