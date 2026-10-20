import { useEffect, useRef } from "react";

type Topic = "posts" | "messages";

let source: EventSource | null = null;
const listeners = new Map<Topic, Set<() => void>>();

function ensureSource() {
  if (source) return;
  source = new EventSource("/api/events");
  for (const topic of ["posts", "messages"] as Topic[]) {
    source.addEventListener(topic, () => listeners.get(topic)?.forEach((fn) => fn()));
  }
}

/** Calls `onChange` whenever the server says `topic` changed. */
export function useLive(topic: Topic, onChange: () => void) {
  const ref = useRef(onChange);
  ref.current = onChange;
  useEffect(() => {
    ensureSource();
    const fn = () => ref.current();
    if (!listeners.has(topic)) listeners.set(topic, new Set());
    listeners.get(topic)!.add(fn);
    return () => {
      listeners.get(topic)!.delete(fn);
    };
  }, [topic]);
}

export function closeLive() {
  source?.close();
  source = null;
}
