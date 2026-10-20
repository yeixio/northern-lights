import { NavLink, Outlet, Link } from "react-router-dom";
import { Home, Images, LogOut, Mail, Settings, UserPlus, Users } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import Avatar from "./Avatar";

const link = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
    isActive ? "bg-emerald-50 text-emerald-700" : "text-slate-700 hover:bg-slate-100"
  }`;

export default function AppLayout() {
  const { profile, signOut } = useAuth();
  const nav = [
    { to: "/app", label: "Feed", icon: Home, end: true },
    { to: "/app/people", label: "People", icon: Users },
    { to: "/app/messages", label: "Messages", icon: Mail },
    { to: "/app/albums", label: "Albums", icon: Images },
    { to: "/app/invite", label: "Invite", icon: UserPlus },
    ...(profile?.is_admin ? [{ to: "/app/admin", label: "Admin", icon: Settings }] : []),
  ];

  return (
    <div className="min-h-screen">
      <header className="aurora-bg sticky top-0 z-10 text-white shadow">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/app" className="flex items-center gap-2 font-semibold">
            <img src="/favicon.svg" alt="" className="h-7 w-7" /> Northern Lights
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/" className="hidden text-sm hover:text-emerald-200 sm:block">Public page</Link>
            <Link to={`/app/people/${profile?.id}`}><Avatar profile={profile} size="sm" /></Link>
            <button onClick={signOut} className="hover:text-emerald-200" aria-label="Sign out"><LogOut size={18} /></button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        <aside className="hidden w-52 shrink-0 md:block">
          <nav className="sticky top-20 space-y-1">
            {nav.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={link}>
                <Icon size={18} /> {label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 pb-20 md:pb-0">
          <Outlet />
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 flex justify-around border-t border-slate-200 bg-white py-2 md:hidden">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex flex-col items-center text-xs ${isActive ? "text-emerald-700" : "text-slate-500"}`}>
            <Icon size={20} /> {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
