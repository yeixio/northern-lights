// Reads a Facebook "Download Your Information" export (JSON format) and works
// out what to import: albums with their photos and videos, loose photos and
// videos, and optionally the member's own posts.
//
// Facebook has moved files around between export versions (photos_and_videos/,
// posts/, your_activity_across_facebook/, your_facebook_activity/...), so files
// are found by name and shape rather than by fixed paths.

import type { ArchiveEntry } from "./zip";

export interface ImportItem {
  /** Stable across exports: the file name Facebook gave it plus its size. */
  key: string;
  entry: ArchiveEntry;
  name: string;
  type: "image" | "video";
  mime: string;
  caption: string | null;
  created_at: string | null;
}

export interface ImportAlbum {
  key: string;
  title: string;
  description: string | null;
  created_at: string | null;
  items: ImportItem[];
}

export interface ImportPost {
  key: string;
  content: string;
  created_at: string | null;
  items: ImportItem[];
}

export interface ImportPlan {
  albums: ImportAlbum[];
  posts: ImportPost[];
  photos: number;
  videos: number;
  /** Files the export mentions but that weren't in the chosen zip(s). */
  missing: number;
  /** Files we can't import, such as unusual formats. */
  unsupported: number;
}

const MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
  heic: "image/heic", heif: "image/heif", avif: "image/avif",
  mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm",
};

/**
 * Facebook writes text as UTF-8 bytes escaped one byte per character
 * ("CafÃ©" for "Café"). Undo that when the text looks like it.
 */
export function fixText(s: string | null | undefined): string {
  if (!s) return "";
  if (!/[\u0080-ÿ]/.test(s) || /[^\u0000-ÿ]/.test(s)) return s;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(s, (ch) => ch.charCodeAt(0)));
  } catch {
    return s;
  }
}

const toDate = (ts: unknown) =>
  typeof ts === "number" && ts > 0 ? new Date(ts * 1000).toISOString() : null;

const basename = (p: string) => p.slice(p.lastIndexOf("/") + 1);
const dirname = (p: string) => p.slice(0, Math.max(0, p.lastIndexOf("/")));

/** Looks up the files that export JSON points to, wherever the export's root folder ended up. */
class FileIndex {
  private byPath = new Map<string, ArchiveEntry>();
  constructor(entries: ArchiveEntry[]) {
    // Register every path and each tail of it, so "posts/media/x.jpg" also
    // finds "facebook-name-2024/your_facebook_activity/posts/media/x.jpg".
    for (const e of entries) {
      let p = e.path;
      for (;;) {
        if (!this.byPath.has(p)) this.byPath.set(p, e);
        const slash = p.indexOf("/");
        if (slash < 0) break;
        p = p.slice(slash + 1);
      }
    }
  }
  find(uri: string) {
    const clean = uri.replace(/^\.?\//, "");
    for (let p = clean; ; p = p.slice(p.indexOf("/") + 1)) {
      const hit = this.byPath.get(p);
      if (hit) return hit;
      if (!p.includes("/")) return undefined;
    }
  }
}

interface FbMedia {
  uri?: string;
  creation_timestamp?: number;
  title?: string;
  description?: string;
  media_metadata?: { photo_metadata?: { exif_data?: { taken_timestamp?: number }[] } };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const FILES = {
  album: /(^|\/)album\/[^/]+\.json$/,
  posts: /(^|\/)your_posts[^/]*\.json$/,
  loosePhotos: /(^|\/)your_uncategori[sz]ed_photos[^/]*\.json$/,
  videos: /(^|\/)your_videos[^/]*\.json$/,
};

export async function buildPlan(entries: ArchiveEntry[]): Promise<ImportPlan> {
  const json = entries.filter((e) => e.path.endsWith(".json") && !/(^|\/)messages\//.test(e.path));
  if (json.length === 0) {
    if (entries.some((e) => e.path.endsWith(".html"))) {
      throw new Error("This export is in HTML format. Request a new one from Facebook and choose JSON as the format.");
    }
    throw new Error("This doesn't look like a Facebook export. Choose the .zip file(s) Facebook sent you.");
  }

  const index = new FileIndex(entries);
  const plan: ImportPlan = { albums: [], posts: [], photos: 0, videos: 0, missing: 0, unsupported: 0 };
  const items = new Map<string, ImportItem>(); // by key, so a photo is only imported once
  const placed = new Set<string>(); // keys already in some album
  const missing = new Set<string>();
  const unsupported = new Set<string>();

  function item(m: FbMedia): ImportItem | null {
    if (!m.uri || /^https?:/.test(m.uri)) return null;
    const ext = m.uri.split(".").pop()!.toLowerCase();
    const mime = MIME[ext];
    if (!mime) {
      unsupported.add(m.uri);
      return null;
    }
    const entry = index.find(m.uri);
    if (!entry) {
      missing.add(m.uri);
      return null;
    }
    const key = `fb:file:${basename(entry.path)}:${entry.size}`;
    const known = items.get(key);
    if (known) return known;
    const taken = m.media_metadata?.photo_metadata?.exif_data?.find((x) => x.taken_timestamp)?.taken_timestamp;
    const found: ImportItem = {
      key, entry, name: basename(entry.path), mime,
      type: mime.startsWith("video/") ? "video" : "image",
      caption: fixText(m.description).trim().slice(0, 500) || null,
      created_at: toDate(taken) ?? toDate(m.creation_timestamp),
    };
    items.set(key, found);
    return found;
  }

  function addAlbum(key: string, title: string, description: string | null, created_at: string | null, media: FbMedia[]) {
    const list: ImportItem[] = [];
    for (const m of media) {
      const it = item(m);
      if (it && !placed.has(it.key)) {
        placed.add(it.key);
        list.push(it);
      }
    }
    if (list.length === 0) return;
    list.sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
    const latest = list.reduce<string | null>((d, it) => (it.created_at && (!d || it.created_at > d) ? it.created_at : d), null);
    plan.albums.push({ key, title: title.slice(0, 200) || "Facebook album", description, created_at: created_at ?? latest, items: list });
  }

  const read = async (e: ArchiveEntry): Promise<unknown> => {
    try {
      return JSON.parse(await (await e.blob()).text());
    } catch {
      return null;
    }
  };

  // 1. Albums.
  for (const e of json.filter((e) => FILES.album.test(e.path))) {
    const a = await read(e);
    if (!isObject(a) || !Array.isArray(a.photos)) continue;
    const photos = a.photos as FbMedia[];
    const name = fixText(a.name as string).trim();
    const folder = basename(dirname(photos[0]?.uri ?? ""));
    addAlbum(`fb:album:${folder}|${name}`, name, fixText(a.description as string).trim() || null,
      toDate(a.last_modified_timestamp), photos);
  }

  // 2. Photos and videos that aren't in an album.
  const loose: FbMedia[] = [];
  const videos: FbMedia[] = [];
  for (const e of json) {
    if (!FILES.loosePhotos.test(e.path) && !FILES.videos.test(e.path)) continue;
    const data = await read(e);
    if (!isObject(data)) continue;
    for (const [k, v] of Object.entries(data)) {
      if (!Array.isArray(v)) continue;
      (/video/.test(k) ? videos : loose).push(...(v as FbMedia[]));
    }
  }

  // 3. Posts (and the photos in them).
  const postMedia: FbMedia[] = [];
  for (const e of json.filter((e) => FILES.posts.test(e.path))) {
    const data = await read(e);
    const list = Array.isArray(data) ? data : isObject(data) ? Object.values(data).find(Array.isArray) ?? [] : [];
    for (const p of list as Record<string, any>[]) {
      if (!isObject(p)) continue;
      const media: FbMedia[] = [];
      let link = "";
      for (const att of Array.isArray(p.attachments) ? p.attachments : []) {
        for (const d of Array.isArray(att?.data) ? att.data : []) {
          if (isObject(d?.media)) media.push(d.media as FbMedia);
          if (typeof d?.external_context?.url === "string") link ||= d.external_context.url;
        }
      }
      postMedia.push(...media);
      const text = (Array.isArray(p.data) ? p.data : []).map((d: any) => (typeof d?.post === "string" ? fixText(d.post) : ""))
        .filter(Boolean).join("\n\n").trim();
      const content = [text, link].filter(Boolean).join("\n\n");
      const postItems = media.map(item).filter((x): x is ImportItem => !!x).slice(0, 20);
      if (!content && postItems.length === 0) continue;
      plan.posts.push({
        key: `fb:post:${p.timestamp ?? ""}:${content.slice(0, 80)}:${postItems.map((x) => x.name).join(",").slice(0, 200)}`,
        content: content.slice(0, 10_000),
        created_at: toDate(p.timestamp),
        items: postItems,
      });
    }
  }

  addAlbum("fb:album:posts", "Photos from Facebook posts", "Photos and videos from your Facebook posts", null, postMedia);
  addAlbum("fb:album:other", "Other Facebook photos", null, null, loose);
  addAlbum("fb:album:videos", "Facebook videos", null, null, videos);

  plan.missing = missing.size;
  plan.unsupported = unsupported.size;
  for (const it of items.values()) {
    if (it.type === "video") plan.videos++;
    else plan.photos++;
  }
  plan.posts.sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
  return plan;
}
