import { useEffect, useRef } from "react";
import { updateSite, type Site } from "./sites";

// One server-sent events stream per site, shared by every screen that wants
// to hear about new posts or messages there.

type Handler = (site: Site, event: string) => void;

const streams = new Map<string, { stop: AbortController; handlers: Set<Handler> }>();

/**
 * Reads a site's events with fetch, since EventSource can't send the bearer
 * token. Reconnects until stopped.
 */
async function listen(site: Site, onEvent: (event: string) => void, signal: AbortSignal) {
  while (!signal.aborted) {
    try {
      const res = await fetch(`${site.url}/api/events`, { headers: { Authorization: `Bearer ${site.token}` }, signal, credentials: "omit" });
      if (res.status === 401) {
        updateSite(site.url, { signedOut: true });
        return;
      }
      if (res.ok && res.body) {
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value;
          let end;
          while ((end = buffer.indexOf("\n\n")) >= 0) {
            const event = /^event: ?(.*)$/m.exec(buffer.slice(0, end))?.[1];
            buffer = buffer.slice(end + 2);
            if (event && event !== "ping") onEvent(event);
          }
        }
      }
    } catch {
      if (signal.aborted) return;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
}

function subscribe(site: Site, handler: Handler) {
  const id = `${site.url} ${site.token}`;
  let stream = streams.get(id);
  if (!stream) {
    const s = { stop: new AbortController(), handlers: new Set<Handler>() };
    streams.set(id, s);
    void listen(site, (event) => s.handlers.forEach((fn) => fn(site, event)), s.stop.signal);
    stream = s;
  }
  stream.handlers.add(handler);
  return () => {
    stream.handlers.delete(handler);
    if (stream.handlers.size === 0) {
      stream.stop.abort();
      streams.delete(id);
    }
  };
}

/** Calls `onEvent(site, "posts" | "messages")` whenever one of the sites says something changed. */
export function useSiteEvents(sites: Site[], onEvent: Handler) {
  const ref = useRef(onEvent);
  ref.current = onEvent;
  const key = sites.map((s) => `${s.url} ${s.token}`).join("|");
  useEffect(() => {
    const offs = sites.map((site) => subscribe(site, (s, e) => ref.current(s, e)));
    return () => offs.forEach((off) => off());
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}
