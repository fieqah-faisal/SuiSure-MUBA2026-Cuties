import suisureMark from "@/assets/suisure-mark.png";
import { cn } from "@/lib/utils";

export function SuiSureMark({ className }: { className?: string }) {
  return (
    <img
      src={suisureMark}
      alt=""
      aria-hidden="true"
      className={cn("block h-7 w-7 object-contain", className)}
    />
  );
}

export function SuiSureLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 leading-none", className)}>
      <SuiSureMark />
      <span className="text-base font-bold tracking-tight text-foreground">
        Sui<span className="text-primary">Sure</span>
      </span>
    </span>
  );
}
