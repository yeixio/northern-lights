import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, ImagePlus, Lock, Mail, MessageCircle, Send, Trash2 } from "lucide-react";
import { api, errorText } from "../../lib/api";
import { uploadFiles } from "../../lib/storage";
import { useSite } from "../../lib/site";
import { useAuth } from "../../auth/AuthProvider";
import type { SiteSettings as Settings } from "../../lib/types";
import SiteLogo from "../../components/SiteLogo";
import { Field, Segmented, Toggle } from "../../components/ui";

type Details = Pick<Settings, "site_name" | "tagline" | "logo_url" | "contact_email" | "footer_text" | "show_credit">;

const pick = (s: Settings): Details => ({
  site_name: s.site_name,
  tagline: s.tagline,
  logo_url: s.logo_url,
  contact_email: s.contact_email,
  footer_text: s.footer_text,
  show_credit: s.show_credit,
});

/** Name, logo, link previews, footer and email: everything that used to need a config file. */
export default function SiteSettings() {
  const { settings, reload } = useSite();
  const [form, setForm] = useState<Details | null>(settings ? pick(settings) : null);
  const [savedForm, setSavedForm] = useState<Details | null>(form);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings && !form) {
      setForm(pick(settings));
      setSavedForm(pick(settings));
    }
  }, [settings, form]);

  if (!form) return null;
  const set = (patch: Partial<Details>) => {
    setForm({ ...form, ...patch });
    setStatus(null);
  };
  const dirty = JSON.stringify(form) !== JSON.stringify(savedForm);

  async function uploadLogo(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const [up] = await uploadFiles([file]);
      set({ logo_url: up.url });
    } catch (err) {
      setStatus({ ok: false, text: errorText(err) });
    } finally {
      setUploading(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    try {
      await api.put("/api/admin/site", form);
      await reload();
      setSavedForm(form);
      setStatus({ ok: true, text: "Saved. Visitors see the changes now." });
    } catch (err) {
      setStatus({ ok: false, text: errorText(err) });
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <Link to="/app/admin" className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900">
          <ArrowLeft size={14} /> Admin
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Site settings</h1>
        <p className="mt-1 text-ink-500">Your site's name, logo and footer, and email for invitations. The preview shows what changes as you type.</p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <form onSubmit={save} className="space-y-6">
            <section className="card space-y-5 p-6">
              <h2 className="text-lg font-semibold">Name and logo</h2>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Site name</span>
                <input className="input" required maxLength={200} value={form.site_name} onChange={(e) => set({ site_name: e.target.value })} />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Short description</span>
                <span className="block text-xs text-ink-500">One sentence about your site. It shows up when someone shares a link to it in a chat or on social media.</span>
                <textarea className="input min-h-20" maxLength={500} value={form.tagline ?? ""} onChange={(e) => set({ tagline: e.target.value })} />
              </label>
              <Field label="Logo" hint="A square picture works best. It appears next to your site name, on the sign-in page and in the browser tab.">
                <div className="flex items-center gap-4">
                  <span className="flex h-16 w-16 items-center justify-center rounded-xl border border-ink-200 bg-ink-50">
                    <SiteLogo src={form.logo_url} className="h-12 w-12" />
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-secondary" disabled={uploading} onClick={() => fileInput.current?.click()}>
                      <ImagePlus size={16} /> {uploading ? "Uploading…" : form.logo_url ? "Change logo" : "Upload logo"}
                    </button>
                    {form.logo_url && (
                      <button type="button" className="btn-secondary" onClick={() => set({ logo_url: null })}>
                        <Trash2 size={16} /> Use the default
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    hidden
                    onChange={(e) => {
                      void uploadLogo(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </div>
              </Field>
            </section>

            <section className="card space-y-5 p-6">
              <h2 className="text-lg font-semibold">Footer</h2>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Contact email</span>
                <span className="block text-xs text-ink-500">Shown at the bottom of the public page. Leave it empty to hide it.</span>
                <input className="input" type="email" value={form.contact_email ?? ""} onChange={(e) => set({ contact_email: e.target.value })} />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Footer note</span>
                <span className="block text-xs text-ink-500">A line of your own, like "Made with love in Tromsø".</span>
                <input className="input" maxLength={500} value={form.footer_text ?? ""} onChange={(e) => set({ footer_text: e.target.value })} />
              </label>
              <Toggle
                label={`Show "Powered by Northern Lights"`}
                hint="A small link to the project that makes this site."
                checked={form.show_credit}
                onChange={(show_credit) => set({ show_credit })}
              />
            </section>

            <div className="sticky bottom-20 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-ink-200 bg-surface/95 p-3 shadow-lg backdrop-blur md:bottom-4">
              <button className="btn-primary" disabled={!dirty || uploading}>{dirty ? "Save changes" : <><Check size={16} /> Saved</>}</button>
              {dirty && (
                <button type="button" className="btn-secondary" onClick={() => savedForm && setForm(savedForm)}>Undo changes</button>
              )}
              {status && <span className={`text-sm ${status.ok ? "text-primary-700" : "text-rose-600"}`}>{status.text}</span>}
              {!status && dirty && <span className="text-sm text-ink-500">Visitors won't see changes until you save.</span>}
            </div>
          </form>

          <EmailSettings />
        </div>

        <Preview form={form} />
      </div>
    </div>
  );
}

/** How the name, logo and description look in a browser tab, a shared link and the footer. */
function Preview({ form }: { form: Details }) {
  const { host, origin } = window.location;
  const name = form.site_name || "Your site";
  return (
    <aside className="space-y-4 lg:sticky lg:top-6">
      <div className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Preview</div>

      <div className="overflow-hidden rounded-xl border border-ink-200 bg-surface shadow-sm">
        <div className="flex items-end gap-1 bg-ink-100 px-2 pt-2">
          <div className="flex max-w-[75%] items-center gap-2 rounded-t-lg bg-surface px-3 py-2 text-xs">
            <SiteLogo src={form.logo_url} className="h-4 w-4 rounded-sm" />
            <span className="truncate">{name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 border-b border-ink-200 px-3 py-2">
          <Lock size={11} className="text-ink-400" />
          <span className="truncate rounded-full bg-ink-100 px-3 py-0.5 text-xs text-ink-500">{host}</span>
        </div>
        <div className="flex items-center justify-between gap-2 px-3 py-3">
          <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
            <SiteLogo src={form.logo_url} className="h-6 w-6" />
            <span className="truncate">{name}</span>
          </span>
          <span className="rounded-md bg-primary-600 px-2 py-1 text-[11px] font-medium text-on-primary">Members</span>
        </div>
        <div className="aurora h-14" />
        <div className="space-y-1 border-t border-ink-200 px-3 py-3 text-[11px] text-ink-500">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>© {new Date().getFullYear()} {name}</span>
            {form.contact_email && <span className="truncate">{form.contact_email}</span>}
          </div>
          {form.footer_text && <div className="text-ink-400">{form.footer_text}</div>}
          {form.show_credit && <div className="text-ink-400">Powered by Northern Lights</div>}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs text-ink-500"><MessageCircle size={13} /> When you share a link to your site</div>
        <div className="ml-auto max-w-[290px] rounded-2xl rounded-br-md bg-primary-600 p-1.5 text-on-primary shadow-sm">
          <div className="overflow-hidden rounded-xl bg-surface text-ink-900">
            <div className="flex h-28 items-center justify-center bg-ink-100">
              <SiteLogo src={form.logo_url} className={form.logo_url ? "h-28 w-full rounded-none" : "h-14 w-14"} />
            </div>
            <div className="space-y-0.5 p-3">
              <div className="text-sm font-semibold">{name}</div>
              {form.tagline && <div className="line-clamp-2 text-xs text-ink-600">{form.tagline}</div>}
              <div className="text-[11px] text-ink-400">{host}</div>
            </div>
          </div>
          <div className="px-2 py-1 text-sm">{origin}</div>
        </div>
      </div>
    </aside>
  );
}

type Security = "ssl" | "starttls" | "none";
interface MailForm {
  host: string;
  port: number;
  security: Security;
  user: string;
  pass: string;
  from_name: string;
  from_email: string;
}
interface MailState {
  source: "env" | "site" | "off";
  settings: Omit<MailForm, "pass"> | null;
  has_password: boolean;
}

const PROVIDERS = {
  gmail: { name: "Gmail", host: "smtp.gmail.com", port: 465, security: "ssl", help: "Use an app password, not your normal one: turn on 2-Step Verification, then make one at myaccount.google.com/apppasswords." },
  icloud: { name: "iCloud Mail", host: "smtp.mail.me.com", port: 587, security: "starttls", help: "Use an app-specific password from account.apple.com, under Sign-In and Security." },
  fastmail: { name: "Fastmail", host: "smtp.fastmail.com", port: 465, security: "ssl", help: "Use an app password from Settings, Privacy & Security, in Fastmail." },
  other: { name: "Other", host: "", port: 587, security: "starttls", help: "Your email provider's help pages list these as SMTP or \"outgoing mail\" settings." },
} as const satisfies Record<string, { name: string; host: string; port: number; security: Security; help: string }>;
type Provider = keyof typeof PROVIDERS;

const providerFor = (host: string): Provider =>
  (Object.keys(PROVIDERS) as Provider[]).find((p) => p !== "other" && PROVIDERS[p].host === host) ?? "other";

const serverOf = (p: (typeof PROVIDERS)[Provider]) => ({ host: p.host, port: p.port, security: p.security as Security });
const emptyMail = (): MailForm => ({ ...serverOf(PROVIDERS.gmail), user: "", pass: "", from_name: "", from_email: "" });

/** Email for invitations and password resets, set up from a form instead of SMTP_URL. */
function EmailSettings() {
  const { user } = useAuth();
  const { settings: site } = useSite();
  const [state, setState] = useState<MailState | null>(null);
  const [form, setForm] = useState<MailForm>(emptyMail);
  const [provider, setProvider] = useState<Provider>("gmail");
  const [busy, setBusy] = useState<"test" | "save" | "off" | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () =>
    api.get<MailState>("/api/admin/mail").then((s) => {
      setState(s);
      if (s.settings) {
        setForm({ ...s.settings, pass: "" });
        setProvider(providerFor(s.settings.host));
      }
    });
  useEffect(() => void load(), []);

  if (!state) return null;
  const set = (patch: Partial<MailForm>) => {
    setForm({ ...form, ...patch });
    setStatus(null);
  };
  // Most providers sign in with the full email address.
  const payload = () => ({ ...form, user: form.user || form.from_email });

  async function run(kind: "test" | "save" | "off") {
    setBusy(kind);
    setStatus(null);
    try {
      if (kind === "test") {
        const { to } = await api.post<{ to: string }>("/api/admin/mail/test", state?.source === "env" ? {} : payload());
        setStatus({ ok: true, text: `Sent! Check ${to} for the test email.` });
      } else if (kind === "save") {
        await api.put("/api/admin/mail", payload());
        await load();
        setStatus({ ok: true, text: "Saved. Invitations and password resets will be emailed now." });
      } else {
        await api.del("/api/admin/mail");
        setForm(emptyMail());
        setProvider("gmail");
        await load();
        setStatus({ ok: true, text: "Email is off. Invite links will be shown on screen instead." });
      }
    } catch (err) {
      setStatus({ ok: false, text: errorText(err) });
    } finally {
      setBusy(null);
    }
  }

  const on = state.source !== "off";
  const p = PROVIDERS[provider];
  return (
    <section className="card space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Mail size={18} /> Email</h2>
          <p className="mt-1 text-sm text-ink-500">
            Without email, invite and password-reset links are shown on screen for you to pass along.
            Connect an email account and they're sent automatically.
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${on ? "bg-primary-100 text-primary-700" : "bg-ink-100 text-ink-600"}`}>
          {on ? "Email is on" : "Email is off"}
        </span>
      </div>

      {state.source === "env" ? (
        <div className="space-y-3">
          <p className="rounded-lg bg-ink-50 p-3 text-sm text-ink-600">
            Email is set up in the server's configuration (<code>SMTP_URL</code>), so it can't be changed here.
          </p>
          <button type="button" className="btn-secondary" disabled={busy !== null} onClick={() => void run("test")}>
            <Send size={16} /> {busy === "test" ? "Sending…" : `Send a test email to ${user?.email}`}
          </button>
        </div>
      ) : (
        <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); void run("save"); }}>
          <Field label="Your email provider">
            <Segmented
              label="Email provider"
              value={provider}
              onChange={(next) => {
                setProvider(next);
                set(serverOf(PROVIDERS[next]));
              }}
              options={(Object.keys(PROVIDERS) as Provider[]).map((k) => [k, PROVIDERS[k].name] as const)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Email address</span>
              <span className="block text-xs text-ink-500">Invitations come from this address.</span>
              <input className="input" type="email" required placeholder="you@example.com" value={form.from_email} onChange={(e) => set({ from_email: e.target.value })} />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Password</span>
              <span className="block text-xs text-ink-500">{state.has_password ? "Saved. Leave empty to keep it." : "An app password from your provider."}</span>
              <input className="input" type="password" autoComplete="new-password" placeholder={state.has_password ? "••••••••" : ""} value={form.pass} onChange={(e) => set({ pass: e.target.value })} />
            </label>
          </div>
          <p className="rounded-lg bg-ink-50 p-3 text-xs text-ink-600">{p.help}</p>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Sender name</span>
            <input className="input" placeholder={site?.site_name ?? ""} value={form.from_name} onChange={(e) => set({ from_name: e.target.value })} />
          </label>

          <details className="group rounded-lg border border-ink-200" open={provider === "other" || undefined}>
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Server settings</summary>
            <div className="grid gap-4 border-t border-ink-200 p-4 sm:grid-cols-2">
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Outgoing mail server (SMTP)</span>
                <input className="input" required placeholder="smtp.example.com" value={form.host} onChange={(e) => set({ host: e.target.value })} />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Port</span>
                <input className="input" type="number" min={1} max={65535} required value={form.port} onChange={(e) => set({ port: Number(e.target.value) })} />
              </label>
              <Field label="Security">
                <Segmented
                  label="Security"
                  value={form.security}
                  onChange={(security) => set({ security })}
                  options={[["ssl", "SSL/TLS"], ["starttls", "STARTTLS"], ["none", "None"]]}
                />
              </Field>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Username</span>
                <input className="input" placeholder={form.from_email || "Same as the email address"} value={form.user} onChange={(e) => set({ user: e.target.value })} />
              </label>
            </div>
          </details>

          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-primary" disabled={busy !== null}>{busy === "save" ? "Saving…" : "Save email settings"}</button>
            <button type="button" className="btn-secondary" disabled={busy !== null || !form.from_email || !form.host} onClick={() => void run("test")}>
              <Send size={16} /> {busy === "test" ? "Sending…" : "Send a test email"}
            </button>
            {state.source === "site" && (
              <button type="button" className="btn-secondary" disabled={busy !== null} onClick={() => void run("off")}>Turn email off</button>
            )}
          </div>
        </form>
      )}
      {status && <p className={`text-sm ${status.ok ? "text-primary-700" : "text-rose-600"}`}>{status.text}</p>}
    </section>
  );
}
