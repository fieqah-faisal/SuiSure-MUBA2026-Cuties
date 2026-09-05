import { z } from "zod";

export type NetworkStatus = "online" | "offline" | "degraded" | "unavailable" | "wrong-network";

export type PaymentStatus = "draft" | "pending" | "confirmed" | "declined" | "failed" | "expired";

export type RiskLevel = "low" | "medium" | "high" | "blocked";

export type SuiNetwork = "testnet" | "mainnet" | "devnet" | "localnet";

export interface SuiAccount {
  address: string;
  provider: "google" | "wallet";
  displayName: string;
  email?: string | undefined;
}

export interface MerchantCredential {
  objectId: string;
  merchantName: string;
  category: string;
  receivingAddress: string;
  acceptedToken: string;
  active: boolean;
}

export interface VerifiedMerchant {
  objectId: string;
  name: string;
  category: string;
  address: string;
  verified: boolean;
  active: boolean;
  logoInitials: string;
}

export interface PaymentIntent {
  objectId: string;
  merchantObjectId: string;
  merchantName: string;
  merchantCategory: string;
  recipientAddress: string;
  amountMyr: number;
  tokenAmount: number;
  tokenType: string;
  /** Full Sui coin type used for transaction construction. */
  coinType?: string | undefined;
  description?: string | undefined;
  orderReference?: string | undefined;
  network: SuiNetwork;
  createdAt: string;
  expiresAt: string;
  status: PaymentStatus;
}

export interface VerificationCheck {
  id: string;
  label: string;
  passed: boolean;
  critical: boolean;
  detail?: string | undefined;
}

export interface RiskAssessment {
  level: RiskLevel;
  checks: VerificationCheck[];
  summary: string;
}

export interface PaymentReceipt {
  receiptId: string;
  paymentIntentId: string;
  status: Extract<PaymentStatus, "confirmed" | "pending" | "failed">;
  merchantName: string;
  merchantCategory: string;
  tokenAmount: number;
  tokenType: string;
  approxMyr: number;
  payerAddress: string;
  merchantAddress: string;
  transactionDigest: string;
  network: SuiNetwork;
  timestamp: string;
}

export interface MerchantPaymentActivity {
  activityId: string;
  paymentIntentId: string;
  merchantObjectId: string;
  merchantName: string;
  tokenAmount: number;
  tokenType: string;
  approxMyr: number;
  payerAddress: string;
  merchantAddress: string;
  transactionDigest: string;
  network: SuiNetwork;
  timestamp: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  kind: "payment" | "merchant" | "security" | "system";
  createdAt: string;
  read: boolean;
  /** Connected account allowed to see this locally persisted notification. */
  accountAddress: string;
}

/**
 * An open on-chain payment request the assistant found for a resolved
 * merchant. Carries the same two IDs a QR carries and never an address; the
 * review screen re-reads everything from Sui before enabling payment.
 */
export interface AiPaymentRequestSummary {
  paymentIntentId: string;
  merchantObjectId: string;
  amountMyr: number;
  tokenAmount: number;
  tokenType: string;
  description?: string | undefined;
  orderReference?: string | undefined;
  expiresAt: string;
}

/** What the UI should do with an assistant result. Decided on the server. */
export type AiNextStep = "review" | "choose-request" | "no-request" | "choose-merchant" | "blocked";

export interface AiParsedIntent {
  merchantCandidates: VerifiedMerchant[];
  merchant?: VerifiedMerchant | undefined;
  amount?: number | undefined;
  displayCurrency: "MYR" | "SUI";
  paymentToken: string;
  confidence: number;
  missingInformation: string[];
  /** Written by server code from on-chain facts, never by the model alone. */
  explanation: string;
  clarificationQuestion?: string | undefined;
  /** The merchant name as the model read it from the message. */
  merchantQuery?: string | undefined;
  /** The model's own one-line reading of the message. Advisory. */
  assistantNote?: string | undefined;
  nextStep: AiNextStep;
  /** Set when exactly one open request matches the amount the user named. */
  matchedRequest?: AiPaymentRequestSummary | undefined;
  /** The resolved merchant's open requests, cheapest first. */
  openRequests: AiPaymentRequestSummary[];
  /** `model` means a real model call ran; `heuristic` is the offline fallback. */
  source: "model" | "heuristic";
  model: string | null;
}

const suiObjectIdSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Invalid Sui object ID");

export const paymentIntentQrPayloadSchema = z.object({
  v: z.literal(1),
  type: z.literal("suisure.payment-intent"),
  network: z.enum(["testnet", "mainnet", "devnet", "localnet"]),
  paymentIntentId: suiObjectIdSchema,
  merchantObjectId: suiObjectIdSchema,
});

export type PaymentIntentQRPayload = z.infer<typeof paymentIntentQrPayloadSchema>;
