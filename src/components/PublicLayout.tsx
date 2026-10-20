import { Link, NavLink, Outlet } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { useSite } from "../lib/site";

const navLink = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? "text-ink-900" : "text-ink-500 hover:text-ink-900"}`;

export default function PublicLayout() {
  const { user } = useAuth();
  const { settings } = useSite();
  const name = settings?.site_name ?? "Northern Lights";
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-ink-200/70 bg-surface/80 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-2.5 font-semibold tracking-tight">
            <img src="/favicon.svg" alt="" className="h-8 w-8 shrink-0" />
            <span className="truncate">{name}</span>
          </Link>
          <div className="flex items-center gap-1">
            <NavLink to="/" end className={(a) => `${navLink(a)} max-sm:hidden`}>Home</NavLink>
            <NavLink to="/gallery" className={navLink}>Gallery</NavLink>
            {user ? (
              <Link to="/app" className="btn-primary ml-2 py-1.5">Members <ArrowRight size={14} /></Link>
            ) : (
              <Link to="/login" className="btn-secondary ml-2 py-1.5">Sign in</Link>
            )}
          </div>
        </nav>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-ink-200 bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-10 text-sm text-ink-500 sm:flex-row sm:justify-between sm:px-6">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" className="h-6 w-6" />
            <span>© {new Date().getFullYear()} {name}</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {settings?.contact_email && <a className="hover:text-ink-900" href={`mailto:${settings.contact_email}`}>{settings.contact_email}</a>}
            <Link className="hover:text-ink-900" to="/gallery">Gallery</Link>
            <Link className="hover:text-ink-900" to={user ? "/app" : "/login"}>Members</Link>
            <a className="text-ink-400 hover:text-ink-900" href="https://github.com/yeixio/northern-lights" target="_blank" rel="noreferrer">Powered by Northern Lights</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
