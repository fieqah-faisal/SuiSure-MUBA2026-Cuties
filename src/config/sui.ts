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
  /**
   * PaymentRegistry object ID, shared. Created as "suisure-testnet" against
   * the Namespace above. Step 2.
   *
   * Its `registry_managed_funds` config is false — the key is absent, and
   * payment_kit treats absent as false. That is what keeps us non-custodial:
   * process_registry_payment takes the else branch and does a direct
   * public_transfer to the merchant payout rather than collecting into the
   * registry. Do not set it true.
   */
  registryId:
    "0x3291fba65f6b24c4790727042b7198be9b0be43e3b88694a330cd4ad644e1691" as string,
  /** RegistryAdminCap object ID returned alongside the registry. Step 2. */
  registryAdminCapId:
    "0x51307731279cfe0c9a8d324bce95d15d48a03c20a1b6c1ba0f24fea78c96b631" as string,
  /**
   * Latest suisure::payments package ID — the one to call functions on.
   * Changes on every upgrade, so always read it from here.
   */
  packageId:
    "0x428e043100e7c4e6a0efed67a7b49f1537bd7bc25a58f6294832de7eda63713b" as string,
  /**
   * The first-published package ID, which never changes.
   *
   * Type identity is anchored to it, so every object created by any version
   * reports its type as `<originalPackageId>::payments::MerchantCredential`,
   * not the latest ID. Use this one when matching object types, filtering
   * events, or querying by type — and `packageId` when making move calls.
   * Mixing them up silently returns nothing.
   */
  originalPackageId:
    "0x0a855f30c0979bad86c200847ea61c6befafde3a4769d771c539a4031e980a00" as string,
  /** AdminCap object ID minted to the deployer at publish. Steps 3 and 6. */
  adminCapId:
    "0x2bf633f877f078e014a82940374242ddde81e23e4d42c657550c0096cb546264" as string,
  /**
   * UpgradeCap for the package. Losing it means the package can never be
   * upgraded, only republished under a new ID.
   */
  upgradeCapId:
    "0xf5488918e6932a74a31ed05837b6b9fdaed036b1106754bb20e9d2a59178c17b" as string,
  /**
   * Shared MerchantCredential object IDs for the demo merchants, in order:
   *   [0] Kopitiam Seri Damai — Food & Beverage
   *   [1] Campus Cafe         — Food & Beverage
   * Steps 3 and 6.
   */
  merchantCredentialIds: [
    "0x62152dd75cc21378c319741d75e114134fa2c7084c1e34bd6b75ff52bad338e0",
    "0xf8ed47fba2d595be870747c23f5684db8787d432372e3bed7d8ebd69fd2ef21a",
  ] as string[],
} as const;

export const explorerTxUrl = (digest: string) =>
  `${SUI_CONFIG.explorerBaseUrl}/tx/${digest}`;

export const explorerObjectUrl = (objectId: string) =>
  `${SUI_CONFIG.explorerBaseUrl}/object/${objectId}`;

export const shortAddress = (address: string, lead = 6, tail = 4) =>
  address.length <= lead + tail + 2
    ? address
    : `${address.slice(0, lead)}…${address.slice(-tail)}`;
