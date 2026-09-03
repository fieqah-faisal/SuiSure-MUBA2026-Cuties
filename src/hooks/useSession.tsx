import { useDAppKit } from "@mysten/dapp-kit-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

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
  signIn: (provider: AuthProvider) => Promise<void>;
  signInWithWallet: (address: string) => void;
  signOut: () => Promise<void>;
  clearLocalData: () => void;
  refreshBalance: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const dAppKit = useDAppKit();
  const [ready, setReady] = useState(false);
  const [account, setAccount] = useState<SuiAccount | null>(null);
  const [credential, setCredential] = useState<MerchantCredential | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("customer");
  const [devMerchantOverride, setDevOverride] = useState(false);
  const [networkStatus] = useState<NetworkStatus>("online");
  const [balance, setBalance] = useState(0);
  const [balanceToken, setBalanceToken] = useState<string>(SUI_CONFIG.defaultToken);

  useEffect(() => {
    const stored = persistence.read<SuiAccount | null>("session", null);
    const override = persistence.read<boolean>("role-override", false);
    setDevOverride(override);
    setAccount(stored);
    setReady(true);
  }, []);

  const refreshBalance = useCallback(async () => {
    const b = await paymentService.getBalance();
    setBalance(b.amount);
    setBalanceToken(b.token);
  }, []);

  useEffect(() => {
    if (!account) {
      setCredential(null);
      return;
    }
    void refreshBalance();
    let cancelled = false;
    void merchantService
      .getMerchantCredential(account.address, devMerchantOverride)
      .then((c) => {
        if (!cancelled) {
          setCredential(c);
          if (!c) setViewMode("customer");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [account, devMerchantOverride, refreshBalance]);

  const signIn = useCallback(async (provider: AuthProvider) => {
    const acc = await zkLoginService.signInWithProvider(provider);
    persistence.write("session", acc);
    setAccount(acc);
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
      signIn,
      signInWithWallet,
      signOut,
      clearLocalData,
      refreshBalance,
    }),
    [ready, account, credential, viewMode, devMerchantOverride, setDevMerchantOverride, networkStatus, balance, balanceToken, signIn, signInWithWallet, signOut, clearLocalData, refreshBalance],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
