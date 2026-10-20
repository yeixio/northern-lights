import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { uploadMedia } from "../../lib/storage";
import { useAuth } from "../../auth/AuthProvider";
import { displayName, type Profile, type SiteSettings } from "../../lib/types";
import Avatar from "../../components/Avatar";
import ImagePicker from "../../components/ImagePicker";

export default function Admin() {
  const { profile: me } = useAuth();
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [members, setMembers] = useState<Profile[]>([]);

  const loadMembers = () =>
    supabase.from("profiles").select("*").order("created_at")
      .then(({ data }) => setMembers((data as Profile[]) ?? []));

  useEffect(() => {
    supabase.from("site_settings").select("*").single().then(({ data }) => setSettings(data as SiteSettings));
    void loadMembers();
  }, []);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    await supabase.from("site_settings").update(settings).eq("id", true);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function setFlag(p: Profile, patch: Partial<Profile>) {
    await supabase.from("profiles").update(patch).eq("id", p.id);
    await loadMembers();
  }

  async function remove(p: Profile) {
    if (!confirm(`Remove ${displayName(p)}? Their posts and messages will be deleted.`)) return;
    await supabase.from("profiles").delete().eq("id", p.id);
    await loadMembers();
  }

  const field = (key: keyof SiteSettings, label: string, textarea = false) => (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      {textarea ? (
        <textarea className="input min-h-32" value={settings?.[key] ?? ""} onChange={(e) => setSettings({ ...settings!, [key]: e.target.value })} />
      ) : (
        <input className="input" value={settings?.[key] ?? ""} onChange={(e) => setSettings({ ...settings!, [key]: e.target.value })} />
      )}
    </label>
  );

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">Public page</h1>
        {settings && (
          <form onSubmit={saveSettings} className="card space-y-3 p-4">
            {field("site_name", "Site name")}
            {field("tagline", "Tagline")}
            {field("about", "About", true)}
            {field("contact_email", "Contact email")}
            <div className="flex items-center gap-3">
              {settings.hero_image_url && <img src={settings.hero_image_url} alt="" className="h-16 w-28 rounded object-cover" />}
              <ImagePicker label="Header image" onPick={async ([f]) => {
                if (f) setSettings({ ...settings, hero_image_url: await uploadMedia("site", f) });
              }} />
            </div>
            <button className="btn-primary">{saved ? "Saved" : "Save"}</button>
          </form>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Members</h2>
        <div className="card divide-y divide-slate-100">
          {members.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 p-3">
              <Avatar profile={p} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{displayName(p)}</div>
                <div className="text-xs text-slate-500">{p.email}</div>
              </div>
              {p.id !== me?.id && (
                <div className="flex flex-wrap gap-2">
                  <button className="btn-secondary" onClick={() => setFlag(p, { is_approved: !p.is_approved })}>
                    {p.is_approved ? "Suspend" : "Approve"}
                  </button>
                  <button className="btn-secondary" onClick={() => setFlag(p, { is_admin: !p.is_admin })}>
                    {p.is_admin ? "Remove admin" : "Make admin"}
                  </button>
                  <button className="btn-danger" onClick={() => remove(p)}>Remove</button>
                </div>
              )}
              {p.id === me?.id && <span className="text-xs text-slate-400">You</span>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
