import { findDemoMerchant } from "@/config/demo-intents";
import {
  fromBaseUnits,
  isSuiSureType,
  normalizeAddress,
  normalizeCoinType,
  senToMyr,
  suiClient,
} from "@/services/sui/client";
import type { OnChainPaymentIntent } from "@/services/sui/intents";

import { InterpretError, type PaymentRequestSummary } from "./schemas.ts";

/**
 * Open on-chain payment requests for one merchant.
 *
 * This is what lets an AI command reach the review screen: the assistant
 * produces a merchant and an amount, and this module finds the merchant's
 * actual `PaymentIntent` objects on Sui. The customer never invents a request
 * — they can only land on one the merchant created.
 *
 * Sources of candidate IDs, all verified on chain before use:
 *   - the demo inventory in `src/config/demo-intents.ts` (Member 1's fixtures)
 *   - IDs the browser sends as `knownIntentIds`, typically requests the
 *     merchant created on the same device during the demo
 *
 * The current Move package has no registry that enumerates a merchant's
 * intents, so the candidate list is the union above. When Member 1 adds one,
 * `candidateIdsFor` is the only function that changes.
 */

const CACHE_TTL_MS = 15_000;
const BATCH_SIZE = 20;

const cache = new Map<string, { at: number; requests: PaymentRequestSummary[] }>();

export const clearRequestCache = (): void => {
  cache.clear();
};

export interface OpenRequestOptions {
  knownIntentIds?: readonly string[];
  refresh?: boolean;
  nowMs?: number;
}

const candidateIdsFor = (merchantObjectId: string): string[] =>
  findDemoMerchant(merchantObjectId)?.intents.map((intent) => intent.objectId) ?? [];

const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

/** Reads many objects in a few round trips. Missing or foreign objects are dropped. */
const readIntents = async (objectIds: readonly string[]): Promise<OnChainPaymentIntent[]> => {
  const found: OnChainPaymentIntent[] = [];
  for (const ids of chunk(objectIds, BATCH_SIZE)) {
    const response = await suiClient.core.getObjects({ objectIds: ids, include: { json: true } });
    for (const object of response.objects) {
      if (!object || object instanceof Error || !object.json) continue;
      if (!isSuiSureType(object.type ?? "", "PaymentIntent")) continue;
      const json = object.json as unknown as OnChainPaymentIntent;
      found.push({ ...json, id: object.objectId });
    }
  }
  return found;
};

const toSummary = (intent: OnChainPaymentIntent): PaymentRequestSummary | null => {
  const coinType = normalizeCoinType(intent.coin_type);
  let tokenAmount: number;
  try {
    tokenAmount = fromBaseUnits(intent.amount, coinType);
  } catch {
    // A coin type this build does not know the decimals for. Not payable here.
    return null;
  }
  return {
    paymentIntentId: normalizeAddress(intent.id),
    merchantObjectId: normalizeAddress(intent.credential_id),
    amountMyr: senToMyr(intent.amount_myr),
    tokenAmount,
    tokenType: coinType.split("::").pop() ?? coinType,
    description: intent.description.slice(0, 200),
    orderReference: intent.order_ref.slice(0, 100),
    expiresAt: new Date(Number(intent.expiry_ms)).toISOString(),
  };
};

const isOpen = (intent: OnChainPaymentIntent, merchantObjectId: string, nowMs: number): boolean =>
  !intent.paid &&
  Number(intent.expiry_ms) > nowMs &&
  normalizeAddress(intent.credential_id) === normalizeAddress(merchantObjectId);

/**
 * Lists the merchant's requests that are unpaid and unexpired, cheapest first.
 *
 * Inventory reads are cached briefly; `knownIntentIds` are always read fresh,
 * since they are few and usually minutes old.
 */
export const listOpenRequests = async (
  merchantObjectId: string,
  options: OpenRequestOptions = {},
): Promise<{ open: PaymentRequestSummary[]; considered: number }> => {
  const nowMs = options.nowMs ?? Date.now();
  const merchantKey = normalizeAddress(merchantObjectId);
  const inventoryIds = candidateIdsFor(merchantKey).map(normalizeAddress);
  const extraIds = [...new Set((options.knownIntentIds ?? []).map(normalizeAddress))].filter(
    (id) => !inventoryIds.includes(id),
  );

  try {
    const cached = cache.get(merchantKey);
    let inventory: PaymentRequestSummary[];
    if (!options.refresh && cached && nowMs - cached.at < CACHE_TTL_MS) {
      inventory = cached.requests;
    } else {
      const intents = await readIntents(inventoryIds);
      inventory = intents
        .filter((intent) => isOpen(intent, merchantKey, nowMs))
        .map(toSummary)
        .filter((summary): summary is PaymentRequestSummary => summary !== null);
      cache.set(merchantKey, { at: nowMs, requests: inventory });
    }

    const extras = (await readIntents(extraIds))
      .filter((intent) => isOpen(intent, merchantKey, nowMs))
      .map(toSummary)
      .filter((summary): summary is PaymentRequestSummary => summary !== null);

    const byId = new Map<string, PaymentRequestSummary>();
    for (const request of [...inventory, ...extras]) byId.set(request.paymentIntentId, request);
    const open = [...byId.values()]
      // Cached entries can expire between reads; re-check the clock.
      .filter((request) => Date.parse(request.expiresAt) > nowMs)
      .sort((a, b) => a.amountMyr - b.amountMyr);

    return { open, considered: inventoryIds.length + extraIds.length };
  } catch (error) {
    if (error instanceof InterpretError) throw error;
    throw new InterpretError(
      "CHAIN_UNAVAILABLE",
      "Could not read payment requests from Sui Testnet. Try the QR flow.",
      error,
    );
  }
};
