import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { notificationService } from "@/services/notifications/notification.service";
import type { AppNotification } from "@/types/domain";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications | SuiSure" },
      {
        name: "description",
        content: "Payment confirmations, merchant updates and security alerts from SuiSure.",
      },
      { property: "og:title", content: "Notifications | SuiSure" },
      { property: "og:description", content: "Stay on top of your SuiSure payment alerts." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const [items, setItems] = useState<AppNotification[] | null>(null);

  useEffect(() => {
    const refresh = () => void notificationService.list().then(setItems);
    refresh();
    return notificationService.subscribe(refresh);
  }, []);

  return (
    <AppShell title="Notifications">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Notifications</h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const all = (items ?? []).map((n) => n.id);
            notificationService.markAllRead(all);
            setItems((prev) => (prev ?? []).map((n) => ({ ...n, read: true })));
          }}
        >
          Mark all read
        </Button>
      </div>

      {items && items.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={Bell}
            title="Nothing here yet"
            description="Payment and merchant alerts will appear in this list."
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {(items ?? []).map((n) => (
            <li
              key={n.id}
              className={`surface-card p-4 ${n.read ? "opacity-70" : ""}`}
              onClick={() => {
                notificationService.markRead(n.id);
                setItems((prev) =>
                  (prev ?? []).map((x) => (x.id === n.id ? { ...x, read: true } : x)),
                );
              }}
            >
              <p className="text-sm font-semibold">{n.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {new Date(n.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
