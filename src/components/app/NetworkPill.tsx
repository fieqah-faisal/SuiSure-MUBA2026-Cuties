import { Globe, WifiOff } from "lucide-react";

import { SUI_CONFIG } from "@/config/sui";
import { useSession } from "@/hooks/useSession";
import { cn } from "@/lib/utils";

export function NetworkPill({ className }: { className?: string }) {
  const { networkStatus } = useSession();
  const ok = networkStatus === "online";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        ok ? "bg-success-soft text-success" : "bg-warning-soft text-warning-foreground",
        className,
      )}
    >
      {ok ? <Globe className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      {ok ? SUI_CONFIG.networkLabel : `Network ${networkStatus}`}
    </span>
  );
}
