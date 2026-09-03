import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Camera, Loader2, MessageSquareText, ShieldAlert, ShieldCheck, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import { AppShell } from "@/components/app/AppShell";
import { FileUploader } from "@/components/ui/file-uploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs12 } from "@/components/ui/tabs-12";
import type { Tabs12Service } from "@/components/ui/tabs-12";
import { Textarea } from "@/components/ui/textarea";
import { SUI_CONFIG, shortAddress } from "@/config/sui";
import { useSession } from "@/hooks/useSession";
import { usePaymentExecution } from "@/hooks/usePaymentExecution";
import { aiAssistantService } from "@/services/ai-assistant/ai.service";
import { paymentService } from "@/services/payments/payment.service";
import type {
  AiParsedIntent,
  PaymentIntent,
  PaymentIntentQRPayload,
  RiskAssessment,
} from "@/types/domain";

const searchSchema = z.object({
  tab: z.enum(["scan", "upload", "ai"]).default("scan"),
  intent: z.string().optional(),
  merchant: z.string().optional(),
});

export const Route = createFileRoute("/pay")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Pay a verified merchant | SuiSure" },
      {
        name: "description",
        content:
          "Scan a QR code, upload a QR image or describe your payment. SuiSure verifies the merchant on Sui Testnet before you confirm.",
      },
      { property: "og:title", content: "Pay a verified merchant | SuiSure" },
      {
        property: "og:description",
        content: "Verified merchant checks on Sui Testnet before every payment.",
      },
    ],
  }),
  component: PayPage,
});

function PayPage() {
  const { tab, intent: intentId, merchant: merchantObjectId } = Route.useSearch();
  const navigate = useNavigate();

  if (intentId && merchantObjectId) {
    return (
      <ReviewStage
        payload={{
          v: 1,
          type: "suisure.payment-intent",
          network: SUI_CONFIG.network,
          paymentIntentId: intentId,
          merchantObjectId,
        }}
      />
    );
  }
  if (intentId) {
    return (
      <AppShell title="Invalid payment request">
        <p className="surface-card p-6 text-sm text-critical">
          The payment link is missing its merchant credential. Scan the complete SuiSure QR again.
        </p>
      </AppShell>
    );
  }

  const services: Tabs12Service[] = [
    { name: "Scan", value: "scan", icon: Camera, content: <ScanTab /> },
    { name: "Upload", value: "upload", icon: Upload, content: <UploadTab /> },
    { name: "Ask", value: "ai", icon: MessageSquareText, content: <AiTab /> },
  ];

  return (
    <AppShell title="Pay">
      <h1 className="text-xl font-semibold">Pay a verified merchant</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every request is checked against Sui Testnet merchant credentials.
      </p>

      <Tabs12
        value={tab}
        onValueChange={(value) =>
          void navigate({
            to: "/pay",
            search: { tab: value as "scan" | "upload" | "ai" },
          })
        }
        services={services}
        className="mt-5"
      />
    </AppShell>
  );
}

function useOpenIntent() {
  const navigate = useNavigate();
  return (payload: PaymentIntentQRPayload) =>
    void navigate({
      to: "/pay",
      search: {
        tab: "scan" as const,
        intent: payload.paymentIntentId,
        merchant: payload.merchantObjectId,
      },
    });
}

function ScanTab() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const openIntent = useOpenIntent();
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => () => stopRef.current?.(), []);

  const start = async () => {
    setError(null);
    setScanning(true);
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader();
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current ?? undefined,
        (result) => {
          if (!result) return;
          try {
            const payload = paymentService.decodeQrPayload(result.getText());
            stopRef.current?.();
            setScanning(false);
            openIntent(payload);
          } catch (e) {
            setError((e as Error).message);
          }
        },
      );
      stopRef.current = () => controls.stop();
    } catch {
      setScanning(false);
      setError("Camera unavailable. Try uploading a QR image instead.");
    }
  };

  return (
    <div className="surface-card p-4">
      <div className="aspect-square w-full overflow-hidden rounded-2xl bg-muted">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
      </div>
      {error ? <p className="mt-3 text-sm text-critical">{error}</p> : null}
      <Button className="mt-4 w-full" onClick={() => void start()} disabled={scanning}>
        {scanning ? "Scanning…" : "Start camera"}
      </Button>
      <Button
        className="mt-2 w-full"
        variant="outline"
        disabled={scanning || loadingDemo}
        onClick={() => {
          setLoadingDemo(true);
          setError(null);
          void paymentService
            .getAvailableDemoQrPayload()
            .then(openIntent)
            .catch((e: Error) => setError(e.message))
            .finally(() => setLoadingDemo(false));
        }}
      >
        {loadingDemo ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load Testnet demo request"}
      </Button>
    </div>
  );
}

function UploadTab() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const openIntent = useOpenIntent();

  const onFile = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const url = URL.createObjectURL(file);
      const result = await new BrowserQRCodeReader().decodeFromImageUrl(url);
      URL.revokeObjectURL(url);
      const payload = paymentService.decodeQrPayload(result.getText());
      openIntent(payload);
    } catch (e) {
      setError((e as Error).message || "Could not read a QR code from that image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <FileUploader
      title="Upload payment QR"
      description="Upload a screenshot or photo containing a SuiSure payment QR code."
      accept="image/*"
      maxFiles={1}
      maxSizeMB={10}
      acceptedLabel="PNG, JPG, HEIC · up to 10 MB"
      submitLabel={busy ? "Reading QR…" : "Read QR code"}
      cancelLabel="Discard"
      footerNote="Verified against Sui Testnet merchants"
      busy={busy}
      error={error}
      onSubmit={(files) => {
        const file = files[0];
        if (file) void onFile(file);
      }}
      onCancel={() => setError(null)}
    />
  );
}

function AiTab() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<AiParsedIntent | null>(null);

  return (
    <div className="surface-card p-4">
      <p className="text-sm text-muted-foreground">
        Describe the payment, for example “Pay RM12 to Kopitiam Delight”. The assistant only
        prepares a draft — it can never sign or send a payment.
      </p>
      <Textarea
        className="mt-3"
        rows={3}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Pay RM12 to Kopitiam Delight"
      />
      <Button
        className="mt-3 w-full"
        disabled={!message.trim() || busy}
        onClick={() => {
          setBusy(true);
          void aiAssistantService
            .interpret(message)
            .then(setParsed)
            .finally(() => setBusy(false));
        }}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Interpret request"}
      </Button>

      {parsed ? (
        <div className="mt-4 rounded-2xl bg-muted/50 p-4">
          <p className="text-sm">{parsed.explanation}</p>
          {parsed.clarificationQuestion ? (
            <p className="mt-2 text-sm font-medium text-warning">{parsed.clarificationQuestion}</p>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            Confidence {(parsed.confidence * 100).toFixed(0)}% · You must review and confirm every
            payment.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ReviewStage({ payload }: { payload: PaymentIntentQRPayload }) {
  const { account } = useSession();
  const { executePayment, connectedAddress, readyToPay } = usePaymentExecution();
  const navigate = useNavigate();
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void paymentService
      .getPaymentIntentFromQr({
        v: 1,
        type: "suisure.payment-intent",
        network: SUI_CONFIG.network,
        paymentIntentId: payload.paymentIntentId,
        merchantObjectId: payload.merchantObjectId,
      })
      .then(async (i) => {
        if (cancelled) return;
        setIntent(i);
        if (!connectedAddress)
          throw new Error("Connect your Sui wallet before reviewing this payment.");
        const assessment = await paymentService.verifyPaymentIntent(i, {
          payerAddress: connectedAddress,
        });
        if (!cancelled) setRisk(assessment);
      })
      .catch((e: Error) => setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [payload.paymentIntentId, payload.merchantObjectId, connectedAddress]);

  const blocked = !risk || risk.level === "blocked" || risk.level === "high";

  return (
    <AppShell title="Review payment">
      {error ? (
        <div className="surface-card p-6 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-critical" />
          <p className="mt-3 text-sm">{error}</p>
          <Button className="mt-4" variant="outline" onClick={() => void navigate({ to: "/app" })}>
            Back home
          </Button>
        </div>
      ) : !intent || !risk ? (
        <div className="surface-card h-48 animate-pulse bg-muted/40" />
      ) : (
        <>
          <section className="surface-card p-5">
            <p className="text-xs text-muted-foreground">Paying</p>
            <h1 className="text-lg font-semibold">{intent.merchantName}</h1>
            <p className="text-xs text-muted-foreground">{intent.merchantCategory}</p>
            <p className="mt-4 text-3xl font-bold">RM{intent.amountMyr.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">
              ≈ {intent.tokenAmount.toFixed(4)} {intent.tokenType} · {SUI_CONFIG.networkLabel}
            </p>
            <p className="mt-3 font-mono text-xs text-muted-foreground">
              To {shortAddress(intent.recipientAddress, 10, 6)}
            </p>
          </section>

          <section className="surface-card mt-4 p-5">
            <div className="flex items-center gap-2">
              {risk.level === "low" ? (
                <ShieldCheck className="h-5 w-5 text-success" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-critical" />
              )}
              <p className="text-sm font-medium">{risk.summary}</p>
            </div>
            <ul className="mt-4 space-y-2">
              {risk.checks.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-3 text-sm">
                  <span className={c.passed ? "" : "text-critical"}>{c.label}</span>
                  <span className={c.passed ? "text-success" : "text-critical"}>
                    {c.passed ? "Pass" : "Fail"}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <Button
            className="mt-5 w-full"
            size="lg"
            disabled={blocked || paying || !account || !readyToPay}
            onClick={() => {
              if (!account || !readyToPay) return;
              setPaying(true);
              void executePayment(intent)
                .then((receipt) => {
                  void navigate({
                    to: "/receipt/$receiptId",
                    params: { receiptId: receipt.receiptId },
                  });
                })
                .catch((e: Error) => setError(e.message))
                .finally(() => setPaying(false));
            }}
          >
            {paying
              ? "Confirm in wallet…"
              : !readyToPay
                ? "Connect Testnet wallet to pay"
                : blocked
                  ? "Payment blocked"
                  : "Confirm and pay"}
          </Button>
          <Button
            className="mt-2 w-full"
            variant="ghost"
            onClick={() => void navigate({ to: "/pay", search: { tab: "scan" as const } })}
          >
            Cancel
          </Button>
        </>
      )}
    </AppShell>
  );
}
