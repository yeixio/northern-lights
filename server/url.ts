import type { Context } from "hono";
import { config } from "./config.js";

/** Base URL for links in emails and invite links. */
export function appUrl(c: Context) {
  if (config.appUrl) return config.appUrl;
  const origin = c.req.header("origin");
  if (origin) return origin;
  const url = new URL(c.req.url);
  const proto = c.req.header("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = c.req.header("x-forwarded-host") ?? c.req.header("host") ?? url.host;
  return `${proto}://${host}`;
}
