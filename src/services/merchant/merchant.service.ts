import { SUI_CONFIG } from "@/config/sui";
import { normalizeAddress } from "@/services/sui/client";
import {
  getOnChainMerchantCredential,
  listOnChainMerchants,
  toMerchantCredential,
} from "@/services/sui/merchants";
import type { MerchantCredential, VerifiedMerchant } from "@/types/domain";
export interface MerchantApplication {
  businessName: string;
  category: string;
  registrationNumber: string;
  contactEmail: string;
  receivingAddress: string;
  consent: boolean;
}
export type ApplicationStatus =
  "not-submitted" | "submitted" | "under-review" | "approved" | "rejected";
export const merchantService = {
  async getMerchantCredential(
    address: string,
    devMerchantOverride = false,
  ): Promise<MerchantCredential | null> {
    if (!address) return null;
    const credentials = await Promise.all(
      SUI_CONFIG.merchantCredentialIds.map((id) => getOnChainMerchantCredential(id)),
    );
    const selected = devMerchantOverride
      ? credentials.find(Boolean)
      : credentials.find(
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
  async submitApplication(
    application: MerchantApplication,
  ): Promise<{ status: ApplicationStatus; reference: string }> {
    if (!application.consent) throw new Error("Consent is required.");
    return { status: "under-review", reference: `APP-${Date.now().toString().slice(-6)}` };
  },
};
