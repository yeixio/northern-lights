import { timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import {
  endSession, hashPassword, hashToken, newToken, rateLimit, requireUser, resetExpiry, startSession,
  verifyPassword, type AppEnv,
} from "../auth.js";
import { newId, now, type DB } from "../db/index.js";
import { mailEnabled, sendMail } from "../mail.js";
import { parseJson } from "../appearance.js";
import { profile } from "../serialize.js";
import { appUrl } from "../url.js";
import { config } from "../config.js";

const password = z.string().min(8, "Use at least 8 characters").max(200);
const name = z.string().trim().min(1).max(100);
const email = z.string().trim().toLowerCase().pipe(z.email());

export const loginSchema = z.object({ email, password: z.string() });
export const acceptSchema = z.object({ token: z.string(), password, first_name: name, last_name: name });

/** Checks an email and password, shared by the website's and the app's sign-in. */
export async function checkLogin(db: DB, body: z.infer<typeof loginSchema>) {
  rateLimit(`login:${body.email}`);
  const user = await db.selectFrom("users").selectAll().where("email", "=", body.email).executeTakeFirst();
  const ok = user && (await verifyPassword(body.password, user.password_hash));
  if (!user || !ok) throw new HTTPException(401, { message: "Wrong email or password" });
  if (!user.is_active) throw new HTTPException(403, { message: "This account has been suspended" });
  return user;
}

/** Creates the account an invite is for and returns its id. */
export async function acceptInvite(db: DB, body: z.infer<typeof acceptSchema>) {
  const id = newId();
  const t = now();
  await db.transaction().execute(async (trx) => {
    const invite = await trx.selectFrom("invitations").selectAll()
      .where("token_hash", "=", hashToken(body.token))
      .where("accepted_at", "is", null)
      .where("expires_at", ">", t)
      .executeTakeFirst();
    if (!invite) throw new HTTPException(400, { message: "This invite has expired or was already used" });
    const taken = await trx.selectFrom("users").select("id").where("email", "=", invite.email).executeTakeFirst();
    if (taken) throw new HTTPException(409, { message: "An account with this email already exists. Try signing in." });
    await trx.insertInto("users").values({
      id, email: invite.email, password_hash: await hashPassword(body.password),
      first_name: body.first_name, last_name: body.last_name,
      is_admin: 0, is_active: 1, created_at: t, updated_at: t,
    }).execute();
    await trx.updateTable("invitations").set({ accepted_at: t }).where("email", "=", invite.email)
      .where("accepted_at", "is", null).execute();
  });
  return id;
}

export const authRoutes = new Hono<AppEnv>()
  .get("/session", async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const anyUser = await db.selectFrom("users").select("id").limit(1).executeTakeFirst();
    const me = user ? { ...profile(user), preferences: parseJson(user.preferences) } : null;
    return c.json({
      user: me,
      needsSetup: !anyUser,
      // A hosted site is claimed with its setup link, not by whoever finds it first.
      setupNeedsLink: !anyUser && Boolean(config.setupToken),
      readOnly: config.readOnly,
      mailEnabled: await mailEnabled(db),
    });
  })

  // First-run: create the admin account. Only works while there are no users,
  // and on a hosted site only with its setup token.
  .post("/setup", async (c) => {
    const db = c.get("db");
    const body = z.object({ email, password, first_name: name, last_name: name, setup_token: z.string().optional() })
      .parse(await c.req.json());
    if (config.setupToken && !sameSecret(body.setup_token ?? "", config.setupToken)) {
      rateLimit(`setup:${c.req.header("x-forwarded-for") ?? "local"}`);
      throw new HTTPException(403, { message: "This site is set up with the link from its welcome email" });
    }
    const id = newId();
    const t = now();
    const created = await db.transaction().execute(async (trx) => {
      const existing = await trx.selectFrom("users").select("id").limit(1).executeTakeFirst();
      if (existing) return false;
      await trx.insertInto("users").values({
        id, email: body.email, password_hash: await hashPassword(body.password),
        first_name: body.first_name, last_name: body.last_name,
        is_admin: 1, is_active: 1, created_at: t, updated_at: t,
      }).execute();
      return true;
    });
    if (!created) throw new HTTPException(409, { message: "Setup is already complete" });
    await startSession(c, db, id);
    return c.json({ ok: true });
  })

  .post("/login", async (c) => {
    const db = c.get("db");
    const user = await checkLogin(db, loginSchema.parse(await c.req.json()));
    await startSession(c, db, user.id);
    return c.json({ user: profile(user) });
  })

  .post("/logout", async (c) => {
    await endSession(c, c.get("db"));
    return c.json({ ok: true });
  })

  .post("/password", async (c) => {
    const db = c.get("db");
    const user = requireUser(c);
    const body = z.object({ current: z.string(), password }).parse(await c.req.json());
    if (!(await verifyPassword(body.current, user.password_hash))) {
      throw new HTTPException(400, { message: "Current password is wrong" });
    }
    await db.updateTable("users").set({ password_hash: await hashPassword(body.password), updated_at: now() })
      .where("id", "=", user.id).execute();
    return c.json({ ok: true });
  })

  // Emails a reset link when SMTP is set up. Always answers the same way so it
  // can't be used to discover who is a member.
  .post("/password/forgot", async (c) => {
    const db = c.get("db");
    const body = z.object({ email }).parse(await c.req.json());
    rateLimit(`forgot:${body.email}`, 5);
    const user = await db.selectFrom("users").select(["id", "is_active"]).where("email", "=", body.email).executeTakeFirst();
    const mailOn = await mailEnabled(db);
    if (user?.is_active && mailOn) {
      const { token, hash } = newToken();
      await db.insertInto("password_resets")
        .values({ token_hash: hash, user_id: user.id, expires_at: resetExpiry(), created_at: now() }).execute();
      await sendMail(db, body.email, "Reset your password",
        `Someone asked to reset your password. If it was you, open this link within 2 hours:\n\n${appUrl(c)}/reset-password?token=${token}\n`);
    }
    return c.json({ ok: true, mailEnabled: mailOn });
  })

  .post("/password/reset", async (c) => {
    const db = c.get("db");
    const body = z.object({ token: z.string(), password }).parse(await c.req.json());
    const reset = await db.selectFrom("password_resets").selectAll()
      .where("token_hash", "=", hashToken(body.token))
      .where("used_at", "is", null)
      .where("expires_at", ">", now())
      .executeTakeFirst();
    if (!reset) throw new HTTPException(400, { message: "This reset link has expired or was already used" });
    await db.transaction().execute(async (trx) => {
      await trx.updateTable("password_resets").set({ used_at: now() }).where("token_hash", "=", reset.token_hash).execute();
      await trx.updateTable("users").set({ password_hash: await hashPassword(body.password), updated_at: now() })
        .where("id", "=", reset.user_id).execute();
      await trx.deleteFrom("sessions").where("user_id", "=", reset.user_id).execute();
    });
    await startSession(c, db, reset.user_id);
    return c.json({ ok: true });
  })

  // Invite landing page: look up who the invite is for.
  .get("/invitations/:token", async (c) => {
    const invite = await c.get("db").selectFrom("invitations").select(["email", "message"])
      .where("token_hash", "=", hashToken(c.req.param("token")))
      .where("accepted_at", "is", null)
      .where("expires_at", ">", now())
      .executeTakeFirst();
    if (!invite) throw new HTTPException(404, { message: "This invite has expired or was already used" });
    return c.json(invite);
  })

  .post("/invitations/accept", async (c) => {
    const db = c.get("db");
    const id = await acceptInvite(db, acceptSchema.parse(await c.req.json()));
    await startSession(c, db, id);
    return c.json({ ok: true });
  });

function sameSecret(given: string, expected: string) {
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
