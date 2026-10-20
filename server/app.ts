import fs from "node:fs";
import path from "node:path";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { serveStatic } from "@hono/node-server/serve-static";
import { ZodError } from "zod";
import { loadUser, sameOrigin, type AppEnv } from "./auth.js";
import { config } from "./config.js";
import type { DB } from "./db/index.js";
import type { Storage } from "./storage.js";
import { adminRoutes } from "./routes/admin.js";
import { albumRoutes } from "./routes/albums.js";
import { authRoutes } from "./routes/auth.js";
import { fileRoutes, uploadRoutes } from "./routes/files.js";
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

  app.use("*", loadUser(db));

  const api = new Hono<AppEnv>()
    .use(sameOrigin)
    .route("/auth", authRoutes)
    .route("/public", publicRoutes)
    .route("/admin", adminRoutes)
    .route("/", inviteRoutes)
    .route("/", messageRoutes)
    .route("/", liveRoutes)
    .route("/", uploadRoutes(storage))
    .route("/", albumRoutes(storage))
    .route("/", socialRoutes);
  api.notFound((c) => c.json({ error: "Not found" }, 404));

  app.route("/api", api);
  app.route("/files", fileRoutes(storage));

  if (opts.serveClient && fs.existsSync(config.clientDir)) {
    const root = path.relative(process.cwd(), config.clientDir);
    app.use("/*", serveStatic({ root }));
    const index = fs.readFileSync(path.join(config.clientDir, "index.html"), "utf8");
    app.get("*", (c) => c.html(index)); // single-page app fallback
  }

  return app;
}
