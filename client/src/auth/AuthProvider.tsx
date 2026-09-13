import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  apiRequest,
  mayHaveSession,
  onSessionChange,
  refreshSession,
  setSession,
} from "../api/http.ts";
import type { Session, User } from "../api/types.ts";
import { AuthContext, type AuthContextValue } from "./AuthContext.ts";

export function AuthProvider({ children }: { children: ReactNode }) {
  // undefined: still finding out. null: nobody is logged in.
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const queryClient = useQueryClient();

  useEffect(() => {
    const stopListening = onSessionChange(setUser);
    // After a page load the access token is gone from memory, so ask for a
    // new one with the refresh cookie. In development React runs this
    // effect twice; refreshSession() makes both runs share one request.
    if (mayHaveSession()) {
      refreshSession().catch(() => setUser(null));
    } else {
      setUser(null);
    }
    return stopListening;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status: user === undefined ? "loading" : user === null ? "anonymous" : "authenticated",
      user: user ?? null,

      async login(credentials) {
        setSession(
          await apiRequest<Session>("/auth/login", { method: "POST", body: credentials }),
        );
      },

      async register(registration) {
        setSession(
          await apiRequest<Session>("/auth/register", { method: "POST", body: registration }),
        );
      },

      async logout() {
        try {
          await apiRequest("/auth/logout", { method: "POST" });
        } catch {
          // Forget the session here even if the server couldn't be told.
        }
        setSession(null);
        // The next person to log in on this device must not see these.
        queryClient.removeQueries({ queryKey: ["bookings"] });
      },
    }),
    [user, queryClient],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
