import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { DB } from "./db/index.js";

// The app shows private photos with plain <img> tags, which can't send its
// bearer token. Responses to the app therefore carry signed links instead:
// /files/<key>?exp=<unix seconds>&sig=<hmac>. They expire at the end of the
// next UTC day, so a link stays the same all day and caches well.

const secrets = new WeakMap<DB, Promise<string>>();

function signingKey(db: DB) {
  let key = secrets.get(db);
  if (!key) {
    key = db.selectFrom("secrets").select("value").where("name", "=", "file_signing").executeTakeFirstOrThrow()
      .then((row) => row.value);
    secrets.set(db, key);
  }
  return key;
}

const sign = (secret: string, key: string, exp: number) =>
  createHmac("sha256", secret).update(`${key}:${exp}`).digest("base64url").slice(0, 32);

export async function signedFileUrl(db: DB, key: string, at = Date.now()) {
  const exp = (Math.floor(at / 86_400_000) + 2) * 86_400;
  return `/files/${key}?exp=${exp}&sig=${sign(await signingKey(db), key, exp)}`;
}

export async function validFileSignature(db: DB, key: string, exp: string | undefined, sig: string | undefined) {
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) * 1000 < Date.now()) return false;
  const expected = Buffer.from(sign(await signingKey(db), key, Number(exp)));
  const given = Buffer.from(sig);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const fileUrl = /^\/files\/([\w.-]+)$/;

/** Replaces every "/files/<key>" string in a JSON value with a signed link. */
export async function signFileUrls(db: DB, value: unknown): Promise<unknown> {
  if (typeof value === "string") {
    const key = fileUrl.exec(value)?.[1];
    return key ? signedFileUrl(db, key) : value;
  }
  if (Array.isArray(value)) return Promise.all(value.map((v) => signFileUrls(db, v)));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = await signFileUrls(db, v);
    return out;
  }
  return value;
}

/**
 * A "/files/<key>" link sent to the API. Signed links the app got back are
 * accepted too and stored without their signature.
 */
export const fileUrlSchema = z.string()
  .transform((s) => s.replace(/\?exp=\d+&sig=[\w-]+$/, ""))
  .pipe(z.string().regex(fileUrl, "Invalid file URL"));
