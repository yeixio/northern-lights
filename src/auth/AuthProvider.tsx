import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { closeLive } from "../lib/live";
import type { Me } from "../lib/types";
import type { Preferences } from "../lib/theme";

interface SessionInfo {
  user: Me | null;
  needsSetup: boolean;
  /** A hosted site waiting for its owner: only the setup link can create the admin. */
  setupNeedsLink?: boolean;
  /** Nothing can be posted or changed (a hosted site out of credit). */
  readOnly?: boolean;
  mailEnabled: boolean;
}

interface AuthState extends SessionInfo {
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  savePreferences: (p: Preferences) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<SessionInfo>({ user: null, needsSetup: false, mailEnabled: false });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setInfo(await api.get<SessionInfo>("/api/auth/session"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => void refresh(), [refresh]);

  const signOut = async () => {
    await api.post("/api/auth/logout");
    closeLive();
    await refresh();
  };

  // Applied right away so the colors change on click; saved in the background.
  const savePreferences = async (preferences: Preferences) => {
    setInfo((i) => (i.user ? { ...i, user: { ...i.user, preferences } } : i));
    await api.put("/api/me/preferences", preferences);
  };

  return <AuthContext.Provider value={{ ...info, loading, refresh, signOut, savePreferences }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
