import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../auth.js";
import { album, bool } from "../serialize.js";

/** Everything here is readable without signing in. */
export const publicRoutes = new Hono<AppEnv>()
  .get("/site", async (c) => {
    const s = await c.get("db").selectFrom("site_settings")
      .select(["site_name", "tagline", "about", "hero_image_url", "contact_email"]).executeTakeFirst();
    return c.json(s);
  })

  .get("/albums", async (c) => {
    const rows = await c.get("db").selectFrom("albums").selectAll().where("is_public", "=", 1)
      .orderBy("created_at", "desc").execute();
    return c.json(rows.map((a) => ({ ...album(a), owner_id: null })));
  })

  .get("/albums/:id", async (c) => {
    const db = c.get("db");
    const a = await db.selectFrom("albums").selectAll().where("id", "=", c.req.param("id"))
      .where("is_public", "=", 1).executeTakeFirst();
    if (!a) throw new HTTPException(404, { message: "Album not found" });
    const media = await db.selectFrom("media").select(["id", "url", "type", "caption", "created_at"])
      .where("album_id", "=", a.id).orderBy("created_at").execute();
    return c.json({ ...album(a), owner_id: null, media });
  })

  .get("/posts", async (c) => {
    const rows = await c.get("db").selectFrom("posts").select(["id", "content", "media_urls", "is_public", "created_at"])
      .where("is_public", "=", 1).orderBy("created_at", "desc").limit(20).execute();
    return c.json(rows.map((p) => ({ ...p, is_public: bool(p.is_public), media_urls: JSON.parse(p.media_urls) as string[] })));
  });
