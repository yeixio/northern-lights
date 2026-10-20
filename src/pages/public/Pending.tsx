import { Navigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";

export default function Pending() {
  const { session, profile, signOut } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  if (profile?.is_approved) return <Navigate to="/app" replace />;
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="card space-y-3 p-6">
        <h1 className="text-xl font-semibold">Waiting for approval</h1>
        <p className="text-slate-600">
          You're signed in as {session.user.email}, but an admin hasn't approved this account yet.
          You'll have access as soon as they do.
        </p>
        <button className="btn-secondary" onClick={signOut}>Sign out</button>
      </div>
    </div>
  );
}
