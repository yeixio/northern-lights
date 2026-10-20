import { createContext, useContext, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, BookOpen, Calendar, Camera, Coffee, Gift, Globe, Heart, Home, ImageIcon, Lock, Mail, MapPin, Mountain,
  Music, Newspaper, Plus, Sparkles, Star, Sun, Trash2, Users, type LucideIcon,
} from "lucide-react";
import type {
  Background, CardsSection, CtaSection, GallerySection, HeroSection, ImageSection, Section, SplitSection, TextSection,
  UpdatesSection, Width,
} from "../../lib/home";
import type { Album, PublicPost } from "../../lib/types";
import { timeAgo } from "../../lib/format";
import MediaGrid from "../MediaGrid";
import AlbumGrid from "../AlbumGrid";
import { Buttons, EditText, ImageControls, SmartLink, useEditing, type Surface } from "./editable";

/** Public albums and posts, fetched once for every section that shows them. */
export const HomeDataContext = createContext<{ albums: Album[] | null; posts: PublicPost[] | null }>({ albums: null, posts: null });

export const ICONS: Record<string, LucideIcon> = {
  camera: Camera, heart: Heart, star: Star, sparkles: Sparkles, users: Users, home: Home, calendar: Calendar,
  map: MapPin, mountain: Mountain, sun: Sun, music: Music, book: BookOpen, coffee: Coffee, gift: Gift,
  mail: Mail, globe: Globe, newspaper: Newspaper, lock: Lock, image: ImageIcon,
};

type Props<S extends Section> = { s: S; set: (patch: Partial<S>) => void };

const widths: Record<Width, string> = { narrow: "max-w-3xl", normal: "max-w-6xl", wide: "max-w-7xl" };
const backgrounds: Record<Background, string> = {
  plain: "",
  muted: "bg-ink-100/70",
  tint: "bg-gradient-to-br from-primary-50 via-surface to-accent-50",
  bold: "bg-primary-600 text-on-primary",
};

/** Padding, width and background shared by every section except the header. */
function Shell({ s, children, className = "" }: { s: Section; children: ReactNode; className?: string }) {
  const center = s.align === "center";
  return (
    <section className={`${backgrounds[s.bg ?? "plain"]} px-4 py-16 sm:px-6 sm:py-24`}>
      <div className={`mx-auto ${widths[s.width ?? "normal"]} ${center ? "text-center" : ""} ${className}`}>{children}</div>
    </section>
  );
}

const eyebrowCls = (s: Section) =>
  `mb-3 text-sm font-semibold tracking-wider uppercase ${s.bg === "bold" ? "opacity-80" : "text-primary-600"}`;
const headingCls = "text-3xl font-semibold tracking-tight text-balance sm:text-4xl";
const bodyCls = "text-lg leading-relaxed opacity-80";
const surfaceOf = (s: Section): Surface => (s.bg === "bold" ? "bold" : "page");

function Hero({ s, set }: Props<HeroSection>) {
  const hasImage = s.look === "image" && s.image;
  const night = s.look !== "soft";
  const heights = { compact: "py-20 sm:py-28", tall: "min-h-[78vh] py-24", full: "min-h-[calc(100svh-4rem)] py-24" };
  const center = s.align !== "left";
  return (
    <section
      className={`relative isolate flex flex-col justify-center px-4 sm:px-6 ${heights[s.height]} ${
        s.look === "soft" ? "bg-gradient-to-br from-primary-100 via-surface to-accent-100 text-ink-900"
          : hasImage ? "overflow-hidden bg-black text-white" : "aurora"
      }`}
    >
      {hasImage && (
        <>
          <img src={s.image!} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/30 via-black/35 to-black/70" />
        </>
      )}
      {night && !hasImage && <Stars />}
      <div className={`relative mx-auto w-full max-w-5xl ${center ? "text-center" : ""}`}>
        <EditText
          value={s.eyebrow}
          onChange={(eyebrow) => set({ eyebrow })}
          placeholder="Small label"
          className={`mb-6 inline-block rounded-full px-3.5 py-1 text-xs font-semibold tracking-widest uppercase ${
            night ? "border border-white/20 bg-white/10 text-white/90 backdrop-blur" : "bg-primary-100 text-primary-700"
          }`}
        />
        <EditText
          as="h1"
          value={s.title}
          onChange={(title) => set({ title })}
          placeholder="Your headline"
          className="text-5xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-7xl"
        />
        <EditText
          value={s.subtitle}
          onChange={(subtitle) => set({ subtitle })}
          placeholder="A sentence or two of welcome"
          multiline
          className={`mt-6 max-w-2xl text-lg text-balance sm:text-xl ${center ? "mx-auto" : ""} ${night ? "text-white/80" : "text-ink-600"}`}
        />
        <Buttons
          buttons={s.buttons}
          onChange={(buttons) => set({ buttons })}
          surface={night ? "night" : "page"}
          className={`mt-10 ${center ? "justify-center" : ""}`}
        />
      </div>
      {s.look === "image" && (
        <ImageControls value={s.image} onChange={(image) => set({ image })} label="background" className="absolute bottom-4 left-4" />
      )}
      {night && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />}
    </section>
  );
}

/** A faint scatter of stars for the night sky. */
function Stars() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 opacity-60"
      style={{
        backgroundImage:
          "radial-gradient(1px 1px at 12% 22%, #fff9, transparent), radial-gradient(1px 1px at 28% 68%, #fff7, transparent)," +
          "radial-gradient(1.5px 1.5px at 46% 18%, #fffa, transparent), radial-gradient(1px 1px at 63% 44%, #fff6, transparent)," +
          "radial-gradient(1px 1px at 78% 12%, #fff9, transparent), radial-gradient(1.5px 1.5px at 88% 58%, #fff8, transparent)," +
          "radial-gradient(1px 1px at 8% 82%, #fff6, transparent), radial-gradient(1px 1px at 54% 86%, #fff5, transparent)",
      }}
    />
  );
}

function Text({ s, set }: Props<TextSection>) {
  return (
    <Shell s={s}>
      <EditText as="h2" value={s.heading} onChange={(heading) => set({ heading })} placeholder="Heading" className={headingCls} />
      <EditText value={s.body} onChange={(body) => set({ body })} placeholder="Write something…" multiline className={`mt-5 ${bodyCls}`} />
    </Shell>
  );
}

/** Stand-in artwork when a section has no photo yet. */
function ArtPanel({ className = "" }: { className?: string }) {
  return (
    <div className={`aurora flex items-center justify-center ${className}`}>
      <img src="/favicon.svg" alt="" className="h-16 w-16 opacity-80 drop-shadow-2xl" />
    </div>
  );
}

function Split({ s, set }: Props<SplitSection>) {
  return (
    <Shell s={{ ...s, align: "left" }}>
      <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
        <div className={`relative ${s.side === "right" ? "md:order-2" : ""}`}>
          {s.image ? (
            <img src={s.image} alt="" className="aspect-[4/3] w-full rounded-3xl object-cover shadow-xl" />
          ) : (
            <ArtPanel className="aspect-[4/3] w-full rounded-3xl shadow-xl" />
          )}
          <ImageControls value={s.image} onChange={(image) => set({ image })} className="absolute bottom-4 left-4" />
        </div>
        <div>
          <EditText value={s.eyebrow} onChange={(eyebrow) => set({ eyebrow })} placeholder="Small label" className={eyebrowCls(s)} />
          <EditText as="h2" value={s.heading} onChange={(heading) => set({ heading })} placeholder="Heading" className={headingCls} />
          <EditText value={s.body} onChange={(body) => set({ body })} placeholder="Tell the story…" multiline className={`mt-5 ${bodyCls}`} />
          <Buttons buttons={s.buttons} onChange={(buttons) => set({ buttons })} surface={surfaceOf(s)} className="mt-8" />
        </div>
      </div>
    </Shell>
  );
}

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const Icon = ICONS[value] ?? Star;
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-100 text-primary-700 ring-2 ring-transparent hover:ring-primary-400" title="Change icon">
        <Icon size={22} />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-30 mt-2 grid w-64 grid-cols-6 gap-1 rounded-xl border border-ink-200 bg-surface p-2 text-ink-700 shadow-2xl">
          {Object.entries(ICONS).map(([name, I]) => (
            <button key={name} type="button" title={name} onClick={() => { onChange(name); setOpen(false); }}
              className={`flex h-9 w-9 items-center justify-center rounded-lg hover:bg-ink-100 ${name === value ? "bg-primary-100 text-primary-700" : ""}`}>
              <I size={18} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Cards({ s, set }: Props<CardsSection>) {
  const editing = useEditing();
  const cols = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[s.columns];
  const setItem = (i: number, patch: Partial<CardsSection["items"][number]>) =>
    set({ items: s.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  return (
    <Shell s={s}>
      <div className={`mx-auto mb-12 max-w-2xl ${s.align === "left" ? "mx-0" : "text-center"}`}>
        <EditText as="h2" value={s.heading} onChange={(heading) => set({ heading })} placeholder="Heading" className={headingCls} />
        <EditText value={s.intro} onChange={(intro) => set({ intro })} placeholder="An optional introduction" multiline className={`mt-4 ${bodyCls}`} />
      </div>
      <div className={`grid gap-5 text-left ${cols}`}>
        {s.items.map((it, i) => {
          const Icon = ICONS[it.icon] ?? Star;
          const body = (
            <>
              {editing ? <IconPicker value={it.icon} onChange={(icon) => setItem(i, { icon })} /> : (
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-100 text-primary-700 transition group-hover:scale-105">
                  <Icon size={22} />
                </div>
              )}
              <EditText as="h3" value={it.title} onChange={(title) => setItem(i, { title })} placeholder="Title" className="mt-5 text-lg font-semibold" />
              <EditText value={it.body} onChange={(b) => setItem(i, { body: b })} placeholder="A short description" multiline className="mt-2 leading-relaxed text-ink-600" />
              {it.href && !editing && <ArrowRight size={18} className="absolute top-6 right-6 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-primary-600" />}
              {editing && (
                <div className="mt-4 flex items-center gap-2 border-t border-ink-100 pt-3">
                  <input className="input py-1 font-mono text-xs" placeholder="Link (optional)" value={it.href ?? ""} onChange={(e) => setItem(i, { href: e.target.value || undefined })} />
                  <button type="button" className="btn-ghost px-2 text-rose-600" aria-label="Remove card" onClick={() => set({ items: s.items.filter((_, j) => j !== i) })}>
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </>
          );
          const cls = "card group relative block p-6 text-ink-900 transition hover:-translate-y-0.5 hover:shadow-lg";
          return it.href && !editing
            ? <SmartLink key={i} href={it.href} className={cls}>{body}</SmartLink>
            : <div key={i} className={cls}>{body}</div>;
        })}
        {editing && s.items.length < 12 && (
          <button type="button" onClick={() => set({ items: [...s.items, { icon: "star", title: "New card", body: "" }] })}
            className="flex min-h-40 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-current/25 text-sm font-medium opacity-70 hover:opacity-100">
            <Plus size={16} /> Add card
          </button>
        )}
      </div>
    </Shell>
  );
}

function Photo({ s, set }: Props<ImageSection>) {
  const editing = useEditing();
  if (!s.image && !editing) return null;
  return (
    <Shell s={s}>
      <figure className="relative">
        {s.image ? (
          <img src={s.image} alt={s.caption} className="w-full rounded-3xl object-cover shadow-xl" />
        ) : (
          <div className="flex aspect-[16/7] items-center justify-center rounded-3xl border-2 border-dashed border-current/25 text-sm opacity-60">
            Add a photo to show it here
          </div>
        )}
        <ImageControls value={s.image} onChange={(image) => set({ image })} className="absolute bottom-4 left-4" />
        <EditText as="figcaption" value={s.caption} onChange={(caption) => set({ caption })} placeholder="Caption (optional)" className="mt-4 text-center text-sm opacity-70" />
      </figure>
    </Shell>
  );
}

function EmptyHint({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border-2 border-dashed border-current/20 p-10 text-center text-sm opacity-70">{children}</div>;
}

function Gallery({ s, set }: Props<GallerySection>) {
  const editing = useEditing();
  const { albums } = useContext(HomeDataContext);
  if (!albums || (albums.length === 0 && !editing)) return null;
  return (
    <Shell s={{ ...s, align: "left" }}>
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <EditText as="h2" value={s.heading} onChange={(heading) => set({ heading })} placeholder="Heading" className={headingCls} />
          <EditText value={s.intro} onChange={(intro) => set({ intro })} placeholder="An optional introduction" multiline className={`mt-3 ${bodyCls}`} />
        </div>
        {albums.length > 0 && (
          <Link to="/gallery" className="inline-flex items-center gap-1 text-sm font-medium hover:underline">
            See all albums <ArrowRight size={16} />
          </Link>
        )}
      </div>
      {albums.length > 0 ? <AlbumGrid albums={albums.slice(0, s.limit)} /> : (
        <EmptyHint>
          Public albums show up here. Create one in <Link className="font-medium underline" to="/app/albums">Albums</Link> and make it public.
          Visitors won't see this section until then.
        </EmptyHint>
      )}
    </Shell>
  );
}

function Updates({ s, set }: Props<UpdatesSection>) {
  const editing = useEditing();
  const { posts } = useContext(HomeDataContext);
  if (!posts || (posts.length === 0 && !editing)) return null;
  return (
    <Shell s={{ ...s, align: "left" }}>
      <EditText as="h2" value={s.heading} onChange={(heading) => set({ heading })} placeholder="Heading" className={`${headingCls} mb-10`} />
      {posts.length > 0 ? (
        <div className="space-y-5">
          {posts.slice(0, s.limit).map((p) => (
            <article key={p.id} className="card space-y-3 p-6 text-ink-900">
              <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">{timeAgo(p.created_at)}</p>
              {p.content && <p className="text-[1.05rem] leading-relaxed whitespace-pre-wrap">{p.content}</p>}
              <MediaGrid urls={p.media_urls} />
            </article>
          ))}
        </div>
      ) : (
        <EmptyHint>
          Posts marked public in the members' feed appear here. Visitors won't see this section until there is one.
        </EmptyHint>
      )}
    </Shell>
  );
}

function Cta({ s, set }: Props<CtaSection>) {
  const night = s.bg === "bold";
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-24">
      <div className={`mx-auto ${widths[s.width ?? "normal"]} ${night ? "aurora" : backgrounds[s.bg ?? "plain"] + " border border-ink-200"} rounded-3xl px-6 py-16 text-center sm:px-16`}>
        {night && <Stars />}
        <EditText as="h2" value={s.heading} onChange={(heading) => set({ heading })} placeholder="Heading" className={`${headingCls} mx-auto max-w-2xl`} />
        <EditText value={s.body} onChange={(body) => set({ body })} placeholder="A short invitation" multiline className={`mx-auto mt-5 max-w-xl ${bodyCls}`} />
        <Buttons buttons={s.buttons} onChange={(buttons) => set({ buttons })} surface={night ? "night" : "page"} className="mt-9 justify-center" />
      </div>
    </section>
  );
}

export function SectionView({ s, set }: { s: Section; set: (patch: Partial<Section>) => void }) {
  switch (s.type) {
    case "hero": return <Hero s={s} set={set} />;
    case "text": return <Text s={s} set={set} />;
    case "split": return <Split s={s} set={set} />;
    case "cards": return <Cards s={s} set={set} />;
    case "image": return <Photo s={s} set={set} />;
    case "gallery": return <Gallery s={s} set={set} />;
    case "updates": return <Updates s={s} set={set} />;
    case "cta": return <Cta s={s} set={set} />;
  }
}
