import { SuiGrpcClient } from "@mysten/sui/grpc";

import { SUI_CONFIG } from "@/config/sui";

/**
 * Shared Sui client.
 *
 * gRPC, not JSON-RPC. JSON-RPC is deprecated and public testnet fullnodes
 * already answer it with -32601 "Method not found", so `@mysten/sui/jsonRpc`
 * is not an option even for testnet work.
 */
export const suiClient = new SuiGrpcClient({
  network: SUI_CONFIG.network,
  baseUrl: SUI_CONFIG.grpcUrl,
});

/**
 * Decimals per coin type. Amounts on chain are integers in the smallest unit,
 * and the divisor is not the same for every coin: SUI has 9 (MIST), USDC has 6.
 * Assuming MIST for USDC is wrong by a factor of 1000.
 */
const COIN_DECIMALS: Record<string, number> = {
  "0x2::sui::SUI": 9,
  [SUI_CONFIG.usdcCoinType]: SUI_CONFIG.usdcDecimals,
};

export const decimalsForCoinType = (coinType: string): number => {
  const known = COIN_DECIMALS[coinType];
  if (known === undefined) {
    throw new Error(
      `Unknown decimals for coin type ${coinType}. Add it to COIN_DECIMALS before using it.`,
    );
  }
  return known;
};

/** Smallest-unit integer to a display number. */
export const fromBaseUnits = (amount: bigint | string | number, coinType: string): number =>
  Number(BigInt(amount)) / 10 ** decimalsForCoinType(coinType);

/** Display number to a smallest-unit integer, rounded to the coin's precision. */
export const toBaseUnits = (amount: number, coinType: string): bigint =>
  BigInt(Math.round(amount * 10 ** decimalsForCoinType(coinType)));

/** Integer sen to MYR. `amount_myr` is stored as sen because Move has no floats. */
export const senToMyr = (sen: bigint | string | number): number => Number(BigInt(sen)) / 100;

/** MYR to integer sen. */
export const myrToSen = (myr: number): bigint => BigInt(Math.round(myr * 100));

/**
 * Coin types come back from chain without the `0x` prefix on the address —
 * `a1ec…::usdc::USDC`, not `0xa1ec…::usdc::USDC` — while config and type
 * arguments carry it. Compare only normalized forms.
 */
export const normalizeCoinType = (coinType: string): string => {
  const [address, ...rest] = coinType.split("::");
  if (!address || rest.length !== 2) return coinType;
  return [normalizeAddress(address), ...rest].join("::");
};

/** Full 32-byte lowercase form, so short and padded addresses compare equal. */
export const normalizeAddress = (address: string): string =>
  `0x${address.replace(/^0x/, "").toLowerCase().padStart(64, "0")}`;

/**
 * Package IDs whose `payments` module we accept types from.
 *
 * A struct's type is anchored to the package version that *first defined it*.
 * Every struct is defined in the current package, so one ID is enough today. An
 * upgrade would split this again — structs defined before it keep reporting the
 * current ID while new ones report the upgraded ID — and this array is then the
 * only place that needs both.
 */
const KNOWN_PACKAGE_IDS = new Set([SUI_CONFIG.packageId].map(normalizeAddress));

/** True if `type` is `<our package>::payments::<structName>`. */
export const isSuiSureType = (type: string, structName: string): boolean => {
  const [address, moduleName, name] = type.split("::");
  if (!address || !moduleName || !name) return false;
  return (
    KNOWN_PACKAGE_IDS.has(normalizeAddress(address)) &&
    moduleName === "payments" &&
    name === structName
  );
};

/**
 * Fetches one object's parsed contents, or null if it does not exist.
 *
 * The gRPC `json` include gives already-decoded fields; `content` is raw BCS
 * and is not what callers want here.
 */
export const fetchObjectJson = async <T>(
  objectId: string,
): Promise<{ json: T; type: string } | null> => {
  const response = await suiClient.core.getObjects({
    objectIds: [objectId],
    include: { json: true },
  });
  const object = response.objects[0];
  // getObjects returns a per-object union: a missing or unreadable object comes
  // back as an Error in the array rather than throwing for the whole batch.
  if (!object || object instanceof Error) return null;
  if (!object.json) return null;
  return { json: object.json as T, type: object.type ?? "" };
};
