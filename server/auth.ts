import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { config } from "./config.js";
import { newId, now, type DB } from "./db/index.js";
import type { User } from "./db/schema.js";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
export const SESSION_COOKIE = "nl_session";

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scryptAsync(password, Buffer.from(salt, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

/** A random URL-safe token and the hash we store for it. */
export function newToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

const addDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

export async function startSession(c: Context, db: DB, userId: string) {
  const { token, hash } = newToken();
  const expires = addDays(config.sessionDays);
  await db.insertInto("sessions").values({ id: hash, user_id: userId, expires_at: expires, created_at: now() }).execute();
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: config.cookieSecure,
    path: "/",
    expires: new Date(expires),
  });
}

export async function endSession(c: Context, db: DB) {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await db.deleteFrom("sessions").where("id", "=", hashToken(token)).execute();
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

export async function userFromRequest(c: Context, db: DB): Promise<User | null> {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;
  const row = await db
    .selectFrom("sessions")
    .innerJoin("users", "users.id", "sessions.user_id")
    .selectAll("users")
    .where("sessions.id", "=", hashToken(token))
    .where("sessions.expires_at", ">", now())
    .where("users.is_active", "=", 1)
    .executeTakeFirst();
  return row ?? null;
}

export type AppEnv = { Variables: { user: User | null; db: DB } };

export const loadUser = (db: DB): MiddlewareHandler<AppEnv> => async (c, next) => {
  c.set("db", db);
  c.set("user", await userFromRequest(c, db));
  await next();
};

/** Rejects cross-site writes: browsers always send Origin on POST/PATCH/DELETE. */
export const sameOrigin: MiddlewareHandler = async (c, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
    const origin = c.req.header("origin");
    const host = c.req.header("x-forwarded-host") ?? c.req.header("host");
    if (origin && host && new URL(origin).host !== host) {
      throw new HTTPException(403, { message: "Cross-site request blocked" });
    }
  }
  await next();
};

export function requireUser(c: Context<AppEnv>): User {
  const user = c.get("user");
  if (!user) throw new HTTPException(401, { message: "Please sign in" });
  return user;
}

export function requireAdmin(c: Context<AppEnv>): User {
  const user = requireUser(c);
  if (!user.is_admin) throw new HTTPException(403, { message: "Admins only" });
  return user;
}

export const inviteExpiry = () => addDays(config.inviteDays);
export const resetExpiry = () => new Date(Date.now() + 2 * 3_600_000).toISOString();
export { newId };

/** Tiny in-memory limiter for login and password-reset attempts. */
const attempts = new Map<string, { count: number; until: number }>();
export function rateLimit(key: string, max = 10, windowMs = 15 * 60_000) {
  const t = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.until < t) {
    attempts.set(key, { count: 1, until: t + windowMs });
    return;
  }
  entry.count++;
  if (entry.count > max) throw new HTTPException(429, { message: "Too many attempts. Try again later." });
}
