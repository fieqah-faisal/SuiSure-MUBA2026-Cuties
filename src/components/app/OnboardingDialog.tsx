import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { persistence } from "@/services/storage/persistence.service";

const STEPS = [
  {
    title: "Pay verified merchants only",
    body: "SuiSure checks every payment request against merchant credentials registered on Sui Testnet before you can confirm.",
  },
  {
    title: "Scan, upload or just ask",
    body: "Scan a QR code, upload a QR image, or describe the payment in plain language. The assistant only prepares a draft.",
  },
  {
    title: "You always confirm",
    body: "The AI assistant can never sign or send a transaction. Nothing leaves your wallet until you review and confirm.",
  },
] as const;

export function OnboardingDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const seen = persistence.read<boolean>("onboarding", false);
    if (!seen) setOpen(true);
  }, []);

  const finish = () => {
    persistence.write("onboarding", true);
    setOpen(false);
  };

  const current = STEPS[step]!;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : finish())}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <DialogTitle>{current.title}</DialogTitle>
          <DialogDescription>{current.body}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <span
              key={s.title}
              className={
                i === step ? "h-1.5 w-6 rounded-full bg-primary" : "h-1.5 w-1.5 rounded-full bg-muted"
              }
            />
          ))}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={finish}>
            Skip
          </Button>
          <Button
            size="sm"
            onClick={() => (step === STEPS.length - 1 ? finish() : setStep(step + 1))}
          >
            {step === STEPS.length - 1 ? "Get started" : "Next"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
