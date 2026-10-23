import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sql } from "kysely";
import { requireUser, type AppEnv } from "../auth.js";
import { config } from "../config.js";
import { now, type DB } from "../db/index.js";
import { validFileSignature } from "../signing.js";
import type { Storage } from "../storage.js";

const ALLOWED = /^(image\/(jpeg|png|gif|webp|avif|heic|heif)|video\/(mp4|webm|quicktime))$/;
const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp", "image/avif": "avif",
  "image/heic": "heic", "image/heif": "heif", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
};

export const fileKey = (url: string) => /^\/files\/([\w.-]+)$/.exec(url)?.[1] ?? null;

/**
 * Is this file referenced by something on the public page? Files are private
 * to members unless they are the logo or header image, are used on the home page, or
 * belong to a public post or public album.
 */
async function isPublicFile(db: DB, key: string) {
  const url = `/files/${key}`;
  const hit = sql<number>`1`.as("hit");
  const row = await db.selectFrom("site_settings").select(hit)
    .where((eb) => eb.or([eb("hero_image_url", "=", url), eb("logo_url", "=", url)]))
    .union(db.selectFrom("site_settings").select(hit).where("home", "like", `%"${url}"%`))
    .union(db.selectFrom("albums").select(hit).where("is_public", "=", 1).where("cover_url", "=", url))
    .union(db.selectFrom("media").innerJoin("albums", "albums.id", "media.album_id").select(hit)
      .where("albums.is_public", "=", 1).where("media.url", "=", url))
    .union(db.selectFrom("posts").select(hit).where("is_public", "=", 1).where("media_urls", "like", `%"${url}"%`))
    .limit(1)
    .executeTakeFirst();
  return Boolean(row);
}

/** Check and store one uploaded photo or video, returning its URL. */
export async function saveUpload(db: DB, storage: Storage, ownerId: string, file: File) {
  if (!ALLOWED.test(file.type)) throw new HTTPException(415, { message: `${file.name}: only photos and videos are allowed` });
  if (file.size > config.maxUploadBytes) throw new HTTPException(413, { message: `${file.name} is too large` });
  const key = `${crypto.randomUUID()}.${EXT[file.type]}`;
  await storage.put(key, Buffer.from(await file.arrayBuffer()), file.type);
  await db.insertInto("files")
    .values({ key, owner_id: ownerId, mime: file.type, size: file.size, created_at: now() }).execute();
  return { key, url: `/files/${key}`, type: file.type.startsWith("video/") ? "video" as const : "image" as const };
}

export const uploadRoutes = (storage: Storage) => new Hono<AppEnv>()
  .post("/uploads", async (c) => {
    const user = requireUser(c);
    const body = await c.req.parseBody({ all: true });
    const files = ([] as unknown[]).concat(body.file ?? []).filter((f): f is File => f instanceof File);
    if (files.length === 0) throw new HTTPException(400, { message: "No file uploaded" });
    const out = [];
    for (const file of files) {
      const { url, type } = await saveUpload(c.get("db"), storage, user.id, file);
      out.push({ url, type });
    }
    return c.json(out, 201);
  });

export const fileRoutes = (storage: Storage) => new Hono<AppEnv>()
  .get("/:key", async (c) => {
    const key = c.req.param("key");
    const db = c.get("db");
    const meta = await db.selectFrom("files").selectAll().where("key", "=", key).executeTakeFirst();
    if (!meta) return c.notFound();
    // Members see every file; the app uses signed links (server/signing.ts).
    const member = c.get("user") !== null || (await validFileSignature(db, key, c.req.query("exp"), c.req.query("sig")));
    if (!member && !(await isPublicFile(db, key))) return c.notFound();
    const stream = await storage.get(key);
    if (!stream) return c.notFound();
    return new Response(stream, {
      headers: {
        "Content-Type": meta.mime,
        "Content-Length": String(meta.size),
        "Cache-Control": member ? "private, max-age=86400" : "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  });
