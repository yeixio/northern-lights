import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sql } from "kysely";
import { z } from "zod";
import { requireUser, type AppEnv } from "../auth.js";
import { newId, now, type DB } from "../db/index.js";
import { publish } from "../events.js";
import { authorColumns, bool, profile, withAuthor } from "../serialize.js";

const fileUrl = z.string().regex(/^\/files\/[\w.-]+$/, "Invalid file URL");

function postQuery(db: DB, viewerId: string) {
  return db
    .selectFrom("posts")
    .innerJoin("users", "users.id", "posts.user_id")
    .select([
      "posts.id", "posts.user_id", "posts.content", "posts.media_urls", "posts.is_public",
      "posts.created_at", "posts.updated_at",
      ...authorColumns,
      (eb) => eb.selectFrom("reactions").select(eb.fn.countAll<number>().as("n"))
        .whereRef("reactions.post_id", "=", "posts.id").as("like_count"),
      (eb) => eb.selectFrom("comments").select(eb.fn.countAll<number>().as("n"))
        .whereRef("comments.post_id", "=", "posts.id").as("comment_count"),
      (eb) => eb.exists(eb.selectFrom("reactions").select("reactions.id")
        .whereRef("reactions.post_id", "=", "posts.id").where("reactions.user_id", "=", viewerId)).as("liked"),
    ])
    .orderBy("posts.created_at", "desc");
}

type PostRow = Awaited<ReturnType<ReturnType<typeof postQuery>["execute"]>>[number];

export const serializePost = (p: PostRow) => {
  const row = withAuthor(p);
  return {
    ...row,
    media_urls: JSON.parse(p.media_urls) as string[],
    is_public: bool(p.is_public),
    liked: bool(p.liked),
    like_count: Number(p.like_count),
    comment_count: Number(p.comment_count),
  };
};

async function findPost(db: DB, id: string) {
  const post = await db.selectFrom("posts").selectAll().where("id", "=", id).executeTakeFirst();
  if (!post) throw new HTTPException(404, { message: "Post not found" });
  return post;
}

export const socialRoutes = new Hono<AppEnv>()
  .use(async (c, next) => {
    requireUser(c);
    await next();
  })

  // ---- posts -------------------------------------------------------------
  .get("/posts", async (c) => {
    const user = requireUser(c);
    const { author, before } = c.req.query();
    let q = postQuery(c.get("db"), user.id).limit(30);
    if (author) q = q.where("posts.user_id", "=", author);
    if (before) q = q.where("posts.created_at", "<", before);
    return c.json((await q.execute()).map(serializePost));
  })

  .post("/posts", async (c) => {
    const user = requireUser(c);
    const body = z.object({
      content: z.string().max(10_000).default(""),
      media_urls: z.array(fileUrl).max(20).default([]),
      is_public: z.boolean().default(false),
    }).parse(await c.req.json());
    if (!body.content.trim() && body.media_urls.length === 0) {
      throw new HTTPException(400, { message: "Write something or add a photo" });
    }
    const t = now();
    const id = newId();
    await c.get("db").insertInto("posts").values({
      id, user_id: user.id, content: body.content.trim(), media_urls: JSON.stringify(body.media_urls),
      is_public: body.is_public ? 1 : 0, created_at: t, updated_at: t,
    }).execute();
    publish({ type: "posts" });
    return c.json({ id }, 201);
  })

  .patch("/posts/:id", async (c) => {
    const user = requireUser(c);
    const db = c.get("db");
    const post = await findPost(db, c.req.param("id"));
    if (post.user_id !== user.id) throw new HTTPException(403, { message: "Not your post" });
    const body = z.object({ content: z.string().max(10_000).optional(), is_public: z.boolean().optional() })
      .parse(await c.req.json());
    await db.updateTable("posts").set({
      ...(body.content !== undefined && { content: body.content.trim() }),
      ...(body.is_public !== undefined && { is_public: body.is_public ? 1 : 0 }),
      updated_at: now(),
    }).where("id", "=", post.id).execute();
    publish({ type: "posts" });
    return c.json({ ok: true });
  })

  .delete("/posts/:id", async (c) => {
    const user = requireUser(c);
    const db = c.get("db");
    const post = await findPost(db, c.req.param("id"));
    if (post.user_id !== user.id && !user.is_admin) throw new HTTPException(403, { message: "Not your post" });
    await db.deleteFrom("posts").where("id", "=", post.id).execute();
    publish({ type: "posts" });
    return c.json({ ok: true });
  })

  // ---- likes -------------------------------------------------------------
  .post("/posts/:id/like", async (c) => {
    const user = requireUser(c);
    const db = c.get("db");
    const post = await findPost(db, c.req.param("id"));
    await db.insertInto("reactions")
      .values({ id: newId(), post_id: post.id, user_id: user.id, type: "like", created_at: now() })
      .onConflict((oc) => oc.columns(["user_id", "post_id"]).doNothing())
      .execute();
    publish({ type: "posts" });
    return c.json({ ok: true });
  })

  .delete("/posts/:id/like", async (c) => {
    const user = requireUser(c);
    await c.get("db").deleteFrom("reactions")
      .where("post_id", "=", c.req.param("id")).where("user_id", "=", user.id).execute();
    publish({ type: "posts" });
    return c.json({ ok: true });
  })

  // ---- comments ----------------------------------------------------------
  .get("/posts/:id/comments", async (c) => {
    const rows = await c.get("db").selectFrom("comments")
      .innerJoin("users", "users.id", "comments.user_id")
      .select(["comments.id", "comments.post_id", "comments.user_id", "comments.content", "comments.created_at", ...authorColumns])
      .where("comments.post_id", "=", c.req.param("id"))
      .orderBy("comments.created_at")
      .execute();
    return c.json(rows.map(withAuthor));
  })

  .post("/posts/:id/comments", async (c) => {
    const user = requireUser(c);
    const db = c.get("db");
    const post = await findPost(db, c.req.param("id"));
    const { content } = z.object({ content: z.string().trim().min(1).max(5000) }).parse(await c.req.json());
    await db.insertInto("comments")
      .values({ id: newId(), post_id: post.id, user_id: user.id, content, created_at: now() }).execute();
    publish({ type: "posts" });
    return c.json({ ok: true }, 201);
  })

  .delete("/comments/:id", async (c) => {
    const user = requireUser(c);
    const db = c.get("db");
    const comment = await db.selectFrom("comments").selectAll().where("id", "=", c.req.param("id")).executeTakeFirst();
    if (!comment) throw new HTTPException(404, { message: "Comment not found" });
    if (comment.user_id !== user.id && !user.is_admin) throw new HTTPException(403, { message: "Not your comment" });
    await db.deleteFrom("comments").where("id", "=", comment.id).execute();
    publish({ type: "posts" });
    return c.json({ ok: true });
  })

  // ---- people ------------------------------------------------------------
  .get("/people", async (c) => {
    const rows = await c.get("db").selectFrom("users").selectAll().where("is_active", "=", 1)
      .orderBy(sql`lower(first_name)`).execute();
    return c.json(rows.map(profile));
  })

  .get("/people/:id", async (c) => {
    const row = await c.get("db").selectFrom("users").selectAll().where("id", "=", c.req.param("id")).executeTakeFirst();
    if (!row) throw new HTTPException(404, { message: "Person not found" });
    return c.json(profile(row));
  })

  .patch("/me", async (c) => {
    const user = requireUser(c);
    const body = z.object({
      first_name: z.string().trim().min(1).max(100).optional(),
      last_name: z.string().trim().max(100).optional(),
      display_name: z.string().trim().max(100).nullable().optional(),
      bio: z.string().trim().max(2000).nullable().optional(),
      avatar_url: fileUrl.nullable().optional(),
    }).parse(await c.req.json());
    const db = c.get("db");
    await db.updateTable("users").set({
      ...body,
      ...(body.display_name === "" && { display_name: null }),
      ...(body.bio === "" && { bio: null }),
      updated_at: now(),
    }).where("id", "=", user.id).execute();
    const row = await db.selectFrom("users").selectAll().where("id", "=", user.id).executeTakeFirstOrThrow();
    return c.json(profile(row));
  });
