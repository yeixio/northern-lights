import { NavLink, Outlet, Link } from "react-router-dom";
import { Globe, Home, Images, LogOut, Mail, Moon, Palette, ShieldCheck, Sun, UserPlus, Users } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { useSite } from "../lib/site";
import { displayName } from "../lib/types";
import Avatar from "./Avatar";

const link = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? "bg-primary-50 text-primary-700" : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
  }`;

/** Flips between light and dark for this member, from whatever is showing now. */
function ModeToggle({ className = "" }: { className?: string }) {
  const { user, savePreferences } = useAuth();
  const { dark } = useSite();
  const prefs = user?.preferences ?? { preset: null, mode: null };
  return (
    <button
      className={className}
      onClick={() => void savePreferences({ ...prefs, mode: dark ? "light" : "dark" })}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

export default function AppLayout() {
  const { user: profile, signOut } = useAuth();
  const { settings } = useSite();
  const name = settings?.site_name ?? "Northern Lights";
  const nav = [
    { to: "/app", label: "Feed", icon: Home, end: true },
    { to: "/app/people", label: "People", icon: Users },
    { to: "/app/messages", label: "Messages", icon: Mail },
    { to: "/app/albums", label: "Albums", icon: Images },
    { to: "/app/invite", label: "Invite", icon: UserPlus },
    ...(profile?.is_admin ? [{ to: "/app/admin", label: "Admin", icon: ShieldCheck }] : []),
  ];
  const iconBtn = "flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-900";

  return (
    <div className="min-h-screen md:flex">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-ink-200 bg-surface md:flex">
        <Link to="/app" className="flex h-16 items-center gap-2.5 px-5 font-semibold tracking-tight">
          <img src="/favicon.svg" alt="" className="h-8 w-8" />
          <span className="truncate">{name}</span>
        </Link>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={link}>
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-1 border-t border-ink-200 px-3 py-3">
          <Link to="/" className={link({ isActive: false })}><Globe size={18} /> Public page</Link>
          <NavLink to="/app/settings" className={link}><Palette size={18} /> Appearance</NavLink>
        </div>
        <div className="flex items-center gap-3 border-t border-ink-200 p-3">
          <Link to={`/app/people/${profile?.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1.5 hover:bg-ink-100">
            <Avatar profile={profile} size="sm" />
            <div className="min-w-0 text-sm">
              <div className="truncate font-medium">{displayName(profile)}</div>
              <div className="truncate text-xs text-ink-500">{profile?.email}</div>
            </div>
          </Link>
          <ModeToggle className={iconBtn} />
          <button onClick={signOut} className={iconBtn} aria-label="Sign out" title="Sign out"><LogOut size={18} /></button>
        </div>
      </aside>

      {/* Top bar (mobile) */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-ink-200 bg-surface/85 px-4 backdrop-blur-xl md:hidden">
        <Link to="/app" className="flex min-w-0 items-center gap-2 font-semibold">
          <img src="/favicon.svg" alt="" className="h-7 w-7" /> <span className="truncate">{name}</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link to="/" className={iconBtn} aria-label="Public page"><Globe size={18} /></Link>
          <Link to="/app/settings" className={iconBtn} aria-label="Appearance"><Palette size={18} /></Link>
          <ModeToggle className={iconBtn} />
          <Link to={`/app/people/${profile?.id}`} className="ml-1"><Avatar profile={profile} size="sm" /></Link>
          <button onClick={signOut} className={iconBtn} aria-label="Sign out"><LogOut size={18} /></button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl min-w-0 flex-1 px-4 pt-6 pb-24 sm:px-8 md:py-10">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-ink-200 bg-surface/95 py-2 backdrop-blur md:hidden">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex flex-col items-center gap-0.5 text-[11px] font-medium ${isActive ? "text-primary-700" : "text-ink-500"}`}>
            <Icon size={20} /> {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
