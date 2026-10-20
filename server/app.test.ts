// End-to-end API tests. Runs against in-memory SQLite by default; set
// TEST_DATABASE_URL=postgres://... to run the same suite on Postgres.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nl-test-"));
process.env.UPLOADS_DIR = path.join(tmp, "uploads");

const { openDatabase } = await import("./db/index.js");
const { createStorage } = await import("./storage.js");
const { createApp } = await import("./app.js");
// The Facebook importer runs in the browser; these tests drive it against the API.
const { buildPlan } = await import("../src/lib/facebook.js");
const { runImport } = await import("../src/lib/importer.js");
const { readZip } = await import("../src/lib/zip.js");
const { facebookExport } = await import("../src/lib/fixtures/facebookExport.js");

const db = await openDatabase(process.env.TEST_DATABASE_URL ?? "sqlite::memory:");
const app = createApp(db, createStorage());

/** A browser-like client that keeps its session cookie. */
function client() {
  let cookie = "";
  async function call(method: string, url: string, body?: unknown, headers: Record<string, string> = {}) {
    const init: RequestInit = { method, headers: { cookie, ...headers } };
    if (body instanceof FormData) init.body = body;
    else if (body !== undefined) {
      init.body = JSON.stringify(body);
      (init.headers as Record<string, string>)["content-type"] = "application/json";
    }
    const res = await app.request(url, init);
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const type = res.headers.get("content-type") ?? "";
    const data = type.includes("json") ? await res.json() : await res.arrayBuffer();
    return { status: res.status, data: data as any };
  }
  return {
    cookie: () => cookie,
    get: (u: string) => call("GET", u),
    post: (u: string, b?: unknown, h?: Record<string, string>) => call("POST", u, b, h),
    patch: (u: string, b?: unknown) => call("PATCH", u, b),
    put: (u: string, b?: unknown) => call("PUT", u, b),
    del: (u: string) => call("DELETE", u),
  };
}

const admin = client();
const friend = client();
const anon = client();
const stranger = client();
let friendId = "";

before(async () => {
  // Start from an empty database when reusing a Postgres test db.
  for (const t of ["imports", "media", "albums", "messages", "reactions", "comments", "posts", "files",
    "password_resets", "invitations", "sessions", "users"] as const) {
    await db.deleteFrom(t).execute();
  }
});
after(async () => {
  await db.destroy();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("setup and invites", () => {
  test("first run asks for setup and creates the admin", async () => {
    assert.equal((await anon.get("/api/auth/session")).data.needsSetup, true);
    const r = await admin.post("/api/auth/setup", { email: "Admin@Example.com", password: "correct horse", first_name: "Ada", last_name: "Admin" });
    assert.equal(r.status, 200);
    const s = await admin.get("/api/auth/session");
    assert.equal(s.data.user.email, "admin@example.com");
    assert.equal(s.data.user.is_admin, true);
    assert.equal((await stranger.post("/api/auth/setup", { email: "x@example.com", password: "password1", first_name: "X", last_name: "Y" })).status, 409);
  });

  test("anonymous users cannot reach the private API", async () => {
    assert.equal((await anon.get("/api/posts")).status, 401);
    assert.equal((await anon.get("/api/people")).status, 401);
    assert.equal((await anon.post("/api/invitations", { email: "a@b.co" })).status, 401);
  });

  test("an invited friend can join with the link", async () => {
    const inv = await admin.post("/api/invitations", { email: "friend@example.com", message: "Join us" });
    assert.equal(inv.status, 201);
    assert.equal(inv.data.emailed, false);
    const token = new URL(inv.data.link).searchParams.get("token")!;
    assert.equal((await anon.get(`/api/auth/invitations/${token}`)).data.email, "friend@example.com");
    const join = await friend.post("/api/auth/invitations/accept", { token, password: "friendpass", first_name: "Fran", last_name: "Friend" });
    assert.equal(join.status, 200);
    const me = (await friend.get("/api/auth/session")).data.user;
    assert.equal(me.is_admin, false);
    friendId = me.id;
    // The link only works once.
    assert.equal((await stranger.post("/api/auth/invitations/accept", { token, password: "whatever1", first_name: "S", last_name: "S" })).status, 400);
  });

  test("login checks the password", async () => {
    assert.equal((await stranger.post("/api/auth/login", { email: "friend@example.com", password: "nope" })).status, 401);
    const c = client();
    assert.equal((await c.post("/api/auth/login", { email: "FRIEND@example.com", password: "friendpass" })).status, 200);
    assert.equal((await c.post("/api/auth/logout")).status, 200);
    assert.equal((await c.get("/api/posts")).status, 401);
  });

  test("cross-site writes are refused", async () => {
    const r = await friend.post("/api/posts", { content: "x" }, { origin: "https://evil.example", host: "localhost" });
    assert.equal(r.status, 403);
  });
});

describe("feed", () => {
  let postId = "";

  test("members post, like and comment", async () => {
    const p = await friend.post("/api/posts", { content: "Hello family" });
    assert.equal(p.status, 201);
    postId = p.data.id;
    await admin.post(`/api/posts/${postId}/like`);
    await admin.post(`/api/posts/${postId}/like`); // idempotent
    await admin.post(`/api/posts/${postId}/comments`, { content: "Welcome!" });
    const feed = (await friend.get("/api/posts")).data;
    assert.equal(feed[0].content, "Hello family");
    assert.equal(feed[0].like_count, 1);
    assert.equal(feed[0].comment_count, 1);
    assert.equal(feed[0].liked, false);
    assert.equal(feed[0].author.first_name, "Fran");
    assert.equal((await admin.get("/api/posts")).data[0].liked, true);
    const comments = (await friend.get(`/api/posts/${postId}/comments`)).data;
    assert.equal(comments[0].author.first_name, "Ada");
  });

  test("only the author or an admin can delete a post", async () => {
    const own = await admin.post("/api/posts", { content: "admin post" });
    assert.equal((await friend.del(`/api/posts/${own.data.id}`)).status, 403);
    assert.equal((await admin.del(`/api/posts/${postId}`)).status, 200);
    assert.equal((await admin.del(`/api/posts/${own.data.id}`)).status, 200);
  });

  test("public posts show on the public page, private ones don't", async () => {
    await friend.post("/api/posts", { content: "secret" });
    await friend.post("/api/posts", { content: "for everyone", is_public: true });
    const pub = (await anon.get("/api/public/posts")).data;
    assert.deepEqual(pub.map((p: any) => p.content), ["for everyone"]);
    assert.equal(pub[0].author, undefined);
  });
});

describe("messages", () => {
  test("only the two people in a conversation see it", async () => {
    const adminId = (await admin.get("/api/auth/session")).data.user.id;
    await friend.post("/api/messages", { recipient_id: adminId, content: "hi admin" });
    const inbox = (await admin.get("/api/messages")).data;
    assert.equal(inbox.length, 1);
    assert.equal(inbox[0].read, false);
    await admin.post("/api/messages/read", { ids: [inbox[0].id] });
    assert.equal((await friend.get("/api/messages")).data[0].read, true);

    const third = client();
    const inv = await admin.post("/api/invitations", { email: "third@example.com" });
    await third.post("/api/auth/invitations/accept", {
      token: new URL(inv.data.link).searchParams.get("token"), password: "thirdpass", first_name: "T", last_name: "Third",
    });
    assert.equal((await third.get("/api/messages")).data.length, 0);
  });
});

describe("albums and files", () => {
  test("uploads are private until used on the public page", async () => {
    const form = new FormData();
    form.append("file", new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "a.jpg", { type: "image/jpeg" }));
    const up = await friend.post("/api/uploads", form);
    assert.equal(up.status, 201);
    const url = up.data[0].url as string;

    assert.equal((await friend.get(url)).status, 200);
    assert.equal((await anon.get(url)).status, 404);

    const album = await friend.post("/api/albums", { title: "Summer" });
    await friend.post(`/api/albums/${album.data.id}/media`, { items: [{ url, type: "image" }] });
    assert.equal((await friend.get(`/api/albums/${album.data.id}`)).data.cover_url, url);
    assert.equal((await anon.get(`/api/public/albums/${album.data.id}`)).status, 404);

    await friend.patch(`/api/albums/${album.data.id}`, { is_public: true });
    assert.equal((await anon.get(`/api/public/albums/${album.data.id}`)).data.media.length, 1);
    assert.equal((await anon.get(url)).status, 200);
  });

  test("rejects files that aren't photos or videos", async () => {
    const form = new FormData();
    form.append("file", new File(["<svg onload=alert(1)>"], "x.svg", { type: "image/svg+xml" }));
    assert.equal((await friend.post("/api/uploads", form)).status, 415);
  });
});

describe("admin", () => {
  test("site settings are admin-only and public to read", async () => {
    assert.equal((await friend.put("/api/admin/site", { site_name: "Hacked" })).status, 403);
    assert.equal((await admin.put("/api/admin/site", { site_name: "The Smiths", tagline: "Hi" })).status, 200);
    assert.equal((await anon.get("/api/public/site")).data.site_name, "The Smiths");
  });

  test("members cannot promote themselves", async () => {
    assert.equal((await friend.patch(`/api/admin/members/${friendId}`, { is_admin: true })).status, 403);
    const me = await friend.patch("/api/me", { bio: "hello", is_admin: true } as any);
    assert.equal(me.data.bio, "hello");
    assert.equal(me.data.is_admin, false);
  });

  test("suspending a member signs them out", async () => {
    await admin.patch(`/api/admin/members/${friendId}`, { is_active: false });
    assert.equal((await friend.get("/api/posts")).status, 401);
    assert.equal((await client().post("/api/auth/login", { email: "friend@example.com", password: "friendpass" })).status, 403);
    await admin.patch(`/api/admin/members/${friendId}`, { is_active: true });
  });

  test("admin reset links work once", async () => {
    const r = await admin.post(`/api/admin/members/${friendId}/reset-link`);
    const token = new URL(r.data.link).searchParams.get("token");
    const c = client();
    assert.equal((await c.post("/api/auth/password/reset", { token, password: "newpassword" })).status, 200);
    assert.equal((await c.get("/api/posts")).status, 200);
    assert.equal((await client().post("/api/auth/password/reset", { token, password: "again12345" })).status, 400);
    assert.equal((await client().post("/api/auth/login", { email: "friend@example.com", password: "newpassword" })).status, 200);
  });
});

describe("Facebook import", () => {
  const realFetch = globalThis.fetch;

  /** Run the browser-side importer against this server, signed in as `who`. */
  async function importAs(who: ReturnType<typeof client>) {
    globalThis.fetch = ((url: string, init: RequestInit = {}) =>
      app.request(url, { ...init, headers: { ...(init.headers as Record<string, string>), cookie: who.cookie() } })) as typeof fetch;
    try {
      const plan = await buildPlan((await Promise.all(facebookExport().map(readZip))).flat());
      return await runImport(plan, { posts: true, signal: new AbortController().signal, onProgress: () => undefined });
    } finally {
      globalThis.fetch = realFetch;
    }
  }
  const fileCount = async () => (await db.selectFrom("files").select((eb) => eb.fn.countAll<number>().as("n")).executeTakeFirstOrThrow()).n;

  test("imports photos into members-only albums, with captions and dates", async () => {
    const result = await importAs(admin);
    assert.equal(result.total, 5);
    assert.equal(result.done, 5);
    assert.deepEqual(result.skipped, []);
    assert.equal(result.albums, 4);
    assert.equal(result.posts, 2);

    const albums = (await admin.get("/api/albums")).data.filter((a: any) => /Facebook|Café/.test(a.title));
    assert.equal(albums.length, 4);
    assert.ok(albums.every((a: any) => a.is_public === false));
    const summer = (await admin.get(`/api/albums/${albums.find((a: any) => a.title === "Café summer").id}`)).data;
    assert.equal(summer.description, "Lake days");
    assert.deepEqual(summer.media.map((m: any) => m.caption), ["Sunset 🌅", "Second"]);
    assert.equal(summer.media[0].created_at, new Date(1719000000_000).toISOString());
    assert.equal(summer.cover_url, summer.media[0].url);
    assert.equal((await admin.get(summer.media[0].url)).status, 200);
    assert.equal((await anon.get(summer.media[0].url)).status, 404);

    const post = (await admin.get("/api/posts")).data.find((p: any) => p.content === "At the lake");
    assert.equal(post.is_public, false);
    assert.equal(post.created_at, new Date(1719500000_000).toISOString());
    assert.equal(post.media_urls[0], summer.media[0].url); // the same file, not a copy
  });

  test("running it again adds nothing", async () => {
    const files = await fileCount();
    const result = await importAs(admin);
    assert.equal(result.posts, 0);
    assert.equal(await fileCount(), files);
    const titles = (await admin.get("/api/albums")).data.map((a: any) => a.title);
    assert.equal(titles.filter((t: string) => t === "Café summer").length, 1);
  });

  test("deleting an album keeps photos a post still uses", async () => {
    const albums = (await admin.get("/api/albums")).data;
    const fromPosts = (await admin.get(`/api/albums/${albums.find((a: any) => a.title === "Photos from Facebook posts").id}`)).data;
    assert.equal((await admin.del(`/api/albums/${fromPosts.id}`)).status, 200);
    assert.equal((await admin.get(fromPosts.media[0].url)).status, 200);
  });

  test("members can only import their own uploads", async () => {
    const mine = (await admin.get("/api/posts")).data.find((p: any) => p.content === "At the lake").media_urls[0];
    const other = client();
    await other.post("/api/auth/login", { email: "friend@example.com", password: "newpassword" });
    const r = await other.post("/api/imports/albums", { key: "fb:album:x", title: "Mine now", items: [{ url: mine, type: "image" }] });
    assert.equal(r.status, 400);
    assert.deepEqual((await other.post("/api/imports/lookup", { keys: ["fb:file:1_n.jpg:5"] })).data.found, {});
  });
});
