import { useEffect } from "react";
import { BrowserRouter, Link, Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { App as NativeApp } from "@capacitor/app";
import { Home, LayoutGrid, Mail, Plus } from "lucide-react";
import { applyTheme, DEFAULT_THEME, resolveTheme } from "../lib/theme";
import { useSummaries } from "./inbox";
import { linkPath } from "./links";
import { isNative } from "./native";
import AddSite from "./pages/AddSite";
import HubFeed from "./pages/HubFeed";
import HubMessages from "./pages/HubMessages";
import HubSites from "./pages/HubSites";
import { SiteLogo } from "./SiteBadge";
import { useSites } from "./sites";

/** The app's own look: the default palette, light or dark with the device. */
function useSystemTheme() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => applyTheme(resolveTheme(DEFAULT_THEME, null, media.matches));
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
}

/** Links that open the app (a scanned QR code, "Open the app") go to their page. */
function useAppLinks() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!isNative) return;
    const listener = NativeApp.addListener("appUrlOpen", ({ url }) => {
      const to = linkPath(url);
      if (to) navigate(to);
    });
    return () => void listener.then((l) => l.remove());
  }, [navigate]);
}

/** A new link remounts the page, so a second QR code is read like the first. */
function AddRoute() {
  return <AddSite key={useLocation().key} />;
}

const link = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? "bg-primary-50 text-primary-700" : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
  }`;

function Badge({ n }: { n: number }) {
  return n > 0 ? <span className="ml-auto rounded-full bg-primary-600 px-1.5 text-xs font-semibold text-on-primary">{n > 99 ? "99+" : n}</span> : null;
}

function Layout() {
  const sites = useSites();
  const { unreadMessages } = useSummaries(sites.filter((s) => !s.signedOut));
  const { pathname, search } = useLocation();
  useAppLinks();
  const nav = [
    { to: "/", label: "Feed", icon: Home, end: true },
    { to: "/messages", label: "Messages", icon: Mail, badge: unreadMessages },
    { to: "/sites", label: "Sites", icon: LayoutGrid },
  ];

  // With no sites yet, the only thing to do is add one.
  if (sites.length === 0 && pathname !== "/add") return <Navigate to="/add" replace />;

  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-ink-200 bg-surface pt-[env(safe-area-inset-top)] md:flex">
        <Link to="/" className="flex h-16 items-center gap-2.5 px-5 font-semibold tracking-tight">
          <img src="/favicon.svg" alt="" className="h-8 w-8" /> Northern Lights
        </Link>
        <nav className="space-y-1 px-3 py-4">
          {nav.map(({ to, label, icon: Icon, end, badge }) => (
            <NavLink key={to} to={to} end={end} className={(a) => link({ isActive: a.isActive && !(to === "/" && search) })}>
              <Icon size={18} /> {label} <Badge n={badge ?? 0} />
            </NavLink>
          ))}
        </nav>
        <div className="flex-1 overflow-y-auto border-t border-ink-200 px-3 py-3">
          <div className="px-3 pb-2 text-xs font-semibold tracking-wide text-ink-500 uppercase">Your sites</div>
          {sites.map((s) => (
            <Link key={s.url} to={`/?site=${encodeURIComponent(s.url)}`} className={link({ isActive: search === `?site=${encodeURIComponent(s.url)}` })}>
              <SiteLogo site={s} className="h-6 w-6" /> <span className={`truncate ${s.signedOut ? "text-ink-400 line-through" : ""}`}>{s.info.name}</span>
            </Link>
          ))}
          <NavLink to="/add" className={link}><Plus size={18} /> Add a site</NavLink>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-ink-200 bg-surface/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold"><img src="/favicon.svg" alt="" className="h-7 w-7" /> Northern Lights</Link>
        <Link to="/add" className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100" aria-label="Add a site"><Plus size={20} /></Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl min-w-0 flex-1 px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-8 md:py-10">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-ink-200 bg-surface/95 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        {nav.map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `relative flex flex-col items-center gap-0.5 text-[11px] font-medium ${isActive ? "text-primary-700" : "text-ink-500"}`}>
            <Icon size={20} /> {label}
            {(badge ?? 0) > 0 && <span className="absolute -top-1 right-0 h-2.5 w-2.5 rounded-full bg-primary-600" />}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default function HubApp() {
  useSystemTheme();
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HubFeed />} />
          <Route path="add" element={<AddRoute />} />
          <Route path="messages" element={<HubMessages />} />
          <Route path="sites" element={<HubSites />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
