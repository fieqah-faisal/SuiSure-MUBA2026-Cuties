import { listOnChainMerchants } from "@/services/sui/merchants";
import type { VerifiedMerchant } from "@/types/domain";

import type { MatchableMerchant } from "./matching.ts";
import { InterpretError } from "./schemas.ts";

/**
 * The registered merchant list, read from Sui.
 *
 * This goes through Member 1's adapter — the same code path the review screen
 * uses — so the assistant can never resolve a merchant the review screen would
 * reject. The payout address is dropped here, before anything downstream sees
 * the merchant: the assistant lane does not carry addresses at all.
 */

export interface MerchantListOptions {
  /** Skip the cache, for example after a merchant is registered live on stage. */
  refresh?: boolean;
}

const CACHE_TTL_MS = 30_000;

let cache: { at: number; merchants: MatchableMerchant[] } | null = null;

/** Exposed for tests and for the health route's chain probe. */
export const clearMerchantCache = (): void => {
  cache = null;
};

const toMatchable = (merchant: VerifiedMerchant): MatchableMerchant => ({
  objectId: merchant.objectId.toLowerCase(),
  name: merchant.name,
  category: merchant.category,
  active: merchant.active,
  verified: merchant.verified,
  logoInitials: merchant.logoInitials,
  // merchant.address is deliberately not copied.
});

export const listRegisteredMerchants = async (
  options: MerchantListOptions = {},
): Promise<MatchableMerchant[]> => {
  if (!options.refresh && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.merchants;
  }

  let merchants: VerifiedMerchant[];
  try {
    merchants = await listOnChainMerchants();
  } catch (error) {
    throw new InterpretError(
      "CHAIN_UNAVAILABLE",
      "Could not read the merchant list from Sui Testnet. Try the QR flow.",
      error,
    );
  }

  const matchable = merchants.map(toMatchable);
  cache = { at: Date.now(), merchants: matchable };
  return matchable;
};
