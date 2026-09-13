import { createContext, useContext } from "react";
import type { User } from "../api/types.ts";

// "loading" is the moment after a page load when the app is still asking
// the server whether the refresh cookie holds a valid session.
export type AuthStatus = "loading" | "anonymous" | "authenticated";

export type Credentials = { email: string; password: string };
export type Registration = Credentials & { name: string; phone?: string };

export type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  login: (credentials: Credentials) => Promise<void>;
  register: (registration: Registration) => Promise<void>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return value;
}
