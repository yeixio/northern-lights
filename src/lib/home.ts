import type { SiteSettings } from "./types";

// The home page is a list of sections an admin arranges and edits in place.
// The server only checks their shape (server/appearance.ts); the fields of
// each type are defined here.

export type Background = "plain" | "muted" | "tint" | "bold";
export type Width = "narrow" | "normal" | "wide";

export interface LinkButton {
  label: string;
  href: string;
  style?: "primary" | "secondary";
}

export interface CardItem {
  icon: string;
  title: string;
  body: string;
  href?: string;
}

interface Base {
  id: string;
  hidden?: boolean;
  bg?: Background;
  width?: Width;
  align?: "left" | "center";
}

export interface HeroSection extends Base {
  type: "hero";
  eyebrow?: string;
  title: string;
  subtitle: string;
  image: string | null;
  look: "aurora" | "soft" | "image";
  height: "compact" | "tall" | "full";
  buttons: LinkButton[];
}
export interface TextSection extends Base {
  type: "text";
  heading: string;
  body: string;
}
export interface SplitSection extends Base {
  type: "split";
  eyebrow?: string;
  heading: string;
  body: string;
  image: string | null;
  side: "left" | "right";
  buttons: LinkButton[];
}
export interface CardsSection extends Base {
  type: "cards";
  heading: string;
  intro: string;
  columns: 2 | 3 | 4;
  items: CardItem[];
}
export interface ImageSection extends Base {
  type: "image";
  image: string | null;
  caption: string;
}
export interface GallerySection extends Base {
  type: "gallery";
  heading: string;
  intro: string;
  limit: number;
}
export interface UpdatesSection extends Base {
  type: "updates";
  heading: string;
  limit: number;
}
export interface CtaSection extends Base {
  type: "cta";
  heading: string;
  body: string;
  buttons: LinkButton[];
}

export type Section =
  | HeroSection | TextSection | SplitSection | CardsSection | ImageSection | GallerySection | UpdatesSection | CtaSection;
export type SectionType = Section["type"];

export interface HomePage {
  sections: Section[];
}

export const SECTION_INFO: Record<SectionType, { name: string; blurb: string }> = {
  hero: { name: "Header", blurb: "Big title and welcome at the top" },
  text: { name: "Text", blurb: "A heading and a few paragraphs" },
  split: { name: "Image and text", blurb: "A photo beside a story" },
  cards: { name: "Highlights", blurb: "A row of cards with icons" },
  image: { name: "Photo", blurb: "One large photo with a caption" },
  gallery: { name: "Albums", blurb: "Your public photo albums" },
  updates: { name: "Updates", blurb: "Your latest public posts" },
  cta: { name: "Call to action", blurb: "A banner with buttons" },
};

export const newId = () => Math.random().toString(36).slice(2, 10);

export function newSection(type: SectionType): Section {
  const id = newId();
  switch (type) {
    case "hero":
      return { id, type, title: "A new chapter", subtitle: "Say something welcoming here.", image: null, look: "aurora", height: "compact", align: "center", buttons: [] };
    case "text":
      return { id, type, heading: "A few words", body: "Write anything you like here. Click to edit.", width: "narrow" };
    case "split":
      return { id, type, eyebrow: "", heading: "Tell a story", body: "Pair a favorite photo with a few words about it.", image: null, side: "left", buttons: [] };
    case "cards":
      return {
        id, type, heading: "Highlights", intro: "", columns: 3, items: [
          { icon: "star", title: "First", body: "A short description." },
          { icon: "heart", title: "Second", body: "A short description." },
          { icon: "sparkles", title: "Third", body: "A short description." },
        ],
      };
    case "image":
      return { id, type, image: null, caption: "", width: "wide" };
    case "gallery":
      return { id, type, heading: "Photo albums", intro: "", limit: 6 };
    case "updates":
      return { id, type, heading: "Latest updates", limit: 5, width: "narrow" };
    case "cta":
      return { id, type, heading: "Come say hello", body: "", bg: "bold", buttons: [{ label: "Get in touch", href: "/login", style: "primary" }] };
  }
}

/**
 * The starter page a fresh site shows until an admin saves their own. It uses
 * the older settings (tagline, about, header image) when those were filled in.
 */
export function starterSections(s: SiteSettings | null): Section[] {
  const name = s?.site_name ?? "Northern Lights";
  return [
    {
      id: "welcome", type: "hero", eyebrow: "Welcome",
      title: name,
      subtitle: s?.tagline || "Photos, news and stories from our corner of the world, shared with the people we love.",
      image: s?.hero_image_url ?? null,
      look: s?.hero_image_url ? "image" : "aurora", height: "tall", align: "center",
      buttons: [
        { label: "Browse photos", href: "/gallery", style: "primary" },
        { label: "Member login", href: "/login", style: "secondary" },
      ],
    },
    {
      id: "about", type: "split", eyebrow: "About us",
      heading: "Glad you stopped by",
      body: s?.about || "This is our place on the web to share photos, milestones and everyday moments with family and friends. Have a look around, and if you're part of the family, sign in to see more.",
      image: null, side: "right", buttons: [],
    },
    {
      id: "highlights", type: "cards", heading: "What you'll find here", intro: "", columns: 3, bg: "muted",
      items: [
        { icon: "camera", title: "Photo albums", body: "Trips, holidays and everyday moments, gathered into albums.", href: "/gallery" },
        { icon: "newspaper", title: "Updates", body: "News and milestones we've chosen to share with everyone." },
        { icon: "lock", title: "A private space", body: "Members get a private feed, albums and messages, by invitation only.", href: "/login" },
      ],
    },
    { id: "albums", type: "gallery", heading: "Recent photos", intro: "", limit: 6 },
    { id: "news", type: "updates", heading: "Latest updates", limit: 5, width: "narrow" },
    {
      id: "join", type: "cta", heading: "Part of the family?", bg: "bold",
      body: "Members can sign in to see private posts, albums and messages. Ask anyone already here for an invite.",
      buttons: [{ label: "Member login", href: "/login", style: "primary" }],
    },
  ];
}

/** Only web addresses, email links and paths on this site are followed. */
export function safeHref(href: string | undefined) {
  if (!href) return "#";
  return /^(https?:\/\/|mailto:|\/|#)/i.test(href.trim()) ? href.trim() : "#";
}
