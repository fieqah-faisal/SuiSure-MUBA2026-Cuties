/**
 * Versioned local persistence. Never stores private keys, session secrets,
 * API keys or full sensitive transaction data.
 */
const PREFIX = "suisure:v1:";

export type PersistenceKey =
  | "onboarding"
  | "payment-draft"
  | "notifications"
  | "session"
  | "role-override"
  | "recent-merchants"
  | "dismissed"
  | "receipts"
  | "notification-items";

const isBrowser = () => typeof window !== "undefined";

export const persistence = {
  read<T>(key: PersistenceKey, fallback: T): T {
    if (!isBrowser()) return fallback;
    try {
      const raw = window.localStorage.getItem(PREFIX + key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  write<T>(key: PersistenceKey, value: T) {
    if (!isBrowser()) return;
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* storage unavailable */
    }
  },
  remove(key: PersistenceKey) {
    if (!isBrowser()) return;
    window.localStorage.removeItem(PREFIX + key);
  },
  clearAll() {
    if (!isBrowser()) return;
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => window.localStorage.removeItem(k));
  },
};
