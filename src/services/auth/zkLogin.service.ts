import { SUI_CONFIG } from "@/config/sui";
import type { SuiAccount } from "@/types/domain";

export type AuthProvider = "google" | "wallet";

export interface ZkLoginService {
  signInWithProvider(provider: AuthProvider): Promise<SuiAccount>;
  signOut(): Promise<void>;
  isMock(): boolean;
}

const MOCK_ADDRESS = "0xa17c94f0be2d31856cfa0b74d9e2137ac6f0b581";

/**
 * zkLogin adapter.
 *
 * Real zkLogin requires an OAuth flow, a salt service and a Sui prover.
 * Until those are provisioned this adapter runs in a clearly labelled mock
 * mode. It never fabricates a production zkLogin proof.
 */
export const zkLoginService: ZkLoginService = {
  async signInWithProvider(provider) {
    if (!SUI_CONFIG.mockMode) {
      throw new Error(
        "zkLogin live mode is not configured. Provide an OAuth client, salt service and prover endpoint.",
      );
    }
    await new Promise((r) => setTimeout(r, 900));
    return {
      address: MOCK_ADDRESS,
      provider: provider === "wallet" ? "wallet" : "google",
      displayName: provider === "wallet" ? "Sui Wallet User" : "Syafieqah",
      email: provider === "google" ? "user@example.com" : undefined,
    };
  },
  async signOut() {
    await new Promise((r) => setTimeout(r, 150));
  },
  isMock: () => SUI_CONFIG.mockMode,
};
