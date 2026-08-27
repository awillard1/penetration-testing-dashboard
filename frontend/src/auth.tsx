import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  authApi,
  clearStoredTokens,
  getStoredAccessToken,
  getStoredRefreshToken,
  setStoredTokens,
  type AuthTokenResponse,
  type AuthUser,
} from "./api/client";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setSession: (tokens: AuthTokenResponse) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const accessToken = getStoredAccessToken();
      const refreshToken = getStoredRefreshToken();
      if (!accessToken && !refreshToken) {
        if (!cancelled) setIsLoading(false);
        return;
      }
      try {
        const currentUser = accessToken
          ? await authApi.me()
          : (await authApi.refresh(refreshToken ?? undefined)).user;
        if (!cancelled) setUser(currentUser);
      } catch {
        clearStoredTokens();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login: async (username: string, password: string) => {
        const tokens = await authApi.login({ username, password });
        setStoredTokens(tokens);
        setUser(tokens.user);
      },
      logout: async () => {
        const refreshToken = getStoredRefreshToken();
        try {
          await authApi.logout(refreshToken ?? undefined);
        } finally {
          clearStoredTokens();
          setUser(null);
        }
      },
      setSession: (tokens: AuthTokenResponse) => {
        setStoredTokens(tokens);
        setUser(tokens.user);
      },
    }),
    [isLoading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
