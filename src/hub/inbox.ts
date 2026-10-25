import { useCallback, useEffect, useState } from "react";
import type { Message, Profile } from "../lib/types";
import { useSiteEvents } from "./live";
import { call, updateSite, withSiteAuthor, type Site } from "./sites";

/** A conversation with one person on one site. Accounts are per site, so the same person on two sites is two conversations. */
export interface Conversation {
  key: string;
  site: Site;
  person: Profile;
  messages: Message[];
  unread: number;
  last: Message;
}

async function loadSite(site: Site): Promise<Conversation[]> {
  const [messages, people] = await Promise.all([
    call<Message[]>(site, "GET", "/api/messages"),
    call<Profile[]>(site, "GET", "/api/people"),
  ]);
  const me = site.user.id;
  const byPerson = new Map<string, Message[]>();
  for (const m of messages) {
    const other = m.sender_id === me ? m.recipient_id : m.sender_id;
    byPerson.set(other, [...(byPerson.get(other) ?? []), m]);
  }
  return [...byPerson].flatMap(([id, list]) => {
    const person = people.find((p) => p.id === id);
    if (!person) return [];
    return [{
      key: `${site.url} ${id}`,
      site,
      person: withSiteAuthor(site, person),
      messages: list,
      unread: list.filter((m) => m.recipient_id === me && !m.read).length,
      last: list.at(-1)!,
    }];
  });
}

/** Every conversation on every site, most recent first, kept live. */
export function useInbox(sites: Site[]) {
  const [bySite, setBySite] = useState<Record<string, Conversation[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reload = useCallback(async (site: Site) => {
    try {
      const list = await loadSite(site);
      setBySite((all) => ({ ...all, [site.url]: list }));
      setErrors(({ [site.url]: _gone, ...rest }) => rest);
    } catch (err) {
      setErrors((all) => ({ ...all, [site.url]: (err as Error).message }));
    }
  }, []);

  const key = sites.map((s) => s.url).join("|");
  useEffect(() => {
    sites.forEach((s) => void reload(s));
  }, [key, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  useSiteEvents(sites, (site, event) => {
    if (event === "messages") void reload(site);
  });

  const conversations = sites.flatMap((s) => bySite[s.url] ?? [])
    .sort((a, b) => (a.last.created_at < b.last.created_at ? 1 : -1));
  return { conversations, errors, reload, loading: sites.some((s) => !bySite[s.url] && !errors[s.url]) };
}

export interface Summary {
  /** The signed-in person, from sites that send it. */
  user?: Profile;
  unread_messages: number;
  new_posts: number;
  new_comments_on_my_posts: number;
  new_likes_on_my_posts: number;
}

/** Badge counts per site since the person last looked, refreshed every minute and on any change. */
export function useSummaries(sites: Site[]) {
  const [summaries, setSummaries] = useState<Record<string, Summary>>({});

  const reload = useCallback(async (site: Site) => {
    try {
      const s = await call<Summary>(site, "GET", `/api/app/summary?since=${encodeURIComponent(site.seenAt)}`);
      setSummaries((all) => ({ ...all, [site.url]: s }));
      // Keeps the name and photo current: a photo link stops working after a day or two.
      if (s.user && JSON.stringify(s.user) !== JSON.stringify(site.user)) updateSite(site.url, { user: s.user });
    } catch {
      // A site that can't be reached shows no badge.
    }
  }, []);

  const key = sites.map((s) => `${s.url} ${s.seenAt}`).join("|");
  useEffect(() => {
    const all = () => sites.forEach((s) => void reload(s));
    all();
    const timer = setInterval(all, 60_000);
    const onShow = () => document.visibilityState === "visible" && all();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [key, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  useSiteEvents(sites, (site) => void reload(site));

  const total = (k: Exclude<keyof Summary, "user">) => sites.reduce((n, s) => n + (summaries[s.url]?.[k] ?? 0), 0);
  return { summaries, unreadMessages: total("unread_messages") };
}
