import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../auth/AuthProvider";
import Spinner from "../../components/Spinner";

/**
 * Landing page for invite links (/welcome) and password reset links
 * (/reset-password). Supabase signs the user in from the link, then they pick
 * a password (and, for new members, their name).
 */
export default function SetPassword({ welcome }: { welcome: boolean }) {
  const { session, profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <Spinner full />;
  if (!session) {
    return <p className="p-12 text-center text-slate-500">This link has expired or was already used. Ask for a new invite or reset link.</p>;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Use at least 8 characters.");
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    if (welcome && profile) {
      await supabase.from("profiles").update({ first_name: first.trim(), last_name: last.trim() }).eq("id", profile.id);
      await refreshProfile();
    }
    navigate("/app", { replace: true });
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <form onSubmit={submit} className="card space-y-4 p-6">
        <h1 className="text-xl font-semibold">{welcome ? "Welcome! Set up your account" : "Choose a new password"}</h1>
        {welcome && (
          <div className="grid grid-cols-2 gap-2">
            <input className="input" required placeholder="First name" value={first} onChange={(e) => setFirst(e.target.value)} />
            <input className="input" required placeholder="Last name" value={last} onChange={(e) => setLast(e.target.value)} />
          </div>
        )}
        <input className="input" type="password" required placeholder="Password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>Continue</button>
      </form>
    </div>
  );
}
