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
import { zkLoginService, type AuthProvider } from "@/services/auth/zkLogin.service";
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
  devMerchantOverride: boolean;
  setDevMerchantOverride: (value: boolean) => void;
  networkStatus: NetworkStatus;
  balance: number;
  balanceToken: string;
  gasBalance: number;
  signIn: (provider: AuthProvider) => Promise<void>;
  signInWithWallet: (address: string) => void;
  signOut: () => Promise<void>;
  clearLocalData: () => void;
  refreshBalance: () => Promise<void>;
}
const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const dAppKit = useDAppKit();
  const walletConnection = useWalletConnection();
  const currentNetwork = useCurrentNetwork();
  const [online, setOnline] = useState(true);
  const [ready, setReady] = useState(false);
  const [account, setAccount] = useState<SuiAccount | null>(null);
  const [credential, setCredential] = useState<MerchantCredential | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("customer");
  const [devMerchantOverride, setDevOverride] = useState(false);
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
    setDevOverride(persistence.read<boolean>("role-override", false));
    setAccount(persistence.read<SuiAccount | null>("session", null));
    setReady(true);
  }, []);

  const signInWithWallet = useCallback((address: string) => {
    const walletSession: SuiAccount = {
      address,
      provider: "wallet",
      displayName: "Sui Wallet User",
    };
    persistence.write("session", walletSession);
    setAccount(walletSession);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (walletConnection.status === "connected" && walletConnection.account) {
      if (account?.provider !== "wallet" || account.address !== walletConnection.account.address)
        signInWithWallet(walletConnection.account.address);
    } else if (walletConnection.status === "disconnected" && account?.provider === "wallet") {
      persistence.remove("session");
      setAccount(null);
    }
  }, [ready, walletConnection.status, walletConnection.account, account, signInWithWallet]);

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
    void merchantService
      .getMerchantCredential(account.address, devMerchantOverride)
      .then((value) => {
        if (!cancelled) {
          setCredential(value);
          if (!value) setViewMode("customer");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [account, devMerchantOverride, refreshBalance]);

  const signIn = useCallback(async (provider: AuthProvider) => {
    const value = await zkLoginService.signInWithProvider(provider);
    persistence.write("session", value);
    setAccount(value);
  }, []);
  const signOut = useCallback(async () => {
    if (account?.provider === "wallet") await dAppKit.disconnectWallet();
    await zkLoginService.signOut();
    persistence.remove("session");
    setAccount(null);
    setViewMode("customer");
  }, [account?.provider, dAppKit]);
  const setDevMerchantOverride = useCallback((value: boolean) => {
    persistence.write("role-override", value);
    setDevOverride(value);
  }, []);
  const clearLocalData = useCallback(() => {
    if (account?.provider === "wallet") void dAppKit.disconnectWallet();
    persistence.clearAll();
    setAccount(null);
    setDevOverride(false);
    setViewMode("customer");
  }, [account?.provider, dAppKit]);

  const value = useMemo<SessionValue>(
    () => ({
      ready,
      account,
      credential,
      isMerchant: Boolean(credential),
      viewMode,
      setViewMode,
      devMerchantOverride,
      setDevMerchantOverride,
      networkStatus,
      balance,
      balanceToken,
      gasBalance,
      signIn,
      signInWithWallet,
      signOut,
      clearLocalData,
      refreshBalance,
    }),
    [
      ready,
      account,
      credential,
      viewMode,
      devMerchantOverride,
      setDevMerchantOverride,
      networkStatus,
      balance,
      balanceToken,
      gasBalance,
      signIn,
      signInWithWallet,
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
