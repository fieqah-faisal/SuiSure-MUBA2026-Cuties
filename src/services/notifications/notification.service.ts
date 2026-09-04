import { persistence } from "@/services/storage/persistence.service";
import type { AppNotification, MerchantPaymentActivity, PaymentReceipt } from "@/types/domain";

const normalize = (address: string) => address.toLowerCase();
const readAllItems = () => persistence.read<AppNotification[]>("notification-items", []);
const readItems = (accountAddress: string) =>
  readAllItems().filter(
    (item) =>
      typeof item.accountAddress === "string" &&
      normalize(item.accountAddress) === normalize(accountAddress),
  );
const NOTIFICATION_CHANGE_EVENT = "suisure:notifications-changed";
const writeItems = (items: AppNotification[]) => {
  persistence.write("notification-items", items);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(NOTIFICATION_CHANGE_EVENT));
};

const addIfNew = (item: AppNotification) => {
  const items = readAllItems();
  if (
    items.some(
      (existing) =>
        existing.id === item.id &&
        typeof existing.accountAddress === "string" &&
        normalize(existing.accountAddress) === normalize(item.accountAddress),
    )
  )
    return;
  writeItems([item, ...items]);
};

export const notificationService = {
  async list(accountAddress: string): Promise<AppNotification[]> {
    return readItems(accountAddress);
  },
  addPaymentConfirmation(receipt: PaymentReceipt) {
    const item: AppNotification = {
      id: `payment:${receipt.transactionDigest}`,
      title: "Payment confirmed on Sui",
      body: `RM${receipt.approxMyr.toFixed(2)} paid to ${receipt.merchantName} on Sui Testnet.`,
      kind: "payment",
      createdAt: receipt.timestamp,
      read: false,
      accountAddress: receipt.payerAddress,
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
      accountAddress: payment.merchantAddress,
    };
    addIfNew(item);
  },
  markRead(id: string, accountAddress: string) {
    writeItems(
      readAllItems().map((item) =>
        item.id === id &&
        typeof item.accountAddress === "string" &&
        normalize(item.accountAddress) === normalize(accountAddress)
          ? { ...item, read: true }
          : item,
      ),
    );
  },
  markAllRead(ids: string[], accountAddress: string) {
    const selected = new Set(ids);
    writeItems(
      readAllItems().map((item) =>
        selected.has(item.id) &&
        typeof item.accountAddress === "string" &&
        normalize(item.accountAddress) === normalize(accountAddress)
          ? { ...item, read: true }
          : item,
      ),
    );
  },
  subscribe(listener: () => void) {
    if (typeof window === "undefined") return () => undefined;
    window.addEventListener(NOTIFICATION_CHANGE_EVENT, listener);
    return () => window.removeEventListener(NOTIFICATION_CHANGE_EVENT, listener);
  },
};
