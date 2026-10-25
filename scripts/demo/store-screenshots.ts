// Takes the App Store and Google Play screenshots of the phone app from two
// demo sites: the Halvorsen family and the Fjellvik Ski Club, which Nils
// belongs to both of.
//
//   npm run build:hub
//   npm run store:screenshots
//
// It starts a seeded server for each site, opens the app (dist/hub) as Nils,
// adds both sites the way a person would, and writes each screen at each
// store size (DEVICES) to packaging/appstore/screenshots/ and
// packaging/googleplay/images/, with Play's icon and feature graphic. The sites get made-up https addresses: the
// browser's requests to them are answered by the local servers.

import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Frame, type Page } from "playwright";

const HUB = path.resolve("dist/hub");
const APP = "https://app.northernlights.test";
const PASSWORD = "northern-lights";
const SITES = [
  { url: "https://halvorsens.example", port: 3131, variant: "family" },
  { url: "https://fjellvikski.example", port: 3132, variant: "club" },
];

/** Each store size: the CSS viewport, its pixel ratio, and the bars a phone draws over the app. */
const DEVICES = [
  { out: "packaging/appstore/screenshots/iphone", width: 440, height: 956, scale: 3, top: 62, bottom: 34, bar: "ios" },
  { out: "packaging/appstore/screenshots/ipad", width: 1032, height: 1376, scale: 2, top: 24, bottom: 20, bar: "ios" },
  { out: "packaging/googleplay/images/phone", width: 360, height: 720, scale: 3, top: 24, bottom: 16, bar: "android" },
  { out: "packaging/googleplay/images/tablet-7", width: 600, height: 960, scale: 2, top: 24, bottom: 16, bar: "android" },
  { out: "packaging/googleplay/images/tablet-10", width: 800, height: 1280, scale: 2, top: 24, bottom: 16, bar: "android" },
] as const;
type Device = (typeof DEVICES)[number];

if (!fs.existsSync(path.join(HUB, "index.html"))) {
  console.error("Build the app first: npm run build:hub");
  process.exit(1);
}

const servers: ChildProcess[] = [];
const dataDirs: string[] = [];

function startSite(site: (typeof SITES)[number]) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "nl-store-"));
  dataDirs.push(dataDir);
  const env: NodeJS.ProcessEnv = {
    ...process.env, DATA_DIR: dataDir, PORT: String(site.port), APP_URL: site.url,
    COOKIE_SECURE: "false", ENV_FILE: path.join(dataDir, "none.env"),
  };
  for (const key of ["DATABASE_URL", "STORAGE", "UPLOADS_DIR", "SMTP_URL", "DEMO_SITE"]) delete env[key];
  if (site.variant === "club") env.DEMO_SITE = "club";
  servers.push(spawn(process.execPath, ["--import", "tsx", "scripts/demo/seed.ts", "--serve"], {
    env, stdio: ["ignore", "inherit", "inherit"],
  }));
}

async function waitFor(url: string) {
  for (let i = 0; i < 600; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`${url} didn't start`);
}

const TYPES: Record<string, string> = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
  ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2",
};

/** The phone's status bar and home indicator around the app, which runs in a frame between them. */
function frame(device: Device, path: string, dark: boolean) {
  const ink = dark ? "#f8fafc" : "#0f172a";
  const bg = dark ? "#0b1220" : "#ffffff";
  const battery = `<svg width="27" height="13" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" fill="none" stroke="${ink}" opacity="0.4"/><rect x="2" y="2" width="20" height="9" rx="2" fill="${ink}"/><rect x="25" y="4.5" width="1.5" height="4" rx="0.75" fill="${ink}" opacity="0.4"/></svg>`;
  const signal = `<svg width="18" height="12" viewBox="0 0 18 12" fill="${ink}"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>`;
  const wifi = `<svg width="17" height="12" viewBox="0 0 17 12" fill="${ink}"><path d="M8.5 2.3c2.4 0 4.6.9 6.3 2.5l1.2-1.3C14 1.6 11.4.5 8.5.5S3 1.6 1 3.5l1.2 1.3C3.9 3.2 6.1 2.3 8.5 2.3z"/><path d="M8.5 5.6c1.5 0 2.9.6 3.9 1.5l1.2-1.3C12.3 4.5 10.5 3.8 8.5 3.8S4.7 4.5 3.4 5.8l1.2 1.3c1-.9 2.4-1.5 3.9-1.5z"/><path d="M8.5 8.9c.7 0 1.3.3 1.8.7l-1.8 2-1.8-2c.5-.4 1.1-.7 1.8-.7z"/></svg>`;
  const ios = device.bar === "ios";
  const status = ios
    ? `<span style="font-weight:600;font-size:${device.width > 600 ? 15 : 17}px">9:41</span><span style="display:flex;gap:6px;align-items:center">${signal}${wifi}${battery}</span>`
    : `<span style="font-size:14px">9:41</span><span style="display:flex;gap:6px;align-items:center">${wifi}${signal}${battery}</span>`;
  const pad = ios && device.width < 600 ? "0 34px 0 46px" : "0 18px";
  const indicator = ios
    ? `<div style="width:${device.width > 600 ? 320 : 140}px;height:5px;border-radius:3px;background:${ink}"></div>`
    : `<div style="width:108px;height:4px;border-radius:2px;background:${ink};opacity:0.5"></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
    html,body{margin:0;height:100%;background:${bg};color:${ink};font-family:-apple-system,"SF Pro Text",Roboto,system-ui,sans-serif}
    body{display:flex;flex-direction:column}
    .bar{flex:none;display:flex;align-items:${ios ? "flex-end" : "center"};justify-content:space-between;padding:${pad};box-sizing:border-box}
    iframe{flex:1;border:0;width:100%;display:block}
  </style></head><body>
    <div class="bar" style="height:${device.top}px;padding-bottom:${ios && device.width < 600 ? 16 : 0}px">${status}</div>
    <iframe src="${path}"></iframe>
    <div class="bar" style="height:${device.bottom}px;justify-content:center;align-items:center;padding:0">${indicator}</div>
  </body></html>`;
}

async function serve(context: BrowserContext) {
  // The app's own files, with the single-page fallback, and the frame page.
  await context.route(`${APP}/**`, async (route) => {
    const url = new URL(route.request().url());
    let file = path.join(HUB, decodeURIComponent(url.pathname));
    if (!file.startsWith(HUB) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(HUB, "index.html");
    await route.fulfill({ body: fs.readFileSync(file), contentType: TYPES[path.extname(file)] ?? "application/octet-stream" });
  });
  // Each made-up site address goes to its local server.
  for (const site of SITES) {
    await context.route(`${site.url}/**`, async (route) => {
      const url = route.request().url().replace(site.url, `http://localhost:${site.port}`);
      // Live updates stream forever, and a screenshot doesn't need them. Opening
      // a conversation mustn't mark it read, or later screens lose their badges.
      const { pathname } = new URL(url);
      if (pathname === "/api/events" || pathname === "/api/messages/read") return route.abort();
      await route.fulfill({ response: await route.fetch({ url, maxRedirects: 0 }) }).catch(() => undefined);
    });
  }
}

async function settle(page: Page) {
  await page.waitForLoadState("load");
  await page.waitForTimeout(1000);
  for (const f of page.frames()) {
    await f.evaluate(() => Promise.all([...document.images].map((img) => img.complete || Promise.race([
      img.decode().catch(() => undefined),
      new Promise((r) => setTimeout(r, 3000)),
    ])))).catch(() => undefined);
  }
  await page.waitForTimeout(300);
}

/** The screens, in store order: the app opened at `path`, then `act` in it. */
const SCREENS: { name: string; path: string; dark?: boolean; act?: (app: Frame) => Promise<unknown> }[] = [
  { name: "01-feed", path: "/" },
  {
    name: "02-comments", path: "/",
    act: async (app) => {
      await app.getByRole("button", { name: "3", exact: true }).first().click();
      await app.getByText("Put some boots on").waitFor();
      // The post's text at the top, under the app's header, so its comments show.
      await app.getByText("Stepped outside").evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 140));
    },
  },
  { name: "03-messages", path: "/messages" },
  { name: "04-conversation", path: "/messages", act: (app) => app.getByText("Ingrid Moe").first().click() },
  { name: "05-sites", path: "/sites" },
  { name: "06-add-a-site", path: "/add" },
  { name: "07-feed-dark", path: "/", dark: true },
];

async function signIn(context: BrowserContext) {
  // Add both sites as Nils, through the app's own Add a site page.
  const page = await context.newPage();
  await page.goto(`${APP}/add`);
  for (const site of SITES) {
    await page.goto(`${APP}/add`);
    await page.getByPlaceholder("family.example.org").fill(new URL(site.url).host);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByPlaceholder("Email").fill("nils@example.com");
    await page.getByPlaceholder("Password").fill(PASSWORD);
    await page.getByRole("button", { name: /^Sign in to / }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/add"), { timeout: 20_000 }).catch(async (err) => {
      await page.screenshot({ path: "/tmp/claude-0/signin.png" });
      throw err;
    });
  }
  const sites = await page.evaluate(() => localStorage.getItem("nl-hub-sites"));
  await page.close();
  return sites!;
}

/** Play's 512 px icon and 1024x500 feature graphic, drawn from mobile/assets/icon-only.png. */
async function storeArt(browser: Browser) {
  const icon = `data:image/png;base64,${fs.readFileSync("mobile/assets/icon-only.png").toString("base64")}`;
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
  await page.setContent(`<body style="margin:0"><img src="${icon}" style="width:512px;height:512px;display:block">`);
  await page.screenshot({ path: "packaging/googleplay/images/icon.png" });
  await page.setViewportSize({ width: 1024, height: 500 });
  await page.setContent(`<body style="margin:0;width:1024px;height:500px;overflow:hidden;font-family:Inter,Roboto,system-ui,sans-serif;
      background:radial-gradient(ellipse 70% 60% at 70% 20%,rgba(60,240,160,.45),transparent 70%),
        radial-gradient(ellipse 50% 50% at 95% 40%,rgba(139,92,246,.5),transparent 70%),linear-gradient(#050b1f,#123047);
      color:#f8fafc;display:flex;align-items:center;gap:44px;padding:0 80px;box-sizing:border-box">
    <img src="${icon}" style="width:200px;height:200px;border-radius:44px;box-shadow:0 20px 60px rgba(0,0,0,.45)">
    <div><div style="font-size:64px;font-weight:700;letter-spacing:-1px">Northern Lights</div>
    <div style="font-size:30px;opacity:.85;margin-top:12px;line-height:1.3">Your family and groups,<br>in one feed and one inbox.</div></div>`);
  await page.screenshot({ path: "packaging/googleplay/images/feature-graphic.png" });
  await page.close();
  console.log("  packaging/googleplay/images/icon.png, feature-graphic.png");
}

try {
  SITES.forEach(startSite);
  await Promise.all(SITES.map((s) => waitFor(`http://localhost:${s.port}/.well-known/northern-lights`)));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  fs.mkdirSync("packaging/googleplay/images", { recursive: true });
  await storeArt(browser);

  // Signed in once: the sites limit how often someone can sign in.
  let stored: string | null = null;
  for (const device of DEVICES) {
    fs.rmSync(device.out, { recursive: true, force: true });
    const dir = device.out.includes("appstore") ? path.join(device.out, `${device.width * device.scale}x${device.height * device.scale}`) : device.out;
    fs.mkdirSync(dir, { recursive: true });
    for (const screen of SCREENS) {
      const context = await browser.newContext({
        viewport: { width: device.width, height: device.height },
        deviceScaleFactor: device.scale,
        isMobile: device.width < 700,
        hasTouch: true,
        colorScheme: screen.dark ? "dark" : "light",
      });
      await serve(context);
      stored ??= await signIn(context);
      const saved = stored;
      await context.addInitScript((value) => localStorage.setItem("nl-hub-sites", value), saved);
      await context.route(`${APP}/__frame`, (route) =>
        route.fulfill({ body: frame(device, screen.path, !!screen.dark), contentType: "text/html" }));
      const page = await context.newPage();
      await page.goto(`${APP}/__frame`);
      await settle(page);
      if (screen.act) {
        await screen.act(page.frames()[1]);
        await settle(page);
      }
      const file = path.join(dir, `${screen.name}.png`);
      await page.screenshot({ path: file });
      console.log(`  ${file}`);
      await context.close();
    }
  }
  await browser.close();
} finally {
  servers.forEach((s) => s.kill());
  dataDirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true }));
}
