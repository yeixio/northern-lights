import { z } from "zod";

// The site's look (set by an admin) and each member's own preferences are
// stored as JSON text. These schemas are the source of truth for what may be
// saved; the client in src/lib/theme.ts and src/lib/home.ts mirrors them.

export const PRESETS = ["aurora", "fjord", "ember", "forest", "orchid", "graphite"] as const;
const hex = z.string().regex(/^#[0-9a-f]{6}$/i, "Use a color like #10b981");
const mode = z.enum(["light", "dark", "system"]);

export const themeSchema = z.object({
  preset: z.enum(PRESETS),
  primary: hex.nullable().optional(),
  accent: hex.nullable().optional(),
  mode,
  font: z.enum(["sans", "serif", "rounded"]),
  radius: z.enum(["sharp", "default", "round"]),
});

/** A member's own choices for the private area. null means "use the site's". */
export const preferencesSchema = z.object({
  preset: z.enum(PRESETS).nullable(),
  primary: hex.nullable().optional(),
  mode: mode.nullable(),
});

export const SECTION_TYPES = ["hero", "text", "split", "cards", "image", "gallery", "updates", "cta"] as const;

const unsafeLink = /^\s*(javascript|data|vbscript):/i;
const text = z.string().max(20_000).refine((s) => !unsafeLink.test(s), "Links must be web addresses or site paths");
const value = z.union([text, z.number(), z.boolean(), z.null()]);
const item = z.record(z.string().max(40), value);

/**
 * Home page sections are free-form per type (headings, body text, images,
 * buttons), so only their shape and size are checked here.
 */
const section = z.object({
  id: z.string().min(1).max(40),
  type: z.enum(SECTION_TYPES),
}).catchall(z.union([value, z.array(item).max(24)]));

export const homeSchema = z.object({
  sections: z.array(section).max(40),
});

export function parseJson<T>(text: string | null | undefined): T | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
