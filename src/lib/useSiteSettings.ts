import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { SiteSettings } from "./types";

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  useEffect(() => {
    supabase.from("site_settings").select("*").maybeSingle().then(({ data }) => {
      setSettings(data as SiteSettings | null);
      if (data?.site_name) document.title = data.site_name;
    });
  }, []);
  return settings;
}
