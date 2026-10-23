import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Images, LayoutTemplate, Palette, PenLine, Plus, RotateCcw, Settings2, Sparkles, UserPlus, X } from "lucide-react";
import { api, errorText } from "../../lib/api";
import { useAuth } from "../../auth/AuthProvider";
import { useSite } from "../../lib/site";
import { newId, newSection, SECTION_INFO, starterSections, type Section, type SectionType } from "../../lib/home";
import type { SiteTheme } from "../../lib/theme";
import type { Album, PublicPost } from "../../lib/types";
import { EditingContext } from "../../components/home/editable";
import { HomeDataContext, SectionView } from "../../components/home/sections";
import { AddSectionDialog, InsertPoint, SectionFrame, SectionSettings } from "../../components/home/editor";
import ThemePanel from "../../components/ThemePanel";
import { Drawer } from "../../components/ui";

type Panel = { kind: "theme" } | { kind: "section"; id: string } | null;

export default function Home() {
  const { settings, theme, reload, previewTheme } = useSite();
  const { user, needsSetup, setupNeedsLink } = useAuth();
  const [params, setParams] = useSearchParams();
  const [albums, setAlbums] = useState<Album[] | null>(null);
  const [posts, setPosts] = useState<PublicPost[] | null>(null);

  // While editing, `draft` holds the unsaved sections (and maybe theme).
  const [draft, setDraft] = useState<Section[] | null>(null);
  const [themeDraft, setThemeDraft] = useState<SiteTheme | null>(null);
  const [dirty, setDirty] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const isAdmin = Boolean(user?.is_admin);
  const editing = draft !== null;
  const saved = settings?.home?.sections ?? starterSections(settings);
  const sections = draft ?? saved.filter((s) => !s.hidden);

  useEffect(() => {
    api.get<Album[]>("/api/public/albums").then(setAlbums).catch(() => setAlbums([]));
    api.get<PublicPost[]>("/api/public/posts").then(setPosts).catch(() => setPosts([]));
  }, []);

  const startEditing = useCallback((openTheme = false) => {
    setDraft(structuredClone(saved));
    setThemeDraft(null);
    setDirty(false);
    setError(null);
    setPanel(openTheme ? { kind: "theme" } : null);
  }, [saved]);

  // /?edit or /?edit=theme (linked from the admin page) opens the editor.
  useEffect(() => {
    const edit = params.get("edit");
    if (edit === null || !isAdmin || !settings) return;
    startEditing(edit === "theme");
    setParams({}, { replace: true });
  }, [params, isAdmin, settings, startEditing, setParams]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const change = (fn: (all: Section[]) => Section[]) => {
    setDraft((all) => (all ? fn(all) : all));
    setDirty(true);
  };
  const update = (id: string, patch: Partial<Section>) => change((all) => all.map((s) => (s.id === id ? ({ ...s, ...patch } as Section) : s)));
  const move = (from: number, to: number) => change((all) => {
    const next = [...all];
    next.splice(to, 0, ...next.splice(from, 1));
    return next;
  });

  function setTheme(t: SiteTheme) {
    setThemeDraft(t);
    previewTheme(t);
    setDirty(true);
  }

  function stopEditing() {
    if (dirty && !confirm("Discard your changes?")) return;
    setDraft(null);
    setThemeDraft(null);
    previewTheme(null);
    setPanel(null);
    setDirty(false);
  }

  async function save() {
    // Let a text field that still has focus commit its value first.
    (document.activeElement as HTMLElement | null)?.blur();
    await new Promise((r) => setTimeout(r));
    setSaving(true);
    setError(null);
    try {
      await api.put("/api/admin/home", { sections: draftRef.current });
      if (themeDraft) await api.put("/api/admin/theme", themeDraft);
      await reload();
      previewTheme(null);
      setDraft(null);
      setThemeDraft(null);
      setPanel(null);
      setDirty(false);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  const panelSection = panel?.kind === "section" ? draft?.find((s) => s.id === panel.id) : undefined;

  return (
    <EditingContext.Provider value={editing}>
      <HomeDataContext.Provider value={{ albums, posts }}>
        {needsSetup && !setupNeedsLink && <SetupBanner />}
        {isAdmin && !editing && !settings?.home && <GettingStarted onEdit={startEditing} />}

        {editing && (
          <div className="sticky top-16 z-40 border-b border-ink-200 bg-surface/90 backdrop-blur-xl">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2.5 sm:px-6">
              <div className="mr-auto flex items-center gap-2 text-sm">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-500 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary-600" />
                </span>
                <span className="font-medium">Editing home page</span>
                <span className="hidden text-ink-500 sm:inline">· click any text to change it</span>
              </div>
              <button className="btn-ghost" onClick={() => setAdding(draft!.length)}><Plus size={16} /> Section</button>
              <button className="btn-ghost" onClick={() => setPanel({ kind: "theme" })}><Palette size={16} /> Theme</button>
              <button
                className="btn-ghost"
                title="Start over from the starter layout"
                onClick={() => confirm("Replace this page with the starter layout?") && change(() => starterSections(settings))}
              >
                <RotateCcw size={16} /> <span className="hidden sm:inline">Starter layout</span>
              </button>
              <button className="btn-secondary" onClick={stopEditing}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving…" : dirty ? "Save changes" : "Done"}</button>
            </div>
            {error && <p className="mx-auto max-w-6xl px-6 pb-2 text-sm text-rose-600">{error}</p>}
          </div>
        )}

        {sections.map((s, i) => editing ? (
          <div key={s.id} id={`section-${s.id}`} className="scroll-mt-32">
            {i > 0 && <InsertPoint onClick={() => setAdding(i)} />}
            <SectionFrame
              s={s}
              index={i}
              count={sections.length}
              onMove={(to) => move(i, to)}
              onSettings={() => setPanel({ kind: "section", id: s.id })}
              onDuplicate={() => change((all) => [...all.slice(0, i + 1), { ...structuredClone(s), id: newId() }, ...all.slice(i + 1)])}
              onToggle={() => update(s.id, { hidden: !s.hidden })}
              onDelete={() => confirm(`Delete this ${SECTION_INFO[s.type].name.toLowerCase()} section?`) && change((all) => all.filter((x) => x.id !== s.id))}
            >
              <SectionView s={s} set={(patch) => update(s.id, patch)} />
            </SectionFrame>
          </div>
        ) : (
          <SectionView key={s.id} s={s} set={() => undefined} />
        ))}

        {editing && <InsertPoint always onClick={() => setAdding(sections.length)} />}
        {!editing && sections.length === 0 && (
          <div className="px-4 py-32 text-center text-ink-500">Nothing here yet.</div>
        )}

        {isAdmin && !editing && (
          <button onClick={() => startEditing()} className="btn-primary fixed right-5 bottom-5 z-40 rounded-full px-5 py-3 shadow-xl">
            <PenLine size={16} /> Edit page
          </button>
        )}

        {adding !== null && (
          <AddSectionDialog
            onClose={() => setAdding(null)}
            onPick={(type: SectionType) => {
              const s = newSection(type);
              change((all) => [...all.slice(0, adding), s, ...all.slice(adding)]);
              setAdding(null);
              setTimeout(() => document.getElementById(`section-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
            }}
          />
        )}
        {panel?.kind === "theme" && (
          <Drawer title="Theme" onClose={() => setPanel(null)}>
            <ThemePanel value={themeDraft ?? theme} onChange={setTheme} />
            <p className="text-xs text-ink-500">Changes show on the page right away. Members can still pick their own colors for the private area.</p>
          </Drawer>
        )}
        {panelSection && (
          <Drawer title={`${SECTION_INFO[panelSection.type].name} settings`} onClose={() => setPanel(null)}>
            <SectionSettings s={panelSection} set={(patch) => update(panelSection.id, patch)} />
          </Drawer>
        )}
      </HomeDataContext.Provider>
    </EditingContext.Provider>
  );
}

function SetupBanner() {
  return (
    <div className="border-b border-primary-200 bg-primary-50">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 text-sm sm:px-6">
        <Sparkles size={18} className="text-primary-600" />
        <p className="mr-auto"><strong>Your new site is running.</strong> Create the admin account to start making it yours.</p>
        <Link to="/setup" className="btn-primary py-1.5">Set up site</Link>
      </div>
    </div>
  );
}

const DISMISSED = "nl-getting-started-dismissed";

/** First steps for a new admin, until they save their own home page. */
function GettingStarted({ onEdit }: { onEdit: (openTheme?: boolean) => void }) {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED) === "1";
    } catch {
      return false;
    }
  });
  if (hidden) return null;
  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISSED, "1");
    } catch {
      // nothing to remember it in
    }
  };
  const steps = [
    { icon: Settings2, title: "Name it and add a logo", body: "Your site's name, logo, footer, and email for invitations.", action: <Link className="btn-secondary py-1.5" to="/app/admin/site">Site settings</Link> },
    { icon: LayoutTemplate, title: "Make the home page yours", body: "Change the words, add photos, and arrange sections.", action: <button className="btn-primary py-1.5" onClick={() => onEdit()}>Edit page</button> },
    { icon: Palette, title: "Pick your colors", body: "Choose a palette, light or dark, and a typeface.", action: <button className="btn-secondary py-1.5" onClick={() => onEdit(true)}>Choose theme</button> },
    { icon: Images, title: "Share some photos", body: "Albums you make public appear here and in the gallery.", action: <Link className="btn-secondary py-1.5" to="/app/albums">Albums</Link> },
    { icon: UserPlus, title: "Invite your people", body: "Family and friends get a private feed and messages.", action: <Link className="btn-secondary py-1.5" to="/app/invite">Invite</Link> },
  ];
  return (
    <div className="border-b border-ink-200 bg-surface">
      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <button onClick={dismiss} className="btn-ghost absolute top-4 right-2 px-2 sm:right-4" aria-label="Dismiss"><X size={18} /></button>
        <p className="text-sm font-semibold tracking-wider text-primary-600 uppercase">Getting started</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Welcome! Here's how to set up your site.</h2>
        <p className="mt-1 text-ink-500">This is the starter page your visitors see. Only admins see this box.</p>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map(({ icon: Icon, title, body, action }, i) => (
            <li key={title} className="flex flex-col rounded-xl border border-ink-200 bg-ink-50 p-4">
              <div className="flex items-center gap-2 text-sm text-ink-500">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100 text-primary-700"><Icon size={16} /></span>
                Step {i + 1}
              </div>
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 mb-4 flex-1 text-sm text-ink-500">{body}</p>
              <div>{action}</div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
