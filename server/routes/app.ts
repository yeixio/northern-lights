import { Hono, type Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { hashToken, newToken, requireUser, startDeviceSession, type AppEnv } from "../auth.js";
import { parseJson, type themeSchema } from "../appearance.js";
import { config } from "../config.js";
import { now, type DB } from "../db/index.js";
import { profile } from "../serialize.js";
import { signFileUrls } from "../signing.js";
import { appUrl } from "../url.js";
import { acceptInvite, acceptSchema, checkLogin, loginSchema } from "./auth.js";

// Routes for the Northern Lights app, which adds several sites and shows them
// together. The app signs in with a device token (Authorization: Bearer) and
// never gets a cookie. See docs/app-api.md.

/** Bump when the app-facing API changes in a way the app has to know about. */
export const APP_API_VERSION = 1;
const FEATURES = ["device-tokens", "pairing", "signed-files", "summary", "feed-cursor"];
const PAIRING_MINUTES = 5;

const deviceName = z.string().trim().min(1).max(100).default("Northern Lights app");

/** What the app shows about a site before and after signing in. */
export async function instanceInfo(c: Context<AppEnv>) {
  const s = await c.get("db").selectFrom("site_settings").select(["site_name", "tagline", "logo_url", "theme"])
    .executeTakeFirstOrThrow();
  const theme = parseJson<z.infer<typeof themeSchema>>(s.theme);
  const origin = appUrl(c);
  return {
    software: "northern-lights",
    api: APP_API_VERSION,
    features: FEATURES,
    url: origin,
    name: s.site_name,
    tagline: s.tagline,
    logo_url: s.logo_url ? origin + s.logo_url : null,
    theme: { preset: theme?.preset ?? "aurora", primary: theme?.primary ?? null },
  };
}

async function signedIn(c: Context<AppEnv>, userId: string, name: string) {
  const db = c.get("db");
  const token = await startDeviceSession(db, userId, name);
  const user = await db.selectFrom("users").selectAll().where("id", "=", userId).executeTakeFirstOrThrow();
  // Signed by hand: this request has no device token yet, so the app middleware doesn't sign it.
  return c.json(await signFileUrls(db, { token, user: profile(user), instance: await instanceInfo(c) }), 201);
}

async function devices(db: DB, userId: string, current: string | null) {
  const rows = await db.selectFrom("sessions").select(["id", "device_name", "created_at", "last_used_at"])
    .where("user_id", "=", userId).where("kind", "=", "device").where("expires_at", ">", now())
    .orderBy("last_used_at", "desc").execute();
  return rows.map((r) => ({ ...r, current: r.id === current }));
}

export const appRoutes = new Hono<AppEnv>()
  // ---- signing the app in --------------------------------------------------

  // The website asks for a one-time code and shows it as a QR code.
  .post("/app/pairing", async (c) => {
    const user = requireUser(c);
    const db = c.get("db");
    await db.deleteFrom("pairing_codes").where("expires_at", "<", now()).execute();
    const { token: code, hash } = newToken();
    const expires = new Date(Date.now() + PAIRING_MINUTES * 60_000).toISOString();
    await db.insertInto("pairing_codes").values({ code_hash: hash, user_id: user.id, expires_at: expires, created_at: now() }).execute();
    const instance = appUrl(c);
    const link = `${config.appLinkUrl}#instance=${encodeURIComponent(instance)}&code=${code}`;
    return c.json({ code, link, instance, expires_at: expires }, 201);
  })

  // The app trades the scanned code for a device token. Each code works once.
  .post("/app/pair", async (c) => {
    const body = z.object({ code: z.string().min(1).max(200), device_name: deviceName }).parse(await c.req.json());
    const db = c.get("db");
    const hash = hashToken(body.code);
    const row = await db.selectFrom("pairing_codes").innerJoin("users", "users.id", "pairing_codes.user_id")
      .select(["pairing_codes.user_id", "pairing_codes.expires_at", "users.is_active"])
      .where("pairing_codes.code_hash", "=", hash).executeTakeFirst();
    await db.deleteFrom("pairing_codes").where("code_hash", "=", hash).execute();
    if (!row || row.expires_at < now() || !row.is_active) {
      throw new HTTPException(400, { message: "This code has expired. Show a new one on the website." });
    }
    return signedIn(c, row.user_id, body.device_name);
  })

  .post("/app/login", async (c) => {
    const body = loginSchema.extend({ device_name: deviceName }).parse(await c.req.json());
    const user = await checkLogin(c.get("db"), body);
    return signedIn(c, user.id, body.device_name);
  })

  .post("/app/invitations/accept", async (c) => {
    const body = acceptSchema.extend({ device_name: deviceName }).parse(await c.req.json());
    const id = await acceptInvite(c.get("db"), body);
    return signedIn(c, id, body.device_name);
  })

  // ---- signed in ------------------------------------------------------------

  // Badge counts for the app, cheap enough to ask every instance often.
  .get("/app/summary", async (c) => {
    const user = requireUser(c);
    const db = c.get("db");
    const since = z.iso.datetime().optional().parse(c.req.query("since"))
      ?? new Date(Date.now() - 7 * 86_400_000).toISOString();
    const count = (n: { n: number | string | bigint } | undefined) => Number(n?.n ?? 0);
    const unread = await db.selectFrom("messages").select((eb) => eb.fn.countAll<number>().as("n"))
      .where("recipient_id", "=", user.id).where("read", "=", 0).executeTakeFirst();
    const posts = await db.selectFrom("posts").select((eb) => eb.fn.countAll<number>().as("n"))
      .where("user_id", "!=", user.id).where("created_at", ">", since).executeTakeFirst();
    const comments = await db.selectFrom("comments").innerJoin("posts", "posts.id", "comments.post_id")
      .select((eb) => eb.fn.countAll<number>().as("n"))
      .where("posts.user_id", "=", user.id).where("comments.user_id", "!=", user.id)
      .where("comments.created_at", ">", since).executeTakeFirst();
    const likes = await db.selectFrom("reactions").innerJoin("posts", "posts.id", "reactions.post_id")
      .select((eb) => eb.fn.countAll<number>().as("n"))
      .where("posts.user_id", "=", user.id).where("reactions.user_id", "!=", user.id)
      .where("reactions.created_at", ">", since).executeTakeFirst();
    return c.json({
      since,
      // The person's own profile, so the app's copy (and its signed photo link) stays current.
      user: profile(user),
      unread_messages: count(unread),
      new_posts: count(posts),
      new_comments_on_my_posts: count(comments),
      new_likes_on_my_posts: count(likes),
    });
  })

  // "Your devices": every app signed in to this account, with a way to remove one.
  .get("/me/devices", async (c) => {
    const user = requireUser(c);
    return c.json(await devices(c.get("db"), user.id, c.get("sessionId")));
  })

  .delete("/me/devices/:id", async (c) => {
    const user = requireUser(c);
    const res = await c.get("db").deleteFrom("sessions")
      .where("id", "=", c.req.param("id")).where("user_id", "=", user.id).where("kind", "=", "device")
      .executeTakeFirst();
    if (!Number(res.numDeletedRows)) throw new HTTPException(404, { message: "Device not found" });
    return c.json({ ok: true });
  });
