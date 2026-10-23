import { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { WifiOff, X } from "lucide-react";
import Spinner from "../../components/Spinner";
import { useFeed } from "../feed";
import HubComposer from "../HubComposer";
import HubPostCard from "../HubPostCard";
import { SiteLogo } from "../SiteBadge";
import { getSites, updateSite, useSites } from "../sites";

/** News Feed: every site's posts in one list, or one site's with ?site=. */
export default function HubFeed() {
  const all = useSites().filter((s) => !s.signedOut);
  const [params] = useSearchParams();
  const only = params.get("site");
  const sites = only ? all.filter((s) => s.url === only) : all;
  const feed = useFeed(sites);
  const more = useRef<HTMLDivElement>(null);

  // Opening the feed counts as having seen what's new.
  useEffect(() => {
    const t = new Date().toISOString();
    getSites().forEach((s) => (!only || s.url === only) && updateSite(s.url, { seenAt: t }));
  }, [only]);

  // Load older posts as the bottom of the list comes into view.
  const { hasMore, loadMore, posts } = feed;
  useEffect(() => {
    const el = more.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && void loadMore(), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore, posts.length]);

  const site = only ? sites[0] : null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {site && (
        <div className="card flex items-center gap-3 p-4">
          <SiteLogo site={site} className="h-10 w-10" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-semibold">{site.info.name}</h1>
            {site.info.tagline && <p className="truncate text-sm text-ink-500">{site.info.tagline}</p>}
          </div>
          <a className="btn-secondary" href={site.url} target="_blank" rel="noreferrer">Website</a>
          <Link to="/" className="btn-ghost px-2" aria-label="Show all sites"><X size={18} /></Link>
        </div>
      )}

      <HubComposer key={only ?? "all"} sites={sites} onPosted={(s) => void feed.refresh(s)} />

      {feed.offline && (
        <p className="flex items-center gap-2 rounded-lg bg-ink-100 px-3 py-2 text-sm text-ink-600">
          <WifiOff size={16} /> Showing what you saw last time while the sites load.
        </p>
      )}
      {feed.errors.map(({ site: s, error }) => (
        <p key={s.url} className="flex items-center gap-2 rounded-lg bg-ink-100 px-3 py-2 text-sm text-ink-600">
          <WifiOff size={16} /> <span className="flex-1">{error}. Showing the other sites.</span>
          <button className="font-medium text-primary-700 hover:underline" onClick={feed.retry}>Try again</button>
        </p>
      ))}

      {feed.loading && posts.length === 0 && <Spinner full />}
      {!feed.loading && posts.length === 0 && <p className="py-12 text-center text-ink-500">No posts yet. Say hello!</p>}
      {posts.map((p) => <HubPostCard key={p.key} post={p} onChange={() => void feed.refresh(p.site)} />)}
      <div ref={more}>{feed.hasMore && posts.length > 0 && <div className="flex justify-center py-6"><Spinner /></div>}</div>
    </div>
  );
}
