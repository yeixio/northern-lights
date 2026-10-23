import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Post } from "../lib/types";
import { lanesToLoad, visible, withFirstPage, type Lane } from "./merge";
import { useSiteEvents } from "./live";
import { abs, call, withSiteAuthor, type Site } from "./sites";

/** A post from one of the sites, with links made absolute. */
export interface FeedPost extends Post {
  site: Site;
  /** Unique across sites. */
  key: string;
}

const PAGE = 30;
const CACHE = "nl-hub-feed";

const empty = (): Lane<FeedPost> => ({ posts: [], done: false, error: null, loading: true });

function fromSite(site: Site, p: Post): FeedPost {
  return {
    ...p,
    media_urls: p.media_urls.map((u) => abs(site, u)!),
    author: withSiteAuthor(site, p.author),
    site,
    key: `${site.url} ${p.id}`,
  };
}

async function page(site: Site, before?: FeedPost) {
  const cursor = before ? `?before=${encodeURIComponent(`${before.created_at},${before.id}`)}` : "";
  const timeout = new Promise<never>((_, fail) => setTimeout(() => fail(new Error(`${site.info.name} is taking too long`)), 8000));
  const rows = await Promise.race([call<Post[]>(site, "GET", `/api/posts${cursor}`), timeout]);
  return rows.map((p) => fromSite(site, p));
}

/** The last feed seen, so the app opens instantly and works offline. */
function readCache(sites: Site[]): FeedPost[] {
  try {
    const rows = JSON.parse(localStorage.getItem(CACHE) ?? "[]") as (Post & { site_url: string; key: string })[];
    return rows.flatMap(({ site_url, ...p }) => {
      const site = sites.find((s) => s.url === site_url);
      return site ? [{ ...p, site }] : [];
    });
  } catch {
    return [];
  }
}

function writeCache(posts: FeedPost[]) {
  try {
    localStorage.setItem(CACHE, JSON.stringify(posts.slice(0, PAGE).map(({ site, ...p }) => ({ ...p, site_url: site.url }))));
  } catch {
    // Storage full or refused: the cache is only a convenience.
  }
}

/** One merged, live feed across every signed-in site. */
export function useFeed(sites: Site[]) {
  // Only a change in which sites are signed in restarts loading and live updates.
  const signedIn = sites.filter((s) => !s.signedOut);
  const key = signedIn.map((s) => `${s.url} ${s.token}`).join("|");
  const active = useMemo(() => signedIn, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const [lanes, setLanes] = useState<Record<string, Lane<FeedPost>>>({});
  const [cached] = useState(() => readCache(active));
  const lanesRef = useRef(lanes);
  lanesRef.current = lanes;

  const setLane = (url: string, change: (lane: Lane<FeedPost>) => Lane<FeedPost>) =>
    setLanes((all) => ({ ...all, [url]: change(all[url] ?? empty()) }));

  const refresh = useCallback(async (site: Site) => {
    try {
      const rows = await page(site);
      setLane(site.url, (l) => ({ posts: withFirstPage(l.posts, rows), done: l.posts.length > rows.length ? l.done : rows.length < PAGE, error: null, loading: false }));
    } catch (err) {
      setLane(site.url, (l) => ({ ...l, error: (err as Error).message, loading: false }));
    }
  }, []);

  // Load each new site's first page; forget sites that were removed.
  useEffect(() => {
    for (const site of active) {
      if (!lanesRef.current[site.url]) {
        setLane(site.url, () => empty());
        void refresh(site);
      }
    }
    setLanes((all) => Object.fromEntries(Object.entries(all).filter(([url]) => active.some((s) => s.url === url))));
  }, [active, refresh]);

  // Live updates: refetch a site's newest posts when it says they changed.
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useSiteEvents(active, (site, event) => {
    if (event !== "posts") return;
    clearTimeout(timers.current.get(site.url));
    timers.current.set(site.url, setTimeout(() => void refresh(site), 300));
  });

  const list = active.map((s) => lanes[s.url] ?? empty());
  const posts = visible(list);
  const ready = list.length > 0 && list.every((l) => !l.loading);

  useEffect(() => {
    if (ready) writeCache(posts);
  }, [ready, posts]);

  const loadMore = useCallback(async () => {
    const current = active.map((s) => lanesRef.current[s.url] ?? empty());
    await Promise.all(lanesToLoad(current).map(async (i) => {
      const site = active[i];
      const lane = current[i];
      setLane(site.url, (l) => ({ ...l, loading: true }));
      try {
        const rows = await page(site, lane.posts.at(-1));
        setLane(site.url, (l) => ({ ...l, posts: [...l.posts, ...rows], done: rows.length < PAGE, loading: false }));
      } catch (err) {
        setLane(site.url, (l) => ({ ...l, error: (err as Error).message, loading: false }));
      }
    }));
  }, [active]);

  const errors = active.flatMap((s) => (lanes[s.url]?.error ? [{ site: s, error: lanes[s.url].error! }] : []));
  const hasMore = list.some((l) => !l.done && !l.error);

  return {
    posts: posts.length || ready ? posts : cached,
    loading: !ready,
    offline: !ready && posts.length === 0 && cached.length > 0,
    errors,
    hasMore,
    loadMore,
    refresh: (site: Site) => refresh(site),
    retry: () => active.forEach((s) => lanes[s.url]?.error && void refresh(s)),
  };
}
