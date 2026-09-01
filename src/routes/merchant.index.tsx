import { createFileRoute } from "@tanstack/react-router";
import { Loader2, QrCode } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SUI_CONFIG, shortAddress } from "@/config/sui";
import { useSession } from "@/hooks/useSession";
import { paymentService } from "@/services/payments/payment.service";
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
      { property: "og:description", content: "Create payment requests and QR codes on Sui Testnet." },
    ],
  }),
  component: MerchantDashboard,
});

function MerchantDashboard() {
  const { credential } = useSession();
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [creating, setCreating] = useState(false);
  const [intents, setIntents] = useState<PaymentIntent[]>([]);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!credential) return;
    void paymentService.listMerchantIntents(credential.objectId).then(setIntents);
  }, [credential]);

  const createRequest = async () => {
    if (!credential) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a valid amount in MYR.");
      return;
    }
    setError(null);
    setCreating(true);
    try {
      const intent = await paymentService.createPaymentIntent({
        merchantObjectId: credential.objectId,
        amountMyr: value,
        ...(reference ? { orderReference: reference } : {}),
        expiryMinutes: 15,
      });
      setIntents((prev) => [intent, ...prev]);
      const QRCode = (await import("qrcode")).default;
      setQr(await QRCode.toDataURL(JSON.stringify(paymentService.encodeQrPayload(intent))));
      setAmount("");
      setReference("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

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
        <h2 className="text-sm font-semibold">New payment request</h2>
        <div>
          <Label htmlFor="amount">Amount (MYR)</Label>
          <Input
            id="amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="12.00"
          />
        </div>
        <div>
          <Label htmlFor="ref">Order reference (optional)</Label>
          <Input
            id="ref"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="INV-1042"
          />
        </div>
        {error ? <p className="text-sm text-critical">{error}</p> : null}
        <Button className="w-full" onClick={() => void createRequest()} disabled={creating}>
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create request and QR"}
        </Button>
        {qr ? (
          <div className="flex flex-col items-center gap-2 pt-2">
            <img src={qr} alt="Payment request QR code" className="h-48 w-48 rounded-2xl" />
            <p className="text-xs text-muted-foreground">Show this QR to your customer.</p>
          </div>
        ) : null}
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Payment requests</h2>
        {intents.length === 0 ? (
          <div className="surface-card flex flex-col items-center gap-2 p-8 text-center">
            <QrCode className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No requests yet.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {intents.map((i) => (
              <li key={i.objectId} className="surface-card flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-semibold">RM{i.amountMyr.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    {i.orderReference ?? shortAddress(i.objectId, 8, 4)}
                  </p>
                </div>
                <span className="text-xs font-medium text-muted-foreground">{i.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
