import { createDAppKit } from "@mysten/dapp-kit-react";
import { SuiGrpcClient } from "@mysten/sui/grpc";

import { SUI_CONFIG } from "@/config/sui";

export const dAppKit = createDAppKit({
  networks: ["testnet"],
  defaultNetwork: "testnet",

  createClient: (network) =>
    new SuiGrpcClient({
      network,
      baseUrl: SUI_CONFIG.grpcUrl,
    }),
});

declare module "@mysten/dapp-kit-react" {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}