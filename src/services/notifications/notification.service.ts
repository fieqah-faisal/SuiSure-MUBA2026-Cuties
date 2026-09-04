import { persistence } from "@/services/storage/persistence.service";
import type { AppNotification, MerchantPaymentActivity, PaymentReceipt } from "@/types/domain";

const readItems = () => persistence.read<AppNotification[]>("notification-items", []);
const NOTIFICATION_CHANGE_EVENT = "suisure:notifications-changed";
const writeItems = (items: AppNotification[]) => {
  persistence.write("notification-items", items);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(NOTIFICATION_CHANGE_EVENT));
};

const addIfNew = (item: AppNotification) => {
  const items = readItems();
  if (items.some((existing) => existing.id === item.id)) return;
  writeItems([item, ...items]);
};

export const notificationService = {
  async list(): Promise<AppNotification[]> {
    return readItems();
  },
  addPaymentConfirmation(receipt: PaymentReceipt) {
    const item: AppNotification = {
      id: `payment:${receipt.transactionDigest}`,
      title: "Payment confirmed on Sui",
      body: `RM${receipt.approxMyr.toFixed(2)} paid to ${receipt.merchantName} on Sui Testnet.`,
      kind: "payment",
      createdAt: receipt.timestamp,
      read: false,
    };
    addIfNew(item);
  },
  addMerchantPaymentReceived(payment: MerchantPaymentActivity) {
    const payer = `${payment.payerAddress.slice(0, 8)}…${payment.payerAddress.slice(-6)}`;
    const item: AppNotification = {
      id: `merchant-payment:${payment.activityId}`,
      title: "Payment received",
      body: `${payment.tokenAmount.toFixed(6)} ${payment.tokenType} (RM${payment.approxMyr.toFixed(2)}) received from ${payer}.`,
      kind: "payment",
      createdAt: payment.timestamp,
      read: false,
    };
    addIfNew(item);
  },
  markRead(id: string) {
    writeItems(readItems().map((item) => (item.id === id ? { ...item, read: true } : item)));
  },
  markAllRead(ids: string[]) {
    const selected = new Set(ids);
    writeItems(readItems().map((item) => (selected.has(item.id) ? { ...item, read: true } : item)));
  },
  subscribe(listener: () => void) {
    if (typeof window === "undefined") return () => undefined;
    window.addEventListener(NOTIFICATION_CHANGE_EVENT, listener);
    return () => window.removeEventListener(NOTIFICATION_CHANGE_EVENT, listener);
  },
};
