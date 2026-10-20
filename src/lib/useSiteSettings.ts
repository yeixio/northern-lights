import { useEffect, useState } from "react";
import { api } from "./api";
import type { SiteSettings } from "./types";

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  useEffect(() => {
    api.get<SiteSettings>("/api/public/site").then((s) => {
      setSettings(s);
      if (s?.site_name) document.title = s.site_name;
    }).catch(() => undefined);
  }, []);
  return settings;
}
