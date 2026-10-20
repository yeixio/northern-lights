import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { newToken, requireAdmin, resetExpiry, type AppEnv } from "../auth.js";
import { now } from "../db/index.js";
import { publish } from "../events.js";
import { profile } from "../serialize.js";
import { appUrl } from "../url.js";

const text = (max: number) => z.string().trim().max(max).nullable().optional();

export const adminRoutes = new Hono<AppEnv>()
  .use(async (c, next) => {
    requireAdmin(c);
    await next();
  })

  .put("/site", async (c) => {
    const body = z.object({
      site_name: z.string().trim().min(1).max(200),
      tagline: text(500),
      about: text(20_000),
      hero_image_url: z.string().regex(/^\/files\/[\w.-]+$/).nullable().optional(),
      contact_email: text(320),
    }).parse(await c.req.json());
    await c.get("db").updateTable("site_settings").set({
      site_name: body.site_name,
      tagline: body.tagline || null,
      about: body.about || null,
      hero_image_url: body.hero_image_url ?? null,
      contact_email: body.contact_email || null,
      updated_at: now(),
    }).where("id", "=", 1).execute();
    return c.json({ ok: true });
  })

  .get("/members", async (c) => {
    const rows = await c.get("db").selectFrom("users").selectAll().orderBy("created_at").execute();
    return c.json(rows.map(profile));
  })

  .patch("/members/:id", async (c) => {
    const admin = requireAdmin(c);
    const id = c.req.param("id");
    if (id === admin.id) throw new HTTPException(400, { message: "You can't change your own role here" });
    const body = z.object({ is_admin: z.boolean().optional(), is_active: z.boolean().optional() }).parse(await c.req.json());
    const db = c.get("db");
    await db.updateTable("users").set({
      ...(body.is_admin !== undefined && { is_admin: body.is_admin ? 1 : 0 }),
      ...(body.is_active !== undefined && { is_active: body.is_active ? 1 : 0 }),
      updated_at: now(),
    }).where("id", "=", id).execute();
    if (body.is_active === false) await db.deleteFrom("sessions").where("user_id", "=", id).execute();
    return c.json({ ok: true });
  })

  .delete("/members/:id", async (c) => {
    const admin = requireAdmin(c);
    const id = c.req.param("id");
    if (id === admin.id) throw new HTTPException(400, { message: "You can't remove yourself" });
    await c.get("db").deleteFrom("users").where("id", "=", id).execute();
    publish({ type: "posts" });
    return c.json({ ok: true });
  })

  // For home servers without email: an admin makes a reset link and passes it on.
  .post("/members/:id/reset-link", async (c) => {
    const db = c.get("db");
    const user = await db.selectFrom("users").select("id").where("id", "=", c.req.param("id")).executeTakeFirst();
    if (!user) throw new HTTPException(404, { message: "Member not found" });
    const { token, hash } = newToken();
    await db.insertInto("password_resets")
      .values({ token_hash: hash, user_id: user.id, expires_at: resetExpiry(), created_at: now() }).execute();
    return c.json({ link: `${appUrl(c)}/reset-password?token=${token}` });
  });
