import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useSiteSettings } from "../lib/useSiteSettings";

export default function PublicLayout() {
  const { user } = useAuth();
  const settings = useSiteSettings();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="aurora-bg text-white">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold">
            <img src="/favicon.svg" alt="" className="h-7 w-7" />
            {settings?.site_name ?? "Northern Lights"}
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/gallery" className="hover:text-emerald-200">Gallery</Link>
            {user ? (
              <Link to="/app" className="rounded-lg bg-white/15 px-3 py-1.5 hover:bg-white/25">Open network</Link>
            ) : (
              <Link to="/login" className="rounded-lg bg-white/15 px-3 py-1.5 hover:bg-white/25">Member login</Link>
            )}
          </div>
        </nav>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-500">
        {settings?.contact_email && (
          <p>Contact: <a className="underline" href={`mailto:${settings.contact_email}`}>{settings.contact_email}</a></p>
        )}
        <p>Powered by Northern Lights</p>
      </footer>
    </div>
  );
}
