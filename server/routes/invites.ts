import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { inviteExpiry, newToken, requireUser, type AppEnv } from "../auth.js";
import { newId, now } from "../db/index.js";
import { sendMail } from "../mail.js";
import { displayName } from "../names.js";
import { appUrl } from "../url.js";

export const inviteRoutes = new Hono<AppEnv>()
  .get("/invitations", async (c) => {
    const user = requireUser(c);
    let q = c.get("db").selectFrom("invitations")
      .select(["id", "email", "invited_by", "message", "expires_at", "accepted_at", "created_at"])
      .orderBy("created_at", "desc");
    if (!user.is_admin) q = q.where("invited_by", "=", user.id);
    return c.json(await q.execute());
  })

  // Creates an invite link. It is emailed when SMTP is configured; the link is
  // always returned so the inviter can also share it themselves.
  .post("/invitations", async (c) => {
    const user = requireUser(c);
    const db = c.get("db");
    const body = z.object({
      email: z.string().trim().toLowerCase().pipe(z.email()),
      message: z.string().trim().max(1000).optional(),
    }).parse(await c.req.json());
    const member = await db.selectFrom("users").select("id").where("email", "=", body.email).executeTakeFirst();
    if (member) throw new HTTPException(409, { message: "That person is already a member" });

    const { token, hash } = newToken();
    await db.insertInto("invitations").values({
      id: newId(), token_hash: hash, email: body.email, invited_by: user.id, message: body.message || null,
      expires_at: inviteExpiry(), created_at: now(),
    }).execute();

    const link = `${appUrl(c)}/welcome?token=${token}`;
    const site = await db.selectFrom("site_settings").select("site_name").executeTakeFirst();
    const siteName = site?.site_name ?? "Northern Lights";
    const emailed = await sendMail(
      db,
      body.email,
      `${displayName(user)} invited you to ${siteName}`,
      [
        `${displayName(user)} invited you to join ${siteName}, a private social site.`,
        body.message ? `\n"${body.message}"\n` : "",
        `Accept the invitation and create your account here:\n${link}`,
        "\nThis link works once and expires in a couple of weeks.",
      ].join("\n"),
    );
    return c.json({ link, emailed }, 201);
  })

  .delete("/invitations/:id", async (c) => {
    const user = requireUser(c);
    const db = c.get("db");
    const inv = await db.selectFrom("invitations").select(["id", "invited_by"]).where("id", "=", c.req.param("id")).executeTakeFirst();
    if (!inv) throw new HTTPException(404, { message: "Invitation not found" });
    if (inv.invited_by !== user.id && !user.is_admin) throw new HTTPException(403, { message: "Not your invitation" });
    await db.deleteFrom("invitations").where("id", "=", inv.id).execute();
    return c.json({ ok: true });
  });
