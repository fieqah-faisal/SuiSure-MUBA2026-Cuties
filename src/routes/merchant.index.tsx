import { createFileRoute } from "@tanstack/react-router";
import { Download, ExternalLink, Loader2, QrCode, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SUI_CONFIG, explorerObjectUrl, explorerTxUrl, shortAddress } from "@/config/sui";
import { useMerchantIntentCreation } from "@/hooks/useMerchantIntentCreation";
import { useSession } from "@/hooks/useSession";
import { paymentService } from "@/services/payments/payment.service";
import { TESTNET_MYR_PER_USDC, testnetUsdcForMyr } from "@/services/sui/create-intent";
import type { PaymentIntent } from "@/types/domain";

export const Route = createFileRoute("/merchant/")({
  head: () => ({
    meta: [
      { title: "Merchant dashboard | SuiSure" },
      {
        name: "description",
        content:
          "Create Sui Testnet payment requests, generate QR codes and track incoming SuiSure payments.",
      },
      { property: "og:title", content: "Merchant dashboard | SuiSure" },
      {
        property: "og:description",
        content: "Create payment requests and QR codes on Sui Testnet.",
      },
    ],
  }),
  component: MerchantDashboard,
});

interface DisplayedQr {
  dataUrl: string;
  intent: PaymentIntent;
}

function MerchantDashboard() {
  const { credential } = useSession();
  const {
    createIntent,
    phase,
    error: creationError,
    reset: resetCreation,
    ready: readyToCreate,
  } = useMerchantIntentCreation();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [expiryMinutes, setExpiryMinutes] = useState("30");
  const [intents, setIntents] = useState<PaymentIntent[]>([]);
  const [qr, setQr] = useState<DisplayedQr | null>(null);
  const [qrBusyId, setQrBusyId] = useState<string | null>(null);
  const [loadingIntents, setLoadingIntents] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [createdDigest, setCreatedDigest] = useState<string | null>(null);

  const loadIntents = useCallback(async () => {
    if (!credential) return;
    setLoadingIntents(true);
    setListError(null);
    try {
      setIntents(await paymentService.listMerchantIntents(credential.objectId));
    } catch (caught) {
      setListError(
        caught instanceof Error ? caught.message : "Could not load the merchant's requests.",
      );
    } finally {
      setLoadingIntents(false);
    }
  }, [credential]);

  useEffect(() => {
    void loadIntents();
  }, [loadIntents]);

  const showQr = async (intent: PaymentIntent) => {
    setQrBusyId(intent.objectId);
    setListError(null);
    try {
      const QRCode = (await import("qrcode")).default;
      const dataUrl = await QRCode.toDataURL(
        JSON.stringify(paymentService.encodeQrPayload(intent)),
        { width: 512, margin: 2 },
      );
      setQr({ dataUrl, intent });
    } catch (caught) {
      setListError(caught instanceof Error ? caught.message : "Could not generate the QR code.");
    } finally {
      setQrBusyId(null);
    }
  };

  const createRequest = async () => {
    if (!credential) return;
    const amountMyr = Number(amount);
    const expiry = Number(expiryMinutes);
    setCreatedDigest(null);
    resetCreation();

    try {
      const created = await createIntent(credential, {
        amountMyr,
        description,
        orderReference: reference,
        expiryMinutes: expiry,
      });
      setIntents((previous) => [
        created.intent,
        ...previous.filter((item) => item.objectId !== created.intent.objectId),
      ]);
      await showQr(created.intent);
      setCreatedDigest(created.transactionDigest);
      setAmount("");
      setDescription("");
      setReference("");
    } catch {
      // The hook exposes a safe, user-facing error.
    }
  };

  const amountMyr = Number(amount);
  const estimatedUsdc =
    Number.isFinite(amountMyr) && amountMyr > 0 ? testnetUsdcForMyr(amountMyr) : null;
  const creating = phase === "preparing" || phase === "awaiting-wallet" || phase === "confirming";

  return (
    <AppShell title="Merchant" requireMerchant>
      <h1 className="text-xl font-semibold">Merchant dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {credential?.merchantName} · {SUI_CONFIG.networkLabel}
      </p>
      <p className="mt-1 font-mono text-xs text-muted-foreground">
        {credential ? shortAddress(credential.receivingAddress, 10, 6) : ""}
      </p>

      <section className="surface-card mt-5 space-y-3 p-5">
        <div>
          <h2 className="text-sm font-semibold">New on-chain payment request</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Your wallet signs the request. SuiSure never receives your private key.
          </p>
        </div>

        <div>
          <Label htmlFor="amount">Amount (MYR)</Label>
          <Input
            id="amount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              resetCreation();
            }}
            placeholder="12.00"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {estimatedUsdc === null
              ? `Demo rate: RM${TESTNET_MYR_PER_USDC.toFixed(2)} per Testnet USDC`
              : `≈ ${estimatedUsdc.toFixed(6)} Testnet USDC at the labelled demo rate`}
          </p>
        </div>

        <div>
          <Label htmlFor="description">Description (optional)</Label>
          <Input
            id="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Table 4 lunch"
          />
        </div>

        <div>
          <Label htmlFor="ref">Order reference (optional)</Label>
          <Input
            id="ref"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="OLIVE-1042"
          />
        </div>

        <div>
          <Label htmlFor="expiry">Expires after (minutes)</Label>
          <Input
            id="expiry"
            type="number"
            min={1}
            max={10_080}
            value={expiryMinutes}
            onChange={(event) => setExpiryMinutes(event.target.value)}
          />
        </div>

        {creationError ? <p className="text-sm text-critical">{creationError}</p> : null}
        {createdDigest ? (
          <a
            href={explorerTxUrl(createdDigest)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary"
          >
            Creation confirmed on Sui Explorer <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}

        <Button
          className="w-full"
          onClick={() => void createRequest()}
          disabled={creating || !readyToCreate}
        >
          {creating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {phase === "awaiting-wallet" ? "Confirm in wallet…" : "Creating on Sui…"}
            </>
          ) : (
            "Create request and QR"
          )}
        </Button>
      </section>

      {qr ? (
        <section className="surface-card mt-5 flex flex-col items-center gap-3 p-5 text-center">
          <div>
            <h2 className="text-sm font-semibold">Customer payment QR</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {qr.intent.merchantName} · RM{qr.intent.amountMyr.toFixed(2)} ·{" "}
              {qr.intent.tokenAmount.toFixed(6)} {qr.intent.tokenType}
            </p>
          </div>
          <img
            src={qr.dataUrl}
            alt={`Payment QR for ${qr.intent.merchantName}`}
            className="h-56 w-56 rounded-2xl bg-white p-2"
          />
          <p className="font-mono text-[11px] text-muted-foreground">
            {shortAddress(qr.intent.objectId, 12, 10)}
          </p>
          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <Button asChild className="flex-1">
              <a
                href={qr.dataUrl}
                download={`suisure-${qr.intent.orderReference ?? qr.intent.objectId}.png`}
              >
                <Download className="mr-2 h-4 w-4" /> Download QR
              </a>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <a href={explorerObjectUrl(qr.intent.objectId)} target="_blank" rel="noreferrer">
                View intent <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </section>
      ) : null}

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Payment requests</h2>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void loadIntents()}
            disabled={loadingIntents}
          >
            {loadingIntents ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>

        {listError ? <p className="mb-3 text-sm text-critical">{listError}</p> : null}

        {loadingIntents && intents.length === 0 ? (
          <div className="surface-card flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading requests from Sui Testnet…
          </div>
        ) : intents.length === 0 ? (
          <div className="surface-card flex flex-col items-center gap-2 p-8 text-center">
            <QrCode className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No on-chain requests found.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {intents.map((intent) => (
              <li
                key={intent.objectId}
                className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold">
                    RM{intent.amountMyr.toFixed(2)} · {intent.tokenAmount.toFixed(6)}{" "}
                    {intent.tokenType}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {intent.orderReference ?? shortAddress(intent.objectId, 8, 4)}
                    {intent.description ? ` · ${intent.description}` : ""}
                  </p>
                  <p
                    className={
                      intent.status === "pending"
                        ? "mt-1 text-xs font-medium text-success"
                        : intent.status === "expired" || intent.status === "failed"
                          ? "mt-1 text-xs font-medium text-critical"
                          : "mt-1 text-xs font-medium text-muted-foreground"
                    }
                  >
                    {intent.status}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void showQr(intent)}
                  disabled={qrBusyId === intent.objectId}
                >
                  {qrBusyId === intent.objectId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <QrCode className="h-4 w-4" />
                  )}
                  Show QR
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
