"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { authApi } from "./api/auth";
import {
  clearStoredSession,
  getStoredSession,
  setStoredSession,
} from "./auth-storage";
import { setOnSessionExpired } from "./api-client";
import { decodeJwt, isExpired, type TokenClaims } from "./jwt";
import type { TokenPair } from "./types";

interface AuthContextValue {
  status: "loading" | "authenticated" | "unauthenticated";
  claims: TokenClaims | null;
  /**
   * Unified login: tries the Staff credentials endpoint first, and — only if
   * that rejects — falls back to the Driver credentials endpoint. Returns
   * decoded claims so the caller can route by kind/role. Throws the
   * driver-login error if both attempts fail.
   */
  login: (phone: string, password: string) => Promise<TokenClaims>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function applySession(tokens: TokenPair): TokenClaims | null {
  setStoredSession(tokens);
  return decodeJwt(tokens.accessToken);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  const [claims, setClaims] = useState<TokenClaims | null>(null);

  useEffect(() => {
    // One-time session hydration from localStorage on mount — this is a
    // synchronous read of an external store, not derived React state, so a
    // setState call here (rather than lazy useState init) is intentional.
    const session = getStoredSession();
    if (session) {
      const decoded = decodeJwt(session.accessToken);
      if (decoded && !isExpired(decoded)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setClaims(decoded);
        setStatus("authenticated");
        return;
      }
    }
    setStatus("unauthenticated");
  }, []);

  useEffect(() => {
    setOnSessionExpired(() => {
      setClaims(null);
      setStatus("unauthenticated");
      router.push("/");
    });
  }, [router]);

  const login = useCallback(async (phone: string, password: string): Promise<TokenClaims> => {
    try {
      const tokens = await authApi.staffLogin(phone, password);
      const next = applySession(tokens);
      if (!next) throw new Error("Invalid staff token");
      setClaims(next);
      setStatus("authenticated");
      return next;
    } catch {
      // Not a staff account (or wrong password) — fall back to Driver.
      const tokens = await authApi.driverPasswordLogin(phone, password);
      const next = applySession(tokens);
      if (!next) throw new Error("Invalid driver token");
      setClaims(next);
      setStatus("authenticated");
      return next;
    }
  }, []);

  const logout = useCallback(async () => {
    const session = getStoredSession();
    clearStoredSession();
    setClaims(null);
    setStatus("unauthenticated");
    if (session?.refreshToken) {
      try {
        await authApi.logout(session.refreshToken);
      } catch {
        // best-effort — client state is already cleared
      }
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, claims, login, logout }),
    [status, claims, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
