import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { requireUser, type AppEnv } from "../auth.js";
import { subscribe } from "../events.js";

/** Server-sent events: tells the browser when to refetch the feed or messages. */
export const liveRoutes = new Hono<AppEnv>().get("/events", (c) => {
  const user = requireUser(c);
  return streamSSE(c, async (stream) => {
    const unsubscribe = subscribe((event) => {
      if (event.type === "messages" && !event.userIds.includes(user.id)) return;
      void stream.writeSSE({ event: event.type, data: "{}" });
    });
    stream.onAbort(() => {
      unsubscribe();
    });
    while (!stream.aborted) {
      await stream.writeSSE({ event: "ping", data: "{}" });
      await stream.sleep(25_000);
    }
    unsubscribe();
  });
});
