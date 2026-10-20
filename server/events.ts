import { EventEmitter } from "node:events";

/**
 * In-process pub/sub for live updates. Each connected browser holds a
 * server-sent events stream and refetches when told something changed.
 */
export type LiveEvent = { type: "posts" } | { type: "messages"; userIds: string[] };

const bus = new EventEmitter();
bus.setMaxListeners(0);

export const publish = (event: LiveEvent) => bus.emit("event", event);

export function subscribe(fn: (event: LiveEvent) => void) {
  bus.on("event", fn);
  return () => bus.off("event", fn);
}
