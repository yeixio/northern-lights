import { useEffect, useState } from "react";
import { api, errorText } from "../../lib/api";
import { Link } from "react-router-dom";
import { ArrowRight, LayoutTemplate, Palette } from "lucide-react";
import { useSite } from "../../lib/site";
import { useAuth } from "../../auth/AuthProvider";
import { displayName, type Profile, type SiteSettings } from "../../lib/types";
import Avatar from "../../components/Avatar";

export default function Admin() {
  const { user: me } = useAuth();
  const { reload } = useSite();
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
      await reload();
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

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-1 text-ink-500">Run the site: how it looks, what visitors see, and who can sign in.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link to="/?edit" className="card group flex items-start gap-4 p-5 transition hover:border-primary-300 hover:shadow-md">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700"><LayoutTemplate size={20} /></span>
          <span>
            <span className="flex items-center gap-1 font-semibold">Edit home page <ArrowRight size={16} className="transition group-hover:translate-x-0.5" /></span>
            <span className="mt-1 block text-sm text-ink-500">Change text and photos, and add, remove or reorder sections, right on the page.</span>
          </span>
        </Link>
        <Link to="/?edit=theme" className="card group flex items-start gap-4 p-5 transition hover:border-primary-300 hover:shadow-md">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-100 text-accent-700"><Palette size={20} /></span>
          <span>
            <span className="flex items-center gap-1 font-semibold">Theme <ArrowRight size={16} className="transition group-hover:translate-x-0.5" /></span>
            <span className="mt-1 block text-sm text-ink-500">Palette, custom colors, light or dark, type and corners for the whole site.</span>
          </span>
        </Link>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Site details</h2>
        {settings && (
          <form onSubmit={saveSettings} className="card space-y-4 p-5">
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Site name</span>
              <input className="input" required value={settings.site_name} onChange={(e) => setSettings({ ...settings, site_name: e.target.value })} />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Contact email</span>
              <span className="block text-xs text-ink-500">Shown in the footer of the public page. Leave empty to hide it.</span>
              <input className="input" type="email" value={settings.contact_email ?? ""} onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })} />
            </label>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <button className="btn-primary">{saved ? "Saved" : "Save"}</button>
          </form>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Members</h2>
        {resetLink && (
          <div className="card space-y-2 border-primary-300 bg-primary-50 p-4 text-sm">
            <p>Send this one-time link to {resetLink.name}. It works for 2 hours.</p>
            <input className="input font-mono text-xs" readOnly value={resetLink.link} onFocus={(e) => e.target.select()} />
          </div>
        )}
        <div className="card divide-y divide-ink-100">
          {members.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 p-3">
              <Avatar profile={p} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {displayName(p)}
                  {p.is_admin && <span className="ml-2 rounded bg-accent-100 px-1.5 py-0.5 text-xs text-accent-700">Admin</span>}
                  {!p.is_active && <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 text-xs text-rose-700">Suspended</span>}
                </div>
                <div className="text-xs text-ink-500">{p.email}</div>
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
                <span className="text-xs text-ink-400">You</span>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
