import { createContext } from "react";
import type { AuthTokenResponse, AuthUser } from "./api/client";

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setSession: (tokens: AuthTokenResponse) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
