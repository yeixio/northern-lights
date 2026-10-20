import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { requireUser, type AppEnv } from "../auth.js";
import { newId, now, type DB } from "../db/index.js";
import type { ImportsTable } from "../db/schema.js";
import { publish } from "../events.js";
import type { Storage } from "../storage.js";
import { fileKey, saveUpload } from "./files.js";

// Importing from another site (today: a Facebook "Download Your Information"
// export). The browser reads the export and sends it here piece by piece:
// each photo, then the albums and posts that use them. Every piece carries a
// stable `key` from the export, so an interrupted import can simply be run
// again and only what's missing is added.

const sourceKey = z.string().min(1).max(500);
const fileUrl = z.string().regex(/^\/files\/[\w.-]+$/);
const date = z.iso.datetime().optional();

async function findImport(db: DB, userId: string, key: string) {
  return db.selectFrom("imports").selectAll()
    .where("user_id", "=", userId).where("source_key", "=", key).executeTakeFirst();
}

async function remember(db: DB, userId: string, key: string, kind: ImportsTable["kind"], ref: string) {
  await db.insertInto("imports")
    .values({ user_id: userId, source_key: key, kind, ref, created_at: now() })
    .onConflict((oc) => oc.columns(["user_id", "source_key"]).doUpdateSet({ kind, ref }))
    .execute();
}

/** Only the importer's own uploads can go into an imported album or post. */
async function assertOwnFiles(db: DB, userId: string, urls: string[]) {
  const keys = [...new Set(urls.map((u) => fileKey(u)!))];
  if (keys.length === 0) return;
  const rows = await db.selectFrom("files").select("key")
    .where("key", "in", keys).where("owner_id", "=", userId).execute();
  if (rows.length !== keys.length) throw new HTTPException(400, { message: "Unknown file in import" });
}

export const importRoutes = (storage: Storage) => new Hono<AppEnv>()
  .use(async (c, next) => {
    requireUser(c);
    await next();
  })

  /** Which of these files were already imported? Returns key → URL. */
  .post("/imports/lookup", async (c) => {
    const user = requireUser(c);
    const { keys } = z.object({ keys: z.array(sourceKey).max(2000) }).parse(await c.req.json());
    const found: Record<string, string> = {};
    if (keys.length === 0) return c.json({ found });
    const rows = await c.get("db").selectFrom("imports")
      .innerJoin("files", "files.key", "imports.ref")
      .select(["imports.source_key", "imports.ref"])
      .where("imports.user_id", "=", user.id).where("imports.kind", "=", "file")
      .where("imports.source_key", "in", keys)
      .execute();
    for (const r of rows) found[r.source_key] = `/files/${r.ref}`;
    return c.json({ found });
  })

  /** Store one photo or video (multipart: `file`, `key`). Skips it if it's already here. */
  .post("/imports/files", async (c) => {
    const user = requireUser(c);
    const db = c.get("db");
    const body = await c.req.parseBody();
    const key = sourceKey.parse(body.key);
    if (!(body.file instanceof File)) throw new HTTPException(400, { message: "No file uploaded" });
    const existing = await findImport(db, user.id, key);
    if (existing?.kind === "file") {
      const file = await db.selectFrom("files").select("mime").where("key", "=", existing.ref).executeTakeFirst();
      if (file) {
        return c.json({ url: `/files/${existing.ref}`, type: file.mime.startsWith("video/") ? "video" : "image", existing: true });
      }
    }
    const saved = await saveUpload(db, storage, user.id, body.file);
    await remember(db, user.id, key, "file", saved.key);
    return c.json({ url: saved.url, type: saved.type, existing: false }, 201);
  })

  /**
   * Create the album for `key` (private) if it isn't here yet, and add any of
   * `items` it doesn't already have. Large albums are sent in several calls.
   */
  .post("/imports/albums", async (c) => {
    const user = requireUser(c);
    const db = c.get("db");
    const body = z.object({
      key: sourceKey,
      title: z.string().trim().min(1).max(200),
      description: z.string().trim().max(2000).nullable().optional(),
      created_at: date,
      items: z.array(z.object({
        url: fileUrl,
        type: z.enum(["image", "video"]),
        caption: z.string().max(500).nullable().optional(),
        created_at: date,
      })).max(200),
    }).parse(await c.req.json());
    await assertOwnFiles(db, user.id, body.items.map((m) => m.url));

    const t = now();
    const previous = await findImport(db, user.id, body.key);
    let album = previous?.kind === "album"
      ? await db.selectFrom("albums").selectAll().where("id", "=", previous.ref).where("owner_id", "=", user.id).executeTakeFirst()
      : undefined;
    if (!album) {
      album = {
        id: newId(), owner_id: user.id, title: body.title, description: body.description || null,
        cover_url: null, is_public: 0, created_at: body.created_at ?? t, updated_at: t,
      };
      await db.insertInto("albums").values(album).execute();
      await remember(db, user.id, body.key, "album", album.id);
    }

    const have = new Set((await db.selectFrom("media").select("url").where("album_id", "=", album.id).execute()).map((m) => m.url));
    const fresh: typeof body.items = [];
    for (const m of body.items) {
      if (have.has(m.url)) continue;
      have.add(m.url);
      fresh.push(m);
    }
    if (fresh.length > 0) {
      await db.insertInto("media").values(fresh.map((m) => ({
        id: newId(), user_id: user.id, album_id: album.id, url: m.url, type: m.type,
        caption: m.caption?.slice(0, 500) || null, created_at: m.created_at ?? t,
      }))).execute();
    }
    const firstImage = fresh.find((m) => m.type === "image");
    if (!album.cover_url && firstImage) {
      await db.updateTable("albums").set({ cover_url: firstImage.url, updated_at: t }).where("id", "=", album.id).execute();
    }
    return c.json({ id: album.id, added: fresh.length });
  })

  /** Add posts (members only, never public) with their original dates. Known keys are skipped. */
  .post("/imports/posts", async (c) => {
    const user = requireUser(c);
    const db = c.get("db");
    const { posts } = z.object({
      posts: z.array(z.object({
        key: sourceKey,
        content: z.string().max(10_000).default(""),
        media_urls: z.array(fileUrl).max(20).default([]),
        created_at: date,
      })).max(100),
    }).parse(await c.req.json());
    await assertOwnFiles(db, user.id, posts.flatMap((p) => p.media_urls));

    let added = 0;
    for (const p of posts) {
      if (!p.content.trim() && p.media_urls.length === 0) continue;
      const previous = await findImport(db, user.id, p.key);
      if (previous?.kind === "post" &&
        await db.selectFrom("posts").select("id").where("id", "=", previous.ref).executeTakeFirst()) continue;
      const id = newId();
      const t = p.created_at ?? now();
      await db.insertInto("posts").values({
        id, user_id: user.id, content: p.content.trim(), media_urls: JSON.stringify(p.media_urls),
        is_public: 0, created_at: t, updated_at: t,
      }).execute();
      await remember(db, user.id, p.key, "post", id);
      added++;
    }
    if (added > 0) publish({ type: "posts" });
    return c.json({ added });
  });
