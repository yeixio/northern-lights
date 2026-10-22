import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { openDatabase } from "./db/index.js";
import { mailSource } from "./mail.js";
import { createStorage } from "./storage.js";

const db = await openDatabase(config.databaseUrl);
const storage = createStorage();
const app = createApp(db, storage, { serveClient: true });

const kind = config.databaseUrl.startsWith("postgres") ? "Postgres" : "SQLite";
const mail = { env: "on (SMTP_URL)", site: "on (Site settings)", off: "off (invite links are shown instead)" }[await mailSource(db)];
serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (info) => {
  console.log(`Northern Lights listening on http://localhost:${info.port}`);
  console.log(`  database: ${kind}   storage: ${config.storage.driver}   email: ${mail}`);
});

const shutdown = async () => {
  await db.destroy();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
