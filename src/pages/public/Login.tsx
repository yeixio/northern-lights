import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../auth/AuthProvider";

export default function Login() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? "/app";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"password" | "reset">("password");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (session) return <Navigate to={from} replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    if (mode === "password") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else navigate(from, { replace: true });
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) setError(error.message);
      else setNotice("If that email belongs to a member, a reset link is on its way.");
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <form onSubmit={submit} className="card space-y-4 p-6">
        <div>
          <h1 className="text-xl font-semibold">{mode === "password" ? "Member login" : "Reset password"}</h1>
          <p className="mt-1 text-sm text-slate-500">This network is invite-only. Ask a member to invite you.</p>
        </div>
        <input className="input" type="email" required placeholder="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        {mode === "password" && (
          <input className="input" type="password" required placeholder="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        )}
        {error && <p className="text-sm text-rose-600">{error}</p>}
        {notice && <p className="text-sm text-emerald-700">{notice}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {mode === "password" ? "Sign in" : "Send reset link"}
        </button>
        <button type="button" className="w-full text-sm text-slate-500 hover:underline" onClick={() => setMode(mode === "password" ? "reset" : "password")}>
          {mode === "password" ? "Forgot your password?" : "Back to sign in"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm"><Link to="/" className="text-slate-500 hover:underline">Back to the public page</Link></p>
    </div>
  );
}
