import { SUI_CONFIG } from "@/config/sui";
import type { MerchantCredential, VerifiedMerchant } from "@/types/domain";
import { fetchObjectJson, isSuiSureType } from "./client";
export interface OnChainMerchantCredential {
  id: string;
  name: string;
  category: string;
  payout: string;
  active: boolean;
}
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
});
export const getOnChainMerchantCredential = async (
  objectId: string,
): Promise<OnChainMerchantCredential | null> => {
  const result = await fetchObjectJson<OnChainMerchantCredential>(objectId);
  if (!result) return null;
  if (!isSuiSureType(result.type, "MerchantCredential"))
    throw new Error(`Object ${objectId} is not a SuiSure merchant credential.`);
  return result.json;
};
export const listOnChainMerchants = async (): Promise<VerifiedMerchant[]> => {
  const credentials = await Promise.all(
    SUI_CONFIG.merchantCredentialIds.map((id) => getOnChainMerchantCredential(id)),
  );
  return credentials
    .filter((credential): credential is OnChainMerchantCredential => credential !== null)
    .map(toVerifiedMerchant);
};
