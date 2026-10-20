import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { api, errorText } from "../../lib/api";
import { useAuth } from "../../auth/AuthProvider";

export default function Login() {
  const { user, needsSetup, mailEnabled, refresh } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? "/app";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"password" | "reset">("password");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (needsSetup) return <Navigate to="/setup" replace />;
  if (user) return <Navigate to={from} replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "password") {
        await api.post("/api/auth/login", { email, password });
        await refresh();
        navigate(from, { replace: true });
      } else {
        await api.post("/api/auth/password/forgot", { email });
        setNotice("If that email belongs to a member, a reset link is on its way.");
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-gradient-to-b from-primary-50 to-ink-50 px-4 py-16 sm:py-24">
      <div className="mx-auto max-w-sm">
      <img src="/favicon.svg" alt="" className="mx-auto mb-6 h-12 w-12 drop-shadow-lg" />
      <form onSubmit={submit} className="card space-y-4 p-7 shadow-xl">
        <div>
          <h1 className="text-xl font-semibold">{mode === "password" ? "Member login" : "Reset password"}</h1>
          <p className="mt-1 text-sm text-ink-500">
            {mode === "password"
              ? "This network is invite-only. Ask a member to invite you."
              : mailEnabled
                ? "We'll email you a link to choose a new password."
                : "Email isn't set up on this site. Ask an admin to send you a reset link."}
          </p>
        </div>
        {(mode === "password" || mailEnabled) && (
          <input className="input" type="email" required placeholder="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        )}
        {mode === "password" && (
          <input className="input" type="password" required placeholder="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        )}
        {error && <p className="text-sm text-rose-600">{error}</p>}
        {notice && <p className="text-sm text-primary-700">{notice}</p>}
        {(mode === "password" || mailEnabled) && (
          <button className="btn-primary w-full" disabled={busy}>
            {mode === "password" ? "Sign in" : "Send reset link"}
          </button>
        )}
        <button type="button" className="w-full text-sm text-ink-500 hover:underline" onClick={() => setMode(mode === "password" ? "reset" : "password")}>
          {mode === "password" ? "Forgot your password?" : "Back to sign in"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm"><Link to="/" className="text-ink-500 hover:underline">Back to the public page</Link></p>
      </div>
    </div>
  );
}
