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
  /**
   * gRPC endpoint. Use this one.
   *
   * JSON-RPC is deprecated and already returns -32601 "Method not found" on
   * public testnet fullnodes, not just mainnet. Anything built on
   * @mysten/sui/jsonRpc will fail.
   */
  grpcUrl: "https://fullnode.testnet.sui.io:443",
  /** @deprecated JSON-RPC is disabled on public fullnodes. Use grpcUrl. */
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
  registryId: "0x3291fba65f6b24c4790727042b7198be9b0be43e3b88694a330cd4ad644e1691" as string,
  /** RegistryAdminCap object ID returned alongside the registry. Step 2. */
  registryAdminCapId:
    "0x51307731279cfe0c9a8d324bce95d15d48a03c20a1b6c1ba0f24fea78c96b631" as string,
  /**
   * suisure::payments package ID.
   *
   * One ID, not two. An earlier deployment was upgraded, which split calls
   * (latest ID) from type identity (whichever version first defined each
   * struct). The republish that added coin_type defines every struct in this
   * one version, so both uses collapse back to this single value. If the
   * package is ever upgraded again, types defined before that upgrade keep
   * reporting this ID while newly added ones report the upgraded ID, and
   * isSuiSureType in src/services/sui/client.ts will need both.
   */
  packageId: "0xac4bbcadef19c4687a75bda3afa31e069473e8824d43d771f7c5c36fee1dd445" as string,
  /** AdminCap object ID minted to the deployer at publish. Steps 3 and 6. */
  adminCapId: "0x86c3aa4eba5ed7a26be369546037189dfdd7bae6999dd6434c5528e592c8742f" as string,
  /**
   * UpgradeCap for the package. Losing it means the package can never be
   * upgraded, only republished under a new ID.
   */
  upgradeCapId: "0xd26f7d957bf698eeeff291a720df444a6090a86e9d0bd4648ae2ec9a8241d2c0" as string,
  /**
   * A completed end-to-end payment on testnet, proving the whole flow:
   * 2.553191 USDC (RM12.00) from the payer to Kopitiam Seri Damai's
   * registered payout address, via payment_kit. Step 6.
   */
  sampleTxDigest: "FhtaB57tHhv5nrxKhQP4o1miyjhykFLYKDD6BCP3oQcw" as string,
  /**
   * Shared MerchantCredential object IDs for the demo merchants, in order:
   *   [0] Kopitiam Seri Damai — Food & Beverage
   *   [1] Campus Cafe         — Food & Beverage
   * Steps 3 and 6.
   */
  merchantCredentialIds: [
    "0x73ffe36c370cd0e768e85f59e3c53eba557a3ccc123992d8062f2cbcc063d68f",
    "0xe0b13c411e139c254e8752f2bd4084d20f2767a31cca3cdeff47ad2175d234b3",
  ] as string[],
} as const;

export const explorerTxUrl = (digest: string) => `${SUI_CONFIG.explorerBaseUrl}/tx/${digest}`;

export const explorerObjectUrl = (objectId: string) =>
  `${SUI_CONFIG.explorerBaseUrl}/object/${objectId}`;

export const shortAddress = (address: string, lead = 6, tail = 4) =>
  address.length <= lead + tail + 2 ? address : `${address.slice(0, lead)}…${address.slice(-tail)}`;
