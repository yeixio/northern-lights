import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { homeSchema, themeSchema } from "../appearance.js";
import { newToken, requireAdmin, resetExpiry, type AppEnv } from "../auth.js";
import { now, type DB } from "../db/index.js";
import { publish } from "../events.js";
import { fromAddress, mailSettingsSchema, mailSource, sendMail, siteMailSettings, transportFor } from "../mail.js";
import { profile } from "../serialize.js";
import { appUrl } from "../url.js";

const text = (max: number) => z.string().trim().max(max).nullable().optional();
const fileUrl = z.string().regex(/^\/files\/[\w.-]+$/);

/** Checks mail settings from the form. An empty password keeps the saved one. */
async function withSavedPassword(db: DB, input: unknown) {
  const settings = mailSettingsSchema.parse(input);
  if (!settings.pass) settings.pass = (await siteMailSettings(db)).settings?.pass ?? "";
  return settings;
}

export const adminRoutes = new Hono<AppEnv>()
  .use(async (c, next) => {
    requireAdmin(c);
    await next();
  })

  // Only the fields sent are changed.
  .put("/site", async (c) => {
    const body = z.object({
      site_name: z.string().trim().min(1, "The site needs a name").max(200).optional(),
      tagline: text(500),
      about: text(20_000),
      hero_image_url: fileUrl.nullable().optional(),
      logo_url: fileUrl.nullable().optional(),
      contact_email: text(320),
      footer_text: text(500),
      show_credit: z.boolean().optional(),
    }).parse(await c.req.json());
    const { show_credit, ...fields } = body;
    const set: Record<string, string | number | null> = { updated_at: now() };
    for (const [key, value] of Object.entries(fields)) if (value !== undefined) set[key] = value || null;
    if (show_credit !== undefined) set.show_credit = show_credit ? 1 : 0;
    await c.get("db").updateTable("site_settings").set(set).where("id", "=", 1).execute();
    return c.json({ ok: true });
  })

  // Email settings. The password is never sent back, only whether one is saved.
  .get("/mail", async (c) => {
    const source = await mailSource(c.get("db"));
    const { settings } = await siteMailSettings(c.get("db"));
    const { pass, ...rest } = settings ?? { pass: "" };
    return c.json({ source, settings: settings ? rest : null, has_password: Boolean(pass) });
  })

  .put("/mail", async (c) => {
    const db = c.get("db");
    const settings = await withSavedPassword(db, await c.req.json());
    await db.updateTable("site_settings").set({ mail: JSON.stringify(settings), updated_at: now() })
      .where("id", "=", 1).execute();
    return c.json({ ok: true });
  })

  .delete("/mail", async (c) => {
    await c.get("db").updateTable("site_settings").set({ mail: null, updated_at: now() }).where("id", "=", 1).execute();
    return c.json({ ok: true });
  })

  // Sends a test email to the admin with the settings in the form (saved or
  // not), so they can check them before saving. With SMTP_URL set, tests that.
  .post("/mail/test", async (c) => {
    const admin = requireAdmin(c);
    const db = c.get("db");
    const { siteName } = await siteMailSettings(db);
    const body = await c.req.json().catch(() => null);
    let sent: Promise<unknown>;
    const message = {
      to: admin.email,
      subject: `Test email from ${siteName}`,
      text: `It works! ${siteName} can send email, so invitations and password resets will now be emailed.\n`,
    };
    if (await mailSource(db) === "env") {
      sent = sendMail(db, message.to, message.subject, message.text).then((ok) => {
        if (!ok) throw new Error("Sending failed. Check SMTP_URL and the server log.");
      });
    } else {
      const settings = await withSavedPassword(db, body);
      sent = transportFor(settings).sendMail({ ...message, from: fromAddress(settings, siteName) });
    }
    try {
      await sent;
    } catch (err) {
      throw new HTTPException(502, { message: `The test email couldn't be sent: ${err instanceof Error ? err.message : err}` });
    }
    return c.json({ ok: true, to: admin.email });
  })

  .put("/theme", async (c) => {
    const theme = themeSchema.parse(await c.req.json());
    await c.get("db").updateTable("site_settings").set({ theme: JSON.stringify(theme), updated_at: now() })
      .where("id", "=", 1).execute();
    return c.json({ ok: true });
  })

  .put("/home", async (c) => {
    const home = homeSchema.parse(await c.req.json());
    const json = JSON.stringify(home);
    if (json.length > 200_000) throw new HTTPException(413, { message: "The home page is too large" });
    await c.get("db").updateTable("site_settings").set({ home: json, updated_at: now() }).where("id", "=", 1).execute();
    return c.json({ ok: true });
  })

  // Back to the starter layout.
  .delete("/home", async (c) => {
    await c.get("db").updateTable("site_settings").set({ home: null, updated_at: now() }).where("id", "=", 1).execute();
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
