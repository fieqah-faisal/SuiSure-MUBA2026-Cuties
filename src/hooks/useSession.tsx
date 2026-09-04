import { isGoogleWallet } from "@mysten/enoki";
import { useCurrentNetwork, useDAppKit, useWalletConnection } from "@mysten/dapp-kit-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { SUI_CONFIG } from "@/config/sui";
import { merchantService } from "@/services/merchant/merchant.service";
import { paymentService } from "@/services/payments/payment.service";
import { persistence } from "@/services/storage/persistence.service";
import type { MerchantCredential, NetworkStatus, SuiAccount } from "@/types/domain";

export type ViewMode = "customer" | "merchant";

interface SessionValue {
  ready: boolean;
  account: SuiAccount | null;
  credential: MerchantCredential | null;
  isMerchant: boolean;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  networkStatus: NetworkStatus;
  balance: number;
  balanceToken: string;
  gasBalance: number;
  signOut: () => Promise<void>;
  clearLocalData: () => void;
  refreshBalance: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

const isSupportedSession = (value: SuiAccount | null): value is SuiAccount =>
  Boolean(value && (value.provider === "wallet" || value.provider === "google"));

export function SessionProvider({ children }: { children: ReactNode }) {
  const dAppKit = useDAppKit();
  const walletConnection = useWalletConnection();
  const currentNetwork = useCurrentNetwork();
  const [online, setOnline] = useState(true);
  const [ready, setReady] = useState(false);
  const [account, setAccount] = useState<SuiAccount | null>(null);
  const [credential, setCredential] = useState<MerchantCredential | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("customer");
  const [balance, setBalance] = useState(0);
  const [gasBalance, setGasBalance] = useState(0);
  const [balanceToken, setBalanceToken] = useState<string>(SUI_CONFIG.defaultToken);

  useEffect(() => {
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const networkStatus: NetworkStatus = !online
    ? "offline"
    : currentNetwork !== SUI_CONFIG.network
      ? "wrong-network"
      : "online";

  useEffect(() => {
    const stored = persistence.read<SuiAccount | null>("session", null);
    if (isSupportedSession(stored)) setAccount(stored);
    else persistence.remove("session");
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;

    if (walletConnection.status === "connected") {
      const connectedAccount: SuiAccount = isGoogleWallet(walletConnection.wallet)
        ? {
            address: walletConnection.account.address,
            provider: "google",
            displayName: "Google zkLogin User",
          }
        : {
            address: walletConnection.account.address,
            provider: "wallet",
            displayName: "Sui Wallet User",
          };

      if (
        account?.address !== connectedAccount.address ||
        account.provider !== connectedAccount.provider
      ) {
        persistence.write("session", connectedAccount);
        setAccount(connectedAccount);
      }
    } else if (walletConnection.status === "disconnected" && account) {
      persistence.remove("session");
      setAccount(null);
    }
  }, [ready, walletConnection, account]);

  const refreshBalance = useCallback(async () => {
    if (!account?.address) {
      setBalance(0);
      setGasBalance(0);
      return;
    }
    const result = await paymentService.getBalances(account.address);
    setBalance(result.amount);
    setBalanceToken(result.token);
    setGasBalance(result.gasSui);
  }, [account?.address]);

  useEffect(() => {
    if (!account) {
      setCredential(null);
      setBalance(0);
      setGasBalance(0);
      return;
    }

    void refreshBalance();
    let cancelled = false;
    void merchantService.getMerchantCredential(account.address).then((value) => {
      if (!cancelled) {
        setCredential(value);
        if (!value) setViewMode("customer");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [account, refreshBalance]);

  const signOut = useCallback(async () => {
    if (walletConnection.status !== "disconnected") await dAppKit.disconnectWallet();
    persistence.remove("session");
    setAccount(null);
    setViewMode("customer");
  }, [dAppKit, walletConnection.status]);

  const clearLocalData = useCallback(() => {
    if (walletConnection.status !== "disconnected") void dAppKit.disconnectWallet();
    persistence.clearAll();
    setAccount(null);
    setViewMode("customer");
  }, [dAppKit, walletConnection.status]);

  const value = useMemo<SessionValue>(
    () => ({
      ready,
      account,
      credential,
      isMerchant: Boolean(credential),
      viewMode,
      setViewMode,
      networkStatus,
      balance,
      balanceToken,
      gasBalance,
      signOut,
      clearLocalData,
      refreshBalance,
    }),
    [
      ready,
      account,
      credential,
      viewMode,
      networkStatus,
      balance,
      balanceToken,
      gasBalance,
      signOut,
      clearLocalData,
      refreshBalance,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside SessionProvider");
  return context;
}
