import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { Invitation } from "../../lib/types";
import { timeAgo } from "../../lib/format";

export default function Invite() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [sent, setSent] = useState<Invitation[]>([]);

  const load = () =>
    supabase.from("invitations").select("*").order("created_at", { ascending: false })
      .then(({ data }) => setSent((data as Invitation[]) ?? []));
  useEffect(() => void load(), []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    const { data, error } = await supabase.functions.invoke("invite-user", {
      body: { email, message, redirectTo: `${window.location.origin}/welcome` },
    });
    let text = data?.error as string | undefined;
    if (error && !text) {
      // Edge function errors carry the JSON body on the response.
      const ctx = (error as { context?: Response }).context;
      text = (await ctx?.json?.().catch(() => null))?.error ?? error.message;
    }
    setResult(text ? { ok: false, text } : { ok: true, text: `Invite sent to ${email}.` });
    if (!text) {
      setEmail("");
      setMessage("");
      await load();
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Invite someone</h1>
        <p className="text-slate-600">They'll get an email with a link to join. Only invited people can sign in.</p>
      </div>
      <form onSubmit={submit} className="card space-y-3 p-4">
        <input className="input" type="email" required placeholder="friend@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <textarea className="input" placeholder="Personal note (optional)" value={message} onChange={(e) => setMessage(e.target.value)} />
        {result && <p className={`text-sm ${result.ok ? "text-emerald-700" : "text-rose-600"}`}>{result.text}</p>}
        <button className="btn-primary" disabled={busy}>{busy ? "Sending…" : "Send invite"}</button>
      </form>
      {sent.length > 0 && (
        <section className="card divide-y divide-slate-100">
          <h2 className="p-4 font-semibold">Invitations you've sent</h2>
          {sent.map((i) => (
            <div key={i.id} className="flex justify-between px-4 py-2 text-sm">
              <span>{i.email}</span>
              <span className={i.accepted_at ? "text-emerald-700" : "text-slate-400"}>
                {i.accepted_at ? "Joined" : `Sent ${timeAgo(i.created_at)}`}
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
