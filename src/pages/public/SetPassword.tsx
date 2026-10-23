import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, errorText } from "../../lib/api";
import { useAuth } from "../../auth/AuthProvider";
import Spinner from "../../components/Spinner";
import SiteLogo from "../../components/SiteLogo";

/**
 * Three account forms that share a layout:
 *  - setup:   first run, creates the admin account
 *  - welcome: accepting an invite link (/welcome?token=…)
 *  - reset:   choosing a new password from a reset link (/reset-password?token=…)
 */
export default function SetPassword({ mode }: { mode: "setup" | "welcome" | "reset" }) {
  const { refresh, needsSetup, setupNeedsLink, loading } = useAuth();
  const navigate = useNavigate();
  const token = useSearchParams()[0].get("token") ?? "";
  const [invite, setInvite] = useState<{ email: string; message: string | null } | null | undefined>(undefined);
  const [email, setEmail] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "welcome") return;
    api.get<{ email: string; message: string | null }>(`/api/auth/invitations/${encodeURIComponent(token)}`)
      .then(setInvite)
      .catch(() => setInvite(null));
  }, [mode, token]);

  if (loading || (mode === "welcome" && invite === undefined)) return <Spinner full />;
  if (mode === "setup" && !needsSetup) {
    return <p className="p-12 text-center text-ink-500">This site is already set up. <a className="underline" href="/login">Sign in</a>.</p>;
  }
  if (mode === "setup" && setupNeedsLink && !token) {
    return <p className="p-12 text-center text-ink-500">This site is waiting for its owner. Open the setup link from your welcome email.</p>;
  }
  if (mode === "welcome" && !invite) {
    return <p className="p-12 text-center text-ink-500">This invite has expired or was already used. Ask for a new one.</p>;
  }
  if (mode === "reset" && !token) {
    return <p className="p-12 text-center text-ink-500">This reset link is incomplete. Ask for a new one.</p>;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Use at least 8 characters.");
    setBusy(true);
    setError(null);
    try {
      if (mode === "setup") {
        await api.post("/api/auth/setup", { email, password, first_name: first, last_name: last, setup_token: token || undefined });
      } else if (mode === "welcome") {
        await api.post("/api/auth/invitations/accept", { token, password, first_name: first, last_name: last });
      } else {
        await api.post("/api/auth/password/reset", { token, password });
      }
      await refresh();
      navigate(mode === "setup" ? "/" : "/app", { replace: true });
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  const title = {
    setup: "Set up your site",
    welcome: "Welcome! Create your account",
    reset: "Choose a new password",
  }[mode];

  return (
    <div className="bg-gradient-to-b from-primary-50 to-ink-50 px-4 py-16 sm:py-24">
      <div className="mx-auto max-w-sm">
      <SiteLogo className="mx-auto mb-6 h-12 w-12 drop-shadow-lg" />
      <form onSubmit={submit} className="card space-y-4 p-7 shadow-xl">
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          {mode === "setup" && <p className="mt-1 text-sm text-ink-500">This first account is the site admin.</p>}
          {mode === "welcome" && <p className="mt-1 text-sm text-ink-500">Joining as {invite!.email}</p>}
          {invite?.message && <p className="mt-3 rounded-lg bg-ink-100 p-3 text-sm italic">“{invite.message}”</p>}
        </div>
        {mode === "setup" && (
          <input className="input" type="email" required placeholder="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        )}
        {mode !== "reset" && (
          <div className="grid grid-cols-2 gap-2">
            <input className="input" required placeholder="First name" value={first} onChange={(e) => setFirst(e.target.value)} />
            <input className="input" required placeholder="Last name" value={last} onChange={(e) => setLast(e.target.value)} />
          </div>
        )}
        <input className="input" type="password" required minLength={8} placeholder="Password (8+ characters)" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>Continue</button>
      </form>
      </div>
    </div>
  );
}
