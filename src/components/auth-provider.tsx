"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, errorMessage } from "@/lib/api";
import { isProtectedPath } from "@/lib/routes";
import type { SetupStatus, User } from "@/lib/types";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  setupRequired: boolean;
  error: string | null;
  login: (email: string, password: string, remember: boolean) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<User | null>;
  setUser: (user: User | null) => void;
  setSetupRequired: (required: boolean) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<User | null> => {
    try {
      const status = await api<SetupStatus>("/setup/status");
      setSetupRequired(status.setup_required);
      setError(null);
      if (status.setup_required) {
        setUser(null);
        return null;
      }
      try {
        const data = await api<{ user: User }>("/auth/me");
        setUser(data.user);
        return data.user;
      } catch (meError) {
        if (meError instanceof ApiError && meError.status === 401) {
          setUser(null);
          return null;
        }
        throw meError;
      }
    } catch (statusError) {
      setError(errorMessage(statusError));
      throw statusError;
    }
  }, []);

  useEffect(() => {
    let active = true;
    refresh()
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (loading) return;
    const pathname = window.location.pathname;
    if (setupRequired && pathname !== "/setup") {
      router.replace("/setup");
      return;
    }
    if (!user && isProtectedPath(pathname)) {
      const next = `${pathname}${window.location.search}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [loading, setupRequired, user, router]);

  const login = useCallback(async (email: string, password: string, remember: boolean) => {
    const data = await api<{ user: User }>("/auth/login", {
      method: "POST",
      body: { email, password, remember },
    });
    setUser(data.user);
    setSetupRequired(false);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      router.push("/login");
      router.refresh();
    }
  }, [router]);

  const value = useMemo(
    () => ({
      user,
      loading,
      setupRequired,
      error,
      login,
      logout,
      refresh,
      setUser,
      setSetupRequired,
    }),
    [user, loading, setupRequired, error, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
