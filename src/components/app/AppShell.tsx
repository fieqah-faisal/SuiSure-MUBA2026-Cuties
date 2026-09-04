import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Activity, Bell, Home, QrCode, Store, User, Wallet } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { SuiSureLogo } from "@/components/brand/Logo";
import { NetworkPill } from "@/components/app/NetworkPill";
import Footer17 from "@/components/ui/footer";
import { useSession } from "@/hooks/useSession";
import { cn } from "@/lib/utils";
import { notificationService } from "@/services/notifications/notification.service";
import { listMerchantPaymentActivity } from "@/services/sui/activity";

const navItems = [
  { to: "/app", label: "Home", icon: Home },
  { to: "/pay", label: "Pay", icon: QrCode },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function AppShell({
  children,
  title,
  requireMerchant = false,
}: {
  children: ReactNode;
  title?: string;
  requireMerchant?: boolean;
}) {
  const { ready, account, isMerchant, credential } = useSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

  useEffect(() => {
    if (ready && !account) void navigate({ to: "/login" });
  }, [ready, account, navigate]);

  useEffect(() => {
    if (!ready || !account) return;
    let cancelled = false;

    const syncNotifications = async () => {
      try {
        if (credential) {
          const incoming = await listMerchantPaymentActivity(credential);
          incoming.forEach((payment) => notificationService.addMerchantPaymentReceived(payment));
        }
        const items = await notificationService.list();
        if (!cancelled) setHasUnreadNotifications(items.some((item) => !item.read));
      } catch {
        // Activity pages surface network errors; navigation must remain available.
      }
    };

    void syncNotifications();
    const intervalId = window.setInterval(() => void syncNotifications(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [ready, account, credential]);

  useEffect(
    () =>
      notificationService.subscribe(() => {
        void notificationService
          .list()
          .then((items) => setHasUnreadNotifications(items.some((item) => !item.read)));
      }),
    [],
  );

  if (!ready || !account) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading your SuiSure account…
      </div>
    );
  }

  if (requireMerchant && !isMerchant) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <Store className="h-10 w-10 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Merchant access required</h1>
        <p className="text-sm text-muted-foreground">
          This account does not hold a merchant credential on Sui Testnet.
        </p>
        <Link to="/merchant/apply" className="text-sm font-semibold text-primary">
          View merchant registration
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-0">
      <header className="sticky top-0 z-30 w-full border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-8">
            <Link to="/app" className="flex items-center gap-3">
              <SuiSureLogo />
            </Link>

            <nav className="hidden items-center gap-1 lg:flex">
              {navItems.map((item) => {
                const active = pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "relative px-3 py-5 text-sm font-medium transition-colors",
                      active
                        ? "text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
              {isMerchant ? (
                <Link
                  to="/merchant"
                  className={cn(
                    "relative px-3 py-5 text-sm font-medium transition-colors",
                    pathname.startsWith("/merchant")
                      ? "text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Merchant
                </Link>
              ) : null}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {title ? (
              <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
                {title}
              </span>
            ) : null}
            <NetworkPill className="hidden sm:inline-flex" />
            <Link
              to="/notifications"
              aria-label="Notifications"
              className="relative rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Bell className="h-4.5 w-4.5" />
              {hasUnreadNotifications ? (
                <span
                  aria-label="Unread notifications"
                  className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-critical ring-2 ring-background"
                />
              ) : null}
            </Link>
          </div>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-3xl px-4 py-6">{children}</main>

      <Footer17
        heading="Connect\nwith us."
        brandName="SuiSure"
        navColumns={[
          {
            title: "Menu",
            links: [
              { label: "Dashboard", href: "/app" },
              { label: "Pay", href: "/pay" },
              { label: "Activity", href: "/activity" },
              { label: "Profile", href: "/profile" },
            ],
          },
          {
            title: "Office",
            links: [
              { label: "Asia Pacific University of Technology and Innovation", href: "#" },
              { label: "Bukit Jalil, Kuala Lumpur", href: "#" },
              { label: "Malaysia", href: "#" },
            ],
          },
        ]}
        socialLinks={[
          { label: "LINKEDIN", href: "/coming-soon", icon: "linkedin" },
          { label: "TWITTER", href: "/coming-soon", icon: "twitter" },
          {
            label: "GITHUB",
            href: "https://github.com/fieqah-faisal/SuiSure-MUBA2026-Cuties.git",
            icon: "github",
          },
        ]}
        legalText="© 2026 SuiSure by Cuties - Build at MUBA Blockchain Hackathon 2026 on Sui. All rights reserved."
        bottomLinks={[
          { label: "Terms of Service", href: "#" },
          { label: "Privacy Policy", href: "#" },
        ]}
      />

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur-xl lg:hidden">
        <ul className="mx-auto flex max-w-md items-stretch px-2 pb-[env(safe-area-inset-bottom)]">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <li key={item.to} className="flex-1">
                <Link
                  to={item.to}
                  className={cn(
                    "flex flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
          {isMerchant ? (
            <li className="flex-1">
              <Link
                to="/merchant"
                className={cn(
                  "flex flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors",
                  pathname.startsWith("/merchant") ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Wallet className="h-5 w-5" />
                Merchant
              </Link>
            </li>
          ) : null}
        </ul>
      </nav>
    </div>
  );
}
