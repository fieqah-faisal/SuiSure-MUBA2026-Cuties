import { createDAppKit } from "@mysten/dapp-kit-react";
import { enokiWalletsInitializer } from "@mysten/enoki";
import { SuiGrpcClient } from "@mysten/sui/grpc";

import { SUI_CONFIG } from "@/config/sui";

const enokiApiKey = import.meta.env["VITE_ENOKI_API_KEY"]?.trim() ?? "";
const googleClientId = import.meta.env["VITE_GOOGLE_CLIENT_ID"]?.trim() ?? "";

export const ENOKI_CONFIG = Object.freeze({
  apiKey: enokiApiKey,
  googleClientId,
  configured: Boolean(enokiApiKey && googleClientId),
});

const walletInitializers = ENOKI_CONFIG.configured
  ? [
      enokiWalletsInitializer({
        apiKey: ENOKI_CONFIG.apiKey,
        providers: {
          google: {
            clientId: ENOKI_CONFIG.googleClientId,
          },
        },
      }),
    ]
  : [];

export const dAppKit = createDAppKit({
  networks: ["testnet"],
  defaultNetwork: "testnet",
  walletInitializers,

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
