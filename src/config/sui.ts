import type { SuiNetwork } from "@/types/domain";

/**
 * Central Sui configuration module.
 *
 * The application targets Sui Testnet. Blockchain access is expressed through
 * typed service interfaces so that a real Sui client (@mysten/sui + dApp Kit)
 * can be wired in without changing UI code.
 */
export const SUI_CONFIG = {
  network: "testnet" as SuiNetwork,
  networkLabel: "Sui Testnet",
  rpcUrl: "https://fullnode.testnet.sui.io:443",
  explorerBaseUrl: "https://suiscan.xyz/testnet",
  defaultToken: "SUI",
  /**
   * Mock mode: no real Sui RPC calls are made and payments are simulated
   * locally. Live mode requires the Sui service adapters to be implemented.
   */
  mockMode: true,
} as const;

export const explorerTxUrl = (digest: string) =>
  `${SUI_CONFIG.explorerBaseUrl}/tx/${digest}`;

export const explorerObjectUrl = (objectId: string) =>
  `${SUI_CONFIG.explorerBaseUrl}/object/${objectId}`;

export const shortAddress = (address: string, lead = 6, tail = 4) =>
  address.length <= lead + tail + 2
    ? address
    : `${address.slice(0, lead)}…${address.slice(-tail)}`;
