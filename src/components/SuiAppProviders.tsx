import { DAppKitProvider } from "@mysten/dapp-kit-react";
import type { ReactNode } from "react";

import { dAppKit } from "@/config/dapp-kit";
import { SessionProvider } from "@/hooks/useSession";

export default function SuiAppProviders({ children }: { children: ReactNode }) {
  return (
    <DAppKitProvider dAppKit={dAppKit}>
      <SessionProvider>{children}</SessionProvider>
    </DAppKitProvider>
  );
}
