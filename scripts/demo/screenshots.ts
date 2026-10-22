// Takes the README screenshots from a freshly seeded demo site.
//
//   npm run build
//   npx playwright install chromium   # once
//   npm run screenshots
//
// It starts the server on a throwaway copy of the demo data, signs in as
// different demo members, and writes PNGs to docs/screenshots.

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright";

const PORT = Number(process.env.SCREENSHOT_PORT ?? 3123);
const BASE = `http://localhost:${PORT}`;
const OUT = path.resolve("docs/screenshots");
const PASSWORD = "northern-lights";

if (!fs.existsSync("dist/client/index.html")) {
  console.error("Build the app first: npm run build");
  process.exit(1);
}

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "nl-demo-"));
// Ignore any local .env and database settings: always a fresh SQLite demo.
const env: NodeJS.ProcessEnv = { ...process.env, DATA_DIR: dataDir, PORT: String(PORT), ENV_FILE: path.join(dataDir, "none.env") };
for (const key of ["DATABASE_URL", "APP_URL", "STORAGE", "UPLOADS_DIR", "SMTP_URL"]) delete env[key];
const server = spawn(process.execPath, ["--import", "tsx", "scripts/demo/seed.ts", "--serve"], {
  env, stdio: ["ignore", "inherit", "inherit"],
});

async function waitForServer() {
  for (let i = 0; i < 600; i++) {
    try {
      if ((await fetch(`${BASE}/api/auth/session`)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("The demo server didn't start");
}

async function settle(page: Page) {
  // Not "networkidle": the members' area keeps a live-updates connection open.
  await page.waitForLoadState("load");
  await page.waitForTimeout(800);
  await page.evaluate(() => Promise.all([...document.images].map((img) => img.complete || img.decode().catch(() => undefined))));
  await page.waitForTimeout(300);
}

async function shot(page: Page, name: string, opts: { fullPage?: boolean } = {}) {
  await settle(page);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: opts.fullPage });
  console.log(`  docs/screenshots/${name}.png`);
}

async function session(browser: Browser, email: string | null, opts: { mobile?: boolean; dark?: boolean } = {}) {
  const context = await browser.newContext({
    viewport: opts.mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
    deviceScaleFactor: opts.mobile ? 2 : 1,
    colorScheme: opts.dark ? "dark" : "light",
    baseURL: BASE,
  });
  // Keep the admin's getting-started card out of the way.
  await context.addInitScript(() => localStorage.setItem("nl-getting-started-dismissed", "1"));
  const page = await context.newPage();
  if (email) {
    const res = await page.request.post("/api/auth/login", { data: { email, password: PASSWORD } });
    if (!res.ok()) throw new Error(`Couldn't sign in as ${email}: ${await res.text()}`);
  }
  return page;
}

try {
  await waitForServer();
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

  // Visitors: the public home page and a public album.
  const visitor = await session(browser, null);
  await visitor.goto("/");
  await shot(visitor, "demo-home");
  await shot(visitor, "demo-home-full", { fullPage: true });
  await visitor.goto("/gallery");
  await visitor.getByText("Winter at the cabin").first().click();
  await shot(visitor, "demo-public-album");

  // A member: feed, messages, people, a profile, albums.
  const astrid = await session(browser, "astrid@example.com");
  await astrid.goto("/app");
  await shot(astrid, "demo-feed");
  await astrid.goto("/app/messages");
  await astrid.getByText("Maja Lund").first().click();
  await shot(astrid, "demo-messages");
  await astrid.goto("/app/albums");
  await shot(astrid, "demo-albums");
  await astrid.goto("/app/people");
  await astrid.getByText("Erik Halvorsen").first().click();
  await shot(astrid, "demo-profile");

  // The admin editing the home page, and the theme drawer.
  await astrid.goto("/");
  await settle(astrid);
  await astrid.getByRole("button", { name: "Edit page" }).click();
  await shot(astrid, "home-editing");
  await astrid.getByRole("button", { name: "Theme" }).click();
  await shot(astrid, "theme-panel");

  // A member who picked their own palette and dark mode.
  const nils = await session(browser, "nils@example.com");
  await nils.request.put("/api/me/preferences", { data: { preset: "fjord", mode: "dark" } });
  await nils.goto("/app");
  await shot(nils, "demo-feed-dark");
  await nils.goto("/app/settings");
  await shot(nils, "member-appearance-dark");

  // Phones.
  const phone = await session(browser, null, { mobile: true });
  await phone.goto("/");
  await shot(phone, "demo-home-mobile");
  const phoneMember = await session(browser, "maja@example.com", { mobile: true });
  await phoneMember.goto("/app");
  await shot(phoneMember, "demo-feed-mobile");

  await browser.close();
} finally {
  server.kill();
  fs.rmSync(dataDir, { recursive: true, force: true });
}
