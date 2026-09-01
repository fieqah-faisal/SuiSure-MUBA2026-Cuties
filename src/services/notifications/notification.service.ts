import { MOCK_NOTIFICATIONS } from "@/services/mocks/data";
import { persistence } from "@/services/storage/persistence.service";
import type { AppNotification } from "@/types/domain";

export const notificationService = {
  async list(): Promise<AppNotification[]> {
    await new Promise((r) => setTimeout(r, 200));
    const readIds = persistence.read<string[]>("notifications", []);
    return MOCK_NOTIFICATIONS.map((n) => ({
      ...n,
      read: n.read || readIds.includes(n.id),
    }));
  },
  markRead(id: string) {
    const readIds = persistence.read<string[]>("notifications", []);
    if (!readIds.includes(id)) persistence.write("notifications", [...readIds, id]);
  },
  markAllRead(ids: string[]) {
    persistence.write("notifications", ids);
  },
};
