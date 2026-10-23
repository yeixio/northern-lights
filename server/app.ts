import fs from "node:fs";
import path from "node:path";
import { Hono, type Context, type MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { serveStatic } from "@hono/node-server/serve-static";
import { ZodError } from "zod";
import { loadUser, sameOrigin, type AppEnv } from "./auth.js";
import { config } from "./config.js";
import type { DB } from "./db/index.js";
import type { Storage } from "./storage.js";
import { appUrl } from "./url.js";
import { signFileUrls } from "./signing.js";
import { adminRoutes } from "./routes/admin.js";
import { appRoutes, instanceInfo } from "./routes/app.js";
import { albumRoutes } from "./routes/albums.js";
import { authRoutes } from "./routes/auth.js";
import { fileRoutes, uploadRoutes } from "./routes/files.js";
import { importRoutes } from "./routes/imports.js";
import { inviteRoutes } from "./routes/invites.js";
import { liveRoutes } from "./routes/live.js";
import { messageRoutes } from "./routes/messages.js";
import { publicRoutes } from "./routes/public.js";
import { socialRoutes } from "./routes/social.js";

export function createApp(db: DB, storage: Storage, opts: { serveClient?: boolean } = {}) {
  const app = new Hono<AppEnv>();

  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    if (err instanceof ZodError) {
      const issue = err.issues[0];
      return c.json({ error: `${issue.path.join(".") || "input"}: ${issue.message}` }, 400);
    }
    console.error(err);
    return c.json({ error: "Something went wrong" }, 500);
  });

  // The Northern Lights app runs on its own origin and signs in with a bearer
  // token, so it may call the API from anywhere. No credentials are allowed
  // cross-site, so a browser's cookie is never used by another site.
  const appCors = cors({
    origin: "*",
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    maxAge: 86_400,
  });
  app.use("/api/*", appCors);
  app.use("/files/*", appCors);
  app.use("/.well-known/*", appCors);

  app.use("*", loadUser(db));

  app.get("/.well-known/northern-lights", async (c) => c.json(await instanceInfo(c)));

  const api = new Hono<AppEnv>()
    .use(sameOrigin)
    .use(signFilesForApp)
    .route("/auth", authRoutes)
    .route("/public", publicRoutes)
    .route("/admin", adminRoutes)
    .route("/", appRoutes)
    .route("/", inviteRoutes)
    .route("/", messageRoutes)
    .route("/", liveRoutes)
    .route("/", uploadRoutes(storage))
    .route("/", albumRoutes(storage))
    .route("/", importRoutes(storage))
    .route("/", socialRoutes);
  api.notFound((c) => c.json({ error: "Not found" }, 404));

  app.route("/api", api);
  app.route("/files", fileRoutes(storage));

  if (opts.serveClient && fs.existsSync(config.clientDir)) {
    const index = fs.readFileSync(path.join(config.clientDir, "index.html"), "utf8");
    // Every page is the same app, with the site's name, description and logo
    // filled in so browser tabs and link previews in chat apps show them.
    const page = async (c: Context<AppEnv>) => {
      const site = await db.selectFrom("site_settings").select(["site_name", "tagline", "logo_url"]).executeTakeFirst();
      return c.html(withSiteMeta(index, site, appUrl(c)));
    };
    app.get("/", page);
    app.get("/index.html", page);
    app.use("/*", serveStatic({ root: config.clientDir }));
    app.get("*", page); // single-page app fallback
  }

  return app;
}

/** The app gets signed links to private photos, since its <img> tags can't send its token. */
const signFilesForApp: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  if (!c.get("viaDevice") || !c.res.headers.get("content-type")?.includes("application/json")) return;
  const { status, headers } = c.res;
  headers.delete("content-length");
  const body = await signFileUrls(c.get("db"), await c.res.json());
  c.res = undefined;
  c.res = new Response(JSON.stringify(body), { status, headers });
};

const escape = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

export function withSiteMeta(html: string, site: { site_name: string; tagline: string | null; logo_url: string | null } | undefined, origin: string) {
  if (!site) return html;
  const name = escape(site.site_name);
  const tags = [
    `<title>${name}</title>`,
    `<meta property="og:title" content="${name}" />`,
    `<meta property="og:site_name" content="${name}" />`,
    `<meta property="og:type" content="website" />`,
  ];
  if (site.tagline) {
    tags.push(`<meta name="description" content="${escape(site.tagline)}" />`, `<meta property="og:description" content="${escape(site.tagline)}" />`);
  }
  let out = html;
  if (site.logo_url) {
    tags.push(`<meta property="og:image" content="${escape(origin + site.logo_url)}" />`);
    out = out.replace(/<link rel="icon"[^>]*>/, `<link rel="icon" href="${escape(site.logo_url)}" />`);
  }
  return out.replace(/<title>.*?<\/title>/, () => tags.join("\n    "));
}
