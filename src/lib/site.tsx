import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { api } from "./api";
import { useAuth } from "../auth/AuthProvider";
import { applyTheme, normalizeTheme, resolveTheme, type SiteTheme } from "./theme";
import type { SiteSettings } from "./types";

interface SiteState {
  settings: SiteSettings | null;
  theme: SiteTheme;
  /** Whether the page is showing in dark mode right now. */
  dark: boolean;
  reload: () => Promise<void>;
  /** Show an unsaved theme while an admin is trying it out; null to stop. */
  previewTheme: (t: SiteTheme | null) => void;
}

const SiteContext = createContext<SiteState | null>(null);
const CACHE = "nl-site";

function cached(): SiteSettings | null {
  try {
    return JSON.parse(localStorage.getItem(CACHE) ?? "null");
  } catch {
    return null;
  }
}

export function SiteProvider({ children }: { children: ReactNode }) {
  // The last copy we saw paints the right colors immediately, before the fetch.
  const [settings, setSettings] = useState<SiteSettings | null>(cached);
  const [preview, setPreview] = useState<SiteTheme | null>(null);

  const reload = useCallback(async () => {
    const s = await api.get<SiteSettings>("/api/public/site");
    setSettings(s);
    try {
      localStorage.setItem(CACHE, JSON.stringify(s));
    } catch {
      // private mode; not needed
    }
  }, []);

  useEffect(() => void reload().catch(() => undefined), [reload]);
  useEffect(() => {
    if (settings?.site_name) document.title = settings.site_name;
  }, [settings?.site_name]);
  useEffect(() => {
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!icon) return;
    icon.href = settings?.logo_url ?? "/favicon.svg";
    if (settings?.logo_url) icon.removeAttribute("type");
    else icon.type = "image/svg+xml";
  }, [settings?.logo_url]);

  const theme = preview ?? normalizeTheme(settings?.theme);

  // Public pages wear the site's theme; the private area adds the member's own preferences.
  const { pathname } = useLocation();
  const { user } = useAuth();
  const systemDark = useSystemDark();
  const prefs = pathname.startsWith("/app") ? user?.preferences : null;
  const resolved = useMemo(() => resolveTheme(theme, prefs, systemDark), [theme, prefs, systemDark]);
  useLayoutEffect(() => applyTheme(resolved), [resolved]);

  return (
    <SiteContext.Provider value={{ settings, theme, dark: resolved.dark, reload, previewTheme: setPreview }}>
      {children}
    </SiteContext.Provider>
  );
}

export function useSite() {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error("useSite must be used inside SiteProvider");
  return ctx;
}

function useSystemDark() {
  const query = "(prefers-color-scheme: dark)";
  const [dark, setDark] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setDark(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return dark;
}
