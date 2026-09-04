import { SUI_CONFIG } from "@/config/sui";
import { normalizeAddress } from "@/services/sui/client";
import {
  getOnChainMerchantCredential,
  listOnChainMerchants,
  toMerchantCredential,
} from "@/services/sui/merchants";
import type { MerchantCredential, VerifiedMerchant } from "@/types/domain";
export const merchantService = {
  async getMerchantCredential(address: string): Promise<MerchantCredential | null> {
    if (!address) return null;
    const credentials = await Promise.all(
      SUI_CONFIG.merchantCredentialIds.map((id) => getOnChainMerchantCredential(id)),
    );
    const selected = credentials.find(
      (credential) =>
        credential && normalizeAddress(credential.payout) === normalizeAddress(address),
    );
    return selected ? toMerchantCredential(selected, "USDC") : null;
  },
  async listVerifiedMerchants(query = ""): Promise<VerifiedMerchant[]> {
    const merchants = await listOnChainMerchants();
    const value = query.trim().toLowerCase();
    return merchants.filter(
      (merchant) =>
        !value ||
        merchant.name.toLowerCase().includes(value) ||
        merchant.category.toLowerCase().includes(value),
    );
  },
  async getMerchant(objectId: string): Promise<VerifiedMerchant | null> {
    return (
      (await listOnChainMerchants()).find((merchant) => merchant.objectId === objectId) ?? null
    );
  },
};
