import {
  MOCK_MERCHANTS,
  MOCK_MERCHANT_CREDENTIAL,
} from "@/services/mocks/data";
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
  | "not-submitted"
  | "submitted"
  | "under-review"
  | "approved"
  | "rejected";

const delay = (ms = 450) => new Promise((r) => setTimeout(r, ms));

export const merchantService = {
  /** Role is derived from an onchain MerchantCredential, never from UI state. */
  async getMerchantCredential(
    address: string,
    devMerchantOverride = false,
  ): Promise<MerchantCredential | null> {
    await delay(250);
    if (!address) return null;
    return devMerchantOverride ? MOCK_MERCHANT_CREDENTIAL : null;
  },

  async listVerifiedMerchants(query = ""): Promise<VerifiedMerchant[]> {
    await delay(200);
    const q = query.trim().toLowerCase();
    return MOCK_MERCHANTS.filter((m) => m.verified).filter(
      (m) => !q || m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q),
    );
  },

  async getMerchant(objectId: string): Promise<VerifiedMerchant | null> {
    await delay(150);
    return MOCK_MERCHANTS.find((m) => m.objectId === objectId) ?? null;
  },

  /** Submitting an application never approves a merchant. */
  async submitApplication(
    application: MerchantApplication,
  ): Promise<{ status: ApplicationStatus; reference: string }> {
    await delay(900);
    if (!application.consent) throw new Error("Consent is required.");
    return { status: "under-review", reference: `APP-${Date.now().toString().slice(-6)}` };
  },
};
