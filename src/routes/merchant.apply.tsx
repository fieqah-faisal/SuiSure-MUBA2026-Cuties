import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/hooks/useSession";
import { merchantService } from "@/services/merchant/merchant.service";

export const Route = createFileRoute("/merchant/apply")({
  head: () => ({
    meta: [
      { title: "Apply as a merchant | SuiSure" },
      {
        name: "description",
        content:
          "Submit your business details to receive a verified merchant credential on Sui Testnet.",
      },
      { property: "og:title", content: "Apply as a merchant | SuiSure" },
      { property: "og:description", content: "Become a verified SuiSure merchant." },
    ],
  }),
  component: MerchantApply,
});

function MerchantApply() {
  const { account } = useSession();
  const [form, setForm] = useState({
    businessName: "",
    category: "",
    registrationNumber: "",
    contactEmail: "",
    receivingAddress: account?.address ?? "",
  });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await merchantService.submitApplication({ ...form, consent });
      setResult(`Application ${res.reference} is ${res.status.replace("-", " ")}.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell title="Merchant application">
      <h1 className="text-xl font-semibold">Apply as a merchant</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Verification is issued onchain. Submitting an application does not grant merchant access.
      </p>

      <section className="surface-card mt-5 space-y-3 p-5">
        <Field id="businessName" label="Business name" value={form.businessName} onChange={set("businessName")} />
        <Field id="category" label="Category" value={form.category} onChange={set("category")} />
        <Field
          id="registrationNumber"
          label="Business registration number"
          value={form.registrationNumber}
          onChange={set("registrationNumber")}
        />
        <Field
          id="contactEmail"
          label="Contact email"
          value={form.contactEmail}
          onChange={set("contactEmail")}
        />
        <Field
          id="receivingAddress"
          label="Receiving Sui address"
          value={form.receivingAddress}
          onChange={set("receivingAddress")}
        />

        <label className="flex items-start gap-2 pt-1 text-sm">
          <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
          <span className="text-muted-foreground">
            I confirm these details are accurate and consent to onchain verification.
          </span>
        </label>

        {error ? <p className="text-sm text-critical">{error}</p> : null}
        {result ? <p className="text-sm text-success">{result}</p> : null}

        <Button className="w-full" disabled={busy || !consent} onClick={() => void submit()}>
          {busy ? "Submitting…" : "Submit application"}
        </Button>
      </section>
    </AppShell>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
