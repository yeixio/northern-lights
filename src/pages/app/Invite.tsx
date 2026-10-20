import { useEffect, useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { api, errorText } from "../../lib/api";
import type { Invitation } from "../../lib/types";
import { timeAgo } from "../../lib/format";

export default function Invite() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; link: string; emailed: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState<Invitation[]>([]);

  const load = () => api.get<Invitation[]>("/api/invitations").then(setSent);
  useEffect(() => void load(), []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setCreated(null);
    try {
      const res = await api.post<{ link: string; emailed: boolean }>("/api/invitations", { email, message });
      setCreated({ email, ...res });
      setEmail("");
      setMessage("");
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function copy(link: string) {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const pending = (i: Invitation) => !i.accepted_at && i.expires_at > new Date().toISOString();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Invite someone</h1>
        <p className="text-ink-600">Only invited people can join. Each invite link works once.</p>
      </div>
      <form onSubmit={submit} className="card space-y-3 p-4">
        <input className="input" type="email" required placeholder="friend@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <textarea className="input" placeholder="Personal note (optional)" value={message} onChange={(e) => setMessage(e.target.value)} />
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button className="btn-primary" disabled={busy}>{busy ? "Creating…" : "Create invite"}</button>
      </form>

      {created && (
        <div className="card space-y-2 border-primary-300 bg-primary-50 p-4 text-sm">
          <p>
            {created.emailed
              ? `We emailed an invite to ${created.email}. You can also send them this link yourself:`
              : `Send this link to ${created.email} by text, email, or however you like:`}
          </p>
          <div className="flex gap-2">
            <input className="input font-mono text-xs" readOnly value={created.link} onFocus={(e) => e.target.select()} />
            <button type="button" className="btn-secondary" onClick={() => copy(created.link)}>
              <Copy size={16} /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {sent.length > 0 && (
        <section className="card divide-y divide-ink-100">
          <h2 className="p-4 font-semibold">Invitations</h2>
          {sent.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
              <span className="truncate">{i.email}</span>
              <span className="flex shrink-0 items-center gap-2">
                <span className={i.accepted_at ? "text-primary-700" : "text-ink-400"}>
                  {i.accepted_at ? "Joined" : pending(i) ? `Sent ${timeAgo(i.created_at)}` : "Expired"}
                </span>
                {!i.accepted_at && (
                  <button onClick={() => api.del(`/api/invitations/${i.id}`).then(load)} className="text-ink-400 hover:text-rose-600" aria-label="Cancel invite">
                    <Trash2 size={14} />
                  </button>
                )}
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
