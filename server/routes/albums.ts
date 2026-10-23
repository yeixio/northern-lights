import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { requireUser, type AppEnv } from "../auth.js";
import { newId, now, type DB } from "../db/index.js";
import type { User } from "../db/schema.js";
import { album } from "../serialize.js";
import type { Storage } from "../storage.js";
import { fileKey } from "./files.js";
import { fileUrlSchema as fileUrl } from "../signing.js";


async function editableAlbum(db: DB, id: string, user: User) {
  const a = await db.selectFrom("albums").selectAll().where("id", "=", id).executeTakeFirst();
  if (!a) throw new HTTPException(404, { message: "Album not found" });
  if (a.owner_id !== user.id && !user.is_admin) throw new HTTPException(403, { message: "Not your album" });
  return a;
}

export const albumRoutes = (storage: Storage) => new Hono<AppEnv>()
  .use(async (c, next) => {
    requireUser(c);
    await next();
  })

  .get("/albums", async (c) => {
    const rows = await c.get("db").selectFrom("albums").selectAll().orderBy("created_at", "desc").execute();
    return c.json(rows.map(album));
  })

  .post("/albums", async (c) => {
    const user = requireUser(c);
    const body = z.object({
      title: z.string().trim().min(1).max(200),
      description: z.string().trim().max(2000).nullable().optional(),
      is_public: z.boolean().default(false),
    }).parse(await c.req.json());
    const t = now();
    const id = newId();
    await c.get("db").insertInto("albums").values({
      id, owner_id: user.id, title: body.title, description: body.description || null,
      is_public: body.is_public ? 1 : 0, created_at: t, updated_at: t,
    }).execute();
    return c.json({ id }, 201);
  })

  .get("/albums/:id", async (c) => {
    const db = c.get("db");
    const a = await db.selectFrom("albums").selectAll().where("id", "=", c.req.param("id")).executeTakeFirst();
    if (!a) throw new HTTPException(404, { message: "Album not found" });
    const items = await db.selectFrom("media").selectAll().where("album_id", "=", a.id).orderBy("created_at").execute();
    return c.json({ ...album(a), media: items });
  })

  .patch("/albums/:id", async (c) => {
    const user = requireUser(c);
    const db = c.get("db");
    const a = await editableAlbum(db, c.req.param("id"), user);
    const body = z.object({
      title: z.string().trim().min(1).max(200).optional(),
      description: z.string().trim().max(2000).nullable().optional(),
      cover_url: fileUrl.nullable().optional(),
      is_public: z.boolean().optional(),
    }).parse(await c.req.json());
    await db.updateTable("albums").set({
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description || null }),
      ...(body.cover_url !== undefined && { cover_url: body.cover_url }),
      ...(body.is_public !== undefined && { is_public: body.is_public ? 1 : 0 }),
      updated_at: now(),
    }).where("id", "=", a.id).execute();
    return c.json({ ok: true });
  })

  .delete("/albums/:id", async (c) => {
    const user = requireUser(c);
    const db = c.get("db");
    const a = await editableAlbum(db, c.req.param("id"), user);
    const items = await db.selectFrom("media").select("url").where("album_id", "=", a.id).execute();
    await db.deleteFrom("albums").where("id", "=", a.id).execute();
    await Promise.all(items.map((m) => removeFile(db, storage, m.url)));
    return c.json({ ok: true });
  })

  .post("/albums/:id/media", async (c) => {
    const user = requireUser(c);
    const db = c.get("db");
    const a = await db.selectFrom("albums").selectAll().where("id", "=", c.req.param("id")).executeTakeFirst();
    if (!a) throw new HTTPException(404, { message: "Album not found" });
    const body = z.object({
      items: z.array(z.object({ url: fileUrl, type: z.enum(["image", "video"]), caption: z.string().max(500).optional() })).min(1).max(100),
    }).parse(await c.req.json());
    const t = now();
    await db.insertInto("media").values(body.items.map((m) => ({
      id: newId(), user_id: user.id, album_id: a.id, url: m.url, type: m.type, caption: m.caption ?? null, created_at: t,
    }))).execute();
    const firstImage = body.items.find((m) => m.type === "image");
    if (!a.cover_url && firstImage) {
      await db.updateTable("albums").set({ cover_url: firstImage.url, updated_at: t }).where("id", "=", a.id).execute();
    }
    return c.json({ ok: true }, 201);
  })

  .delete("/media/:id", async (c) => {
    const user = requireUser(c);
    const db = c.get("db");
    const m = await db.selectFrom("media").selectAll().where("id", "=", c.req.param("id")).executeTakeFirst();
    if (!m) throw new HTTPException(404, { message: "Photo not found" });
    const a = await db.selectFrom("albums").select(["owner_id", "cover_url"]).where("id", "=", m.album_id).executeTakeFirst();
    if (m.user_id !== user.id && a?.owner_id !== user.id && !user.is_admin) {
      throw new HTTPException(403, { message: "Not your photo" });
    }
    await db.deleteFrom("media").where("id", "=", m.id).execute();
    if (a?.cover_url === m.url) {
      await db.updateTable("albums").set({ cover_url: null }).where("id", "=", m.album_id).execute();
    }
    await removeFile(db, storage, m.url);
    return c.json({ ok: true });
  });

async function removeFile(db: DB, storage: Storage, url: string) {
  const key = fileKey(url);
  if (!key) return;
  // An imported photo can be in an album and a post at once; keep it while anything still uses it.
  const inUse = await db.selectFrom("media").select("id").where("url", "=", url)
    .union(db.selectFrom("posts").select("id").where("media_urls", "like", `%"${url}"%`))
    .limit(1).executeTakeFirst();
  if (inUse) return;
  await db.deleteFrom("files").where("key", "=", key).execute();
  await storage.remove(key).catch(() => undefined);
}
