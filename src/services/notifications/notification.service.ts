import { persistence } from "@/services/storage/persistence.service";
import type { AppNotification, PaymentReceipt } from "@/types/domain";

const readItems = () => persistence.read<AppNotification[]>("notification-items", []);
const writeItems = (items: AppNotification[]) => persistence.write("notification-items", items);

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
    writeItems([item, ...readItems().filter((existing) => existing.id !== item.id)]);
  },
  markRead(id: string) {
    writeItems(readItems().map((item) => (item.id === id ? { ...item, read: true } : item)));
  },
  markAllRead(ids: string[]) {
    const selected = new Set(ids);
    writeItems(readItems().map((item) => (selected.has(item.id) ? { ...item, read: true } : item)));
  },
};
