import { SUI_CONFIG } from "@/config/sui";
import { normalizeAddress, suiClient } from "@/services/sui/client";
import { resolvePaymentIntent } from "@/services/sui/intents";
import type { MerchantCredential, MerchantPaymentActivity } from "@/types/domain";

interface PaymentCompletedEvent {
  intent_id: string;
  credential_id: string;
  merchant: string;
  amount: string | number;
  payer: string;
}

const EVENT_TYPE = `${SUI_CONFIG.packageId}::payments::PaymentCompleted`;
const MAX_EVENT_PAGES = 10;
const CACHE_MS = 15_000;
const activityCache = new Map<
  string,
  { createdAt: number; promise: Promise<MerchantPaymentActivity[]> }
>();

const parsePaymentCompleted = (
  json: Record<string, unknown> | null,
): PaymentCompletedEvent | null => {
  if (!json) return null;
  const { intent_id, credential_id, merchant, amount, payer } = json;
  if (
    typeof intent_id !== "string" ||
    typeof credential_id !== "string" ||
    typeof merchant !== "string" ||
    (typeof amount !== "string" && typeof amount !== "number") ||
    typeof payer !== "string"
  ) {
    return null;
  }
  return { intent_id, credential_id, merchant, amount, payer };
};

/** Reads successful incoming payments from the contract's PaymentCompleted events. */
const readMerchantPaymentActivity = async (
  credential: MerchantCredential,
): Promise<MerchantPaymentActivity[]> => {
  const matchingEvents: Array<{
    event: PaymentCompletedEvent;
    digest: string;
    eventIndex: number;
  }> = [];
  let before: string | null = null;

  for (let pageNumber = 0; pageNumber < MAX_EVENT_PAGES; pageNumber += 1) {
    const page = await suiClient.listEvents({
      filter: { eventType: EVENT_TYPE },
      order: "descending",
      limit: 50,
      ...(before ? { before } : {}),
    });

    for (const entry of page.events) {
      const event = parsePaymentCompleted(entry.json);
      if (!event) continue;
      if (normalizeAddress(event.credential_id) !== normalizeAddress(credential.objectId)) continue;
      if (normalizeAddress(event.merchant) !== normalizeAddress(credential.receivingAddress))
        continue;
      matchingEvents.push({
        event,
        digest: entry.transactionDigest,
        eventIndex: entry.eventIndex,
      });
    }

    if (!page.hasNextPage || !page.endCursor) break;
    before = page.endCursor;
  }

  const resolved = await Promise.allSettled(
    matchingEvents.map(async ({ event, digest, eventIndex }) => {
      const [intent, transaction] = await Promise.all([
        resolvePaymentIntent(event.intent_id, credential.objectId),
        suiClient.getTransaction({ digest }),
      ]);
      if (transaction.$kind === "FailedTransaction") {
        throw new Error(`Payment transaction ${digest} could not be read.`);
      }
      if (BigInt(event.amount) <= 0n) {
        throw new Error(`Payment event ${digest} has an invalid amount.`);
      }
      if (transaction.Transaction.timestampMs === null) {
        throw new Error(`Payment transaction ${digest} has not been checkpointed.`);
      }

      return {
        activityId: `${digest}:${eventIndex}`,
        paymentIntentId: intent.objectId,
        merchantObjectId: credential.objectId,
        merchantName: credential.merchantName,
        tokenAmount: intent.tokenAmount,
        tokenType: intent.tokenType,
        approxMyr: intent.amountMyr,
        payerAddress: normalizeAddress(event.payer),
        merchantAddress: normalizeAddress(event.merchant),
        transactionDigest: digest,
        network: SUI_CONFIG.network,
        timestamp: new Date(transaction.Transaction.timestampMs).toISOString(),
      } satisfies MerchantPaymentActivity;
    }),
  );

  return resolved
    .filter(
      (result): result is PromiseFulfilledResult<MerchantPaymentActivity> =>
        result.status === "fulfilled",
    )
    .map((result) => result.value)
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
};

export const listMerchantPaymentActivity = (
  credential: MerchantCredential,
  options: { refresh?: boolean } = {},
): Promise<MerchantPaymentActivity[]> => {
  const key = normalizeAddress(credential.objectId);
  const cached = activityCache.get(key);
  if (!options.refresh && cached && Date.now() - cached.createdAt < CACHE_MS) {
    return cached.promise;
  }

  const promise = readMerchantPaymentActivity(credential);
  activityCache.set(key, { createdAt: Date.now(), promise });
  void promise.catch(() => activityCache.delete(key));
  return promise;
};
