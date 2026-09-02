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

  /**
   * Deployment handoff values, owned by the Move lane and filled in as the
   * steps in MOVE_BUILD_PLAN.md complete. Every value is empty until it has
   * been read off testnet — never guess or invent one. Each is annotated
   * `as string` so it keeps a widened type once a real value lands here.
   */

  /** payment_kit package ID — owner of the testnet Namespace object's type. Step 1. */
  paymentKitPackageId:
    "0x7e069abe383e80d32f2aec17b3793da82aabc8c2edf84abbf68dd7b719e71497" as string,
  /** payment_kit Namespace object, the input to create_registry. Step 1. */
  paymentKitNamespaceId:
    "0xa5016862fdccba7cc576b56cc5a391eda6775200aaa03a6b3c97d512312878db" as string,
  /** Full Sui testnet USDC coin type, from Circle's official Sui docs. Step 1. */
  usdcCoinType:
    "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC" as string,
  /**
   * USDC has 6 decimals, not 9. SUI is the 9-decimal one (MIST). Anything
   * converting MYR to token units must read the decimals for the coin type
   * actually in play — assuming MIST for USDC is wrong by 1000x.
   */
  usdcDecimals: 6,
  /** PaymentRegistry object ID returned by create_registry. Step 2. */
  registryId: "" as string,
  /** RegistryAdminCap object ID returned alongside the registry. Step 2. */
  registryAdminCapId: "" as string,
  /** suisure::payments package ID. Changes on every republish. Steps 3 and 6. */
  packageId: "" as string,
  /** AdminCap object ID minted to the deployer at publish. Steps 3 and 6. */
  adminCapId: "" as string,
  /** Shared MerchantCredential object IDs for the demo merchants. Steps 3 and 6. */
  merchantCredentialIds: [] as string[],
} as const;

export const explorerTxUrl = (digest: string) =>
  `${SUI_CONFIG.explorerBaseUrl}/tx/${digest}`;

export const explorerObjectUrl = (objectId: string) =>
  `${SUI_CONFIG.explorerBaseUrl}/object/${objectId}`;

export const shortAddress = (address: string, lead = 6, tail = 4) =>
  address.length <= lead + tail + 2
    ? address
    : `${address.slice(0, lead)}…${address.slice(-tail)}`;
