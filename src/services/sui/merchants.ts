import { SUI_CONFIG } from "@/config/sui";
import type { MerchantCredential, VerifiedMerchant } from "@/types/domain";

import { fetchObjectJson, isSuiSureType } from "./client";

/** `suisure::payments::MerchantCredential` as it comes back from chain. */
export interface OnChainMerchantCredential {
  id: string;
  name: string;
  category: string;
  payout: string;
  active: boolean;
}

/**
 * MerchantCredential existed at first publish, so on chain it reports the
 * original package ID. Matched through `isSuiSureType` rather than compared to a
 * hardcoded string, because sibling structs introduced by the upgrade report the
 * upgraded ID instead.
 */
export const MERCHANT_CREDENTIAL_STRUCT = "MerchantCredential" as const;

/** "Kopitiam Seri Damai" -> "KS". Derived here; deliberately not stored on chain. */
export const logoInitialsFor = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

export const toVerifiedMerchant = (credential: OnChainMerchantCredential): VerifiedMerchant => ({
  objectId: credential.id,
  name: credential.name,
  category: credential.category,
  address: credential.payout,
  // A credential only exists because an AdminCap holder registered it, so its
  // existence is the verification. `active` is the separate, revocable part.
  verified: true,
  active: credential.active,
  logoInitials: logoInitialsFor(credential.name),
});

export const toMerchantCredential = (
  credential: OnChainMerchantCredential,
  acceptedToken: string,
): MerchantCredential => ({
  objectId: credential.id,
  merchantName: credential.name,
  category: credential.category,
  receivingAddress: credential.payout,
  acceptedToken,
  active: credential.active,
  // Not on chain: the credential records no registration timestamp. Callers
  // that need one should read it from the creating transaction instead of
  // inventing a value here.
  verifiedAt: "",
});

/** Reads a merchant credential from chain. Returns null if it is not there. */
export const getOnChainMerchantCredential = async (
  objectId: string,
): Promise<OnChainMerchantCredential | null> => {
  const result = await fetchObjectJson<OnChainMerchantCredential>(objectId);
  if (!result) return null;
  if (!isSuiSureType(result.type, MERCHANT_CREDENTIAL_STRUCT)) {
    throw new Error(
      `Object ${objectId} is not a SuiSure merchant credential. Refusing to treat it as one.`,
    );
  }
  return result.json;
};

/** Reads the demo merchant credentials recorded in config. */
export const listOnChainMerchants = async (): Promise<VerifiedMerchant[]> => {
  const credentials = await Promise.all(
    SUI_CONFIG.merchantCredentialIds.map((id) => getOnChainMerchantCredential(id)),
  );
  return credentials
    .filter((credential): credential is OnChainMerchantCredential => credential !== null)
    .map(toVerifiedMerchant);
};
