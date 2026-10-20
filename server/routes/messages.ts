import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { requireUser, type AppEnv } from "../auth.js";
import { newId, now } from "../db/index.js";
import { publish } from "../events.js";
import { bool } from "../serialize.js";

export const messageRoutes = new Hono<AppEnv>()
  .get("/messages", async (c) => {
    const user = requireUser(c);
    const rows = await c.get("db").selectFrom("messages").selectAll()
      .where((eb) => eb.or([eb("sender_id", "=", user.id), eb("recipient_id", "=", user.id)]))
      .orderBy("created_at")
      .execute();
    return c.json(rows.map((m) => ({ ...m, read: bool(m.read) })));
  })

  .post("/messages", async (c) => {
    const user = requireUser(c);
    const db = c.get("db");
    const body = z.object({ recipient_id: z.string(), content: z.string().trim().min(1).max(10_000) })
      .parse(await c.req.json());
    const recipient = await db.selectFrom("users").select("id")
      .where("id", "=", body.recipient_id).where("is_active", "=", 1).executeTakeFirst();
    if (!recipient) throw new HTTPException(404, { message: "Recipient not found" });
    await db.insertInto("messages").values({
      id: newId(), sender_id: user.id, recipient_id: recipient.id, content: body.content, read: 0, created_at: now(),
    }).execute();
    publish({ type: "messages", userIds: [user.id, recipient.id] });
    return c.json({ ok: true }, 201);
  })

  .post("/messages/read", async (c) => {
    const user = requireUser(c);
    const { ids } = z.object({ ids: z.array(z.string()).max(500) }).parse(await c.req.json());
    if (ids.length) {
      await c.get("db").updateTable("messages").set({ read: 1 })
        .where("recipient_id", "=", user.id).where("id", "in", ids).execute();
      publish({ type: "messages", userIds: [user.id] });
    }
    return c.json({ ok: true });
  })

  .delete("/messages/:id", async (c) => {
    const user = requireUser(c);
    const db = c.get("db");
    const m = await db.selectFrom("messages").selectAll().where("id", "=", c.req.param("id")).executeTakeFirst();
    if (!m) throw new HTTPException(404, { message: "Message not found" });
    if (m.sender_id !== user.id && !user.is_admin) throw new HTTPException(403, { message: "Not your message" });
    await db.deleteFrom("messages").where("id", "=", m.id).execute();
    publish({ type: "messages", userIds: [m.sender_id, m.recipient_id] });
    return c.json({ ok: true });
  });
