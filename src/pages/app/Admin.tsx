import { useEffect, useState } from "react";
import { api, errorText } from "../../lib/api";
import { uploadFiles } from "../../lib/storage";
import { useAuth } from "../../auth/AuthProvider";
import { displayName, type Profile, type SiteSettings } from "../../lib/types";
import Avatar from "../../components/Avatar";
import ImagePicker from "../../components/ImagePicker";

export default function Admin() {
  const { user: me } = useAuth();
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [resetLink, setResetLink] = useState<{ name: string; link: string } | null>(null);

  const loadMembers = () => api.get<Profile[]>("/api/admin/members").then(setMembers);

  useEffect(() => {
    api.get<SiteSettings>("/api/public/site").then(setSettings);
    void loadMembers();
  }, []);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setError(null);
    try {
      await api.put("/api/admin/site", settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function setFlag(p: Profile, patch: Partial<Pick<Profile, "is_admin" | "is_active">>) {
    await api.patch(`/api/admin/members/${p.id}`, patch);
    await loadMembers();
  }

  async function remove(p: Profile) {
    if (!confirm(`Remove ${displayName(p)}? Their posts, comments and messages will be deleted.`)) return;
    await api.del(`/api/admin/members/${p.id}`);
    await loadMembers();
  }

  async function makeResetLink(p: Profile) {
    const { link } = await api.post<{ link: string }>(`/api/admin/members/${p.id}/reset-link`);
    setResetLink({ name: displayName(p), link });
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
            <div className="flex flex-wrap items-center gap-3">
              {settings.hero_image_url && <img src={settings.hero_image_url} alt="" className="h-16 w-28 rounded object-cover" />}
              <ImagePicker label="Header image" onPick={async ([f]) => {
                if (!f) return;
                const [up] = await uploadFiles([f]);
                setSettings({ ...settings, hero_image_url: up.url });
              }} />
              {settings.hero_image_url && (
                <button type="button" className="text-sm text-slate-500 hover:underline" onClick={() => setSettings({ ...settings, hero_image_url: null })}>
                  Remove image
                </button>
              )}
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <button className="btn-primary">{saved ? "Saved" : "Save"}</button>
          </form>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Members</h2>
        {resetLink && (
          <div className="card space-y-2 border-emerald-300 bg-emerald-50 p-4 text-sm">
            <p>Send this one-time link to {resetLink.name}. It works for 2 hours.</p>
            <input className="input font-mono text-xs" readOnly value={resetLink.link} onFocus={(e) => e.target.select()} />
          </div>
        )}
        <div className="card divide-y divide-slate-100">
          {members.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 p-3">
              <Avatar profile={p} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {displayName(p)}
                  {p.is_admin && <span className="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-xs text-violet-700">Admin</span>}
                  {!p.is_active && <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 text-xs text-rose-700">Suspended</span>}
                </div>
                <div className="text-xs text-slate-500">{p.email}</div>
              </div>
              {p.id !== me?.id ? (
                <div className="flex flex-wrap gap-2">
                  <button className="btn-secondary" onClick={() => makeResetLink(p)}>Reset link</button>
                  <button className="btn-secondary" onClick={() => setFlag(p, { is_active: !p.is_active })}>
                    {p.is_active ? "Suspend" : "Restore"}
                  </button>
                  <button className="btn-secondary" onClick={() => setFlag(p, { is_admin: !p.is_admin })}>
                    {p.is_admin ? "Remove admin" : "Make admin"}
                  </button>
                  <button className="btn-danger" onClick={() => remove(p)}>Remove</button>
                </div>
              ) : (
                <span className="text-xs text-slate-400">You</span>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
