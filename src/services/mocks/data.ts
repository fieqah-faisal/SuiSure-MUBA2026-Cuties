import type {
  AppNotification,
  MerchantCredential,
  PaymentIntent,
  PaymentReceipt,
  VerifiedMerchant,
} from "@/types/domain";

export const MOCK_MERCHANTS: VerifiedMerchant[] = [
  {
    objectId: "0xmerch01aa11kopitiam",
    name: "Kopitiam Seri Damai",
    category: "Food & Beverage",
    address: "0x8f21ac53b9d0e4471c62aa7d5f39e0cb47a1d2f8",
    verified: true,
    active: true,
    logoInitials: "KS",
  },
  {
    objectId: "0xmerch02bb22campuscafe",
    name: "Campus Café",
    category: "Food & Beverage",
    address: "0x4d18be91c7a20f6635d8e1c3ba9074fe2c58a10b",
    verified: true,
    active: true,
    logoInitials: "CC",
  },
  {
    objectId: "0xmerch03cc33bookstore",
    name: "Verified Bookstore",
    category: "Retail",
    address: "0x91cd7e4a6b0328fd15ac9e7740b2d6a3e8f10c47",
    verified: true,
    active: true,
    logoInitials: "VB",
  },
  {
    objectId: "0xmerch04dd44printshop",
    name: "Campus Print Shop",
    category: "Services",
    address: "0x2ab6f0d84e1937c5a0b7de92148f36cc7051e9ad",
    verified: true,
    active: true,
    logoInitials: "PS",
  },
  {
    objectId: "0xmerch05ee55unknown",
    name: "Roadside Stall (unregistered)",
    category: "Unknown",
    address: "0x77aa19c4d8e0b3162f5a90cd4be27301f8ac6d52",
    verified: false,
    active: false,
    logoInitials: "RS",
  },
];

const M = (i: number): VerifiedMerchant => MOCK_MERCHANTS[i]!;

export const MOCK_MERCHANT_CREDENTIAL: MerchantCredential = {
  objectId: "0xcred01f4a9merchantcredential",
  merchantName: "Kopitiam Seri Damai",
  category: "Food & Beverage",
  receivingAddress: M(0).address,
  acceptedToken: "SUI",
  active: true,
  verifiedAt: "2026-06-14T02:15:00.000Z",
};

export const MOCK_RATE_MYR_PER_SUI = 16.4;

const now = Date.now();
const iso = (offsetMs: number) => new Date(now + offsetMs).toISOString();

export const MOCK_INTENTS: PaymentIntent[] = [
  {
    objectId: "0xintent1a2b3c4d5e6f",
    merchantObjectId: M(0).objectId,
    merchantName: M(0).name,
    merchantCategory: M(0).category,
    recipientAddress: M(0).address,
    amountMyr: 12,
    tokenAmount: 12 / MOCK_RATE_MYR_PER_SUI,
    tokenType: "SUI",
    description: "Nasi lemak set + teh tarik",
    orderReference: "ORD-2891",
    network: "testnet",
    createdAt: iso(-1000 * 60 * 3),
    expiresAt: iso(1000 * 60 * 12),
    status: "pending",
  },
  {
    objectId: "0xintent9z8y7x6w5v4u",
    merchantObjectId: M(1).objectId,
    merchantName: M(1).name,
    merchantCategory: M(1).category,
    recipientAddress: M(1).address,
    amountMyr: 8,
    tokenAmount: 8 / MOCK_RATE_MYR_PER_SUI,
    tokenType: "SUI",
    description: "Iced americano",
    orderReference: "ORD-1043",
    network: "testnet",
    createdAt: iso(-1000 * 60 * 60),
    expiresAt: iso(-1000 * 60 * 30),
    status: "expired",
  },
];

export const MOCK_RECEIPTS: PaymentReceipt[] = [
  {
    receiptId: "rc_9f21ab",
    paymentIntentId: "0xintentaa11bb22cc33",
    status: "confirmed",
    merchantName: "Campus Café",
    merchantCategory: "Food & Beverage",
    tokenAmount: 0.488,
    tokenType: "SUI",
    approxMyr: 8,
    payerAddress: "0xa17c94f0be2d31856cfa0b74d9e2137ac6f0b581",
    merchantAddress: M(1).address,
    transactionDigest: "9YfLp2Qm3xZbT7kR1vHn8cA4dW6sE0uJqB5gNrXyMzP",
    network: "testnet",
    timestamp: iso(-1000 * 60 * 60 * 6),
  },
  {
    receiptId: "rc_44de10",
    paymentIntentId: "0xintentdd44ee55ff66",
    status: "confirmed",
    merchantName: "Verified Bookstore",
    merchantCategory: "Retail",
    tokenAmount: 1.524,
    tokenType: "SUI",
    approxMyr: 25,
    payerAddress: "0xa17c94f0be2d31856cfa0b74d9e2137ac6f0b581",
    merchantAddress: M(2).address,
    transactionDigest: "3KdRt8Wq1yLnV5bC7mJx2aZfH9sU4pG6eQrTvNoXiBk",
    network: "testnet",
    timestamp: iso(-1000 * 60 * 60 * 52),
  },
  {
    receiptId: "rc_71bc02",
    paymentIntentId: "0xintentgg77hh88ii99",
    status: "failed",
    merchantName: "Campus Print Shop",
    merchantCategory: "Services",
    tokenAmount: 0.244,
    tokenType: "SUI",
    approxMyr: 4,
    payerAddress: "0xa17c94f0be2d31856cfa0b74d9e2137ac6f0b581",
    merchantAddress: M(3).address,
    transactionDigest: "7BnQz4Ls9tYw2rXe6mVc1dK8pA3oJfU5hGiTbRlZySn",
    network: "testnet",
    timestamp: iso(-1000 * 60 * 60 * 80),
  },
];

export const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: "ntf_1",
    title: "Payment confirmed",
    body: "RM8.00 paid to Campus Café was confirmed on Sui Testnet.",
    kind: "payment",
    createdAt: iso(-1000 * 60 * 60 * 6),
    read: false,
  },
  {
    id: "ntf_2",
    title: "New verified merchant nearby",
    body: "Campus Print Shop is now a verified SuiSure merchant.",
    kind: "merchant",
    createdAt: iso(-1000 * 60 * 60 * 20),
    read: false,
  },
  {
    id: "ntf_3",
    title: "Security reminder",
    body: "SuiSure will never approve a payment without your signature.",
    kind: "security",
    createdAt: iso(-1000 * 60 * 60 * 40),
    read: true,
  },
];
