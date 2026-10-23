import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useSummaries } from "../inbox";
import { SiteLogo } from "../SiteBadge";
import { removeSite, useSites } from "../sites";
import { displayName } from "../../lib/types";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The sites in the app: what's new on each, and adding or removing them. */
export default function HubSites() {
  const sites = useSites();
  const { summaries } = useSummaries(sites.filter((s) => !s.signedOut));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your sites</h1>
        <Link to="/add" className="btn-primary"><Plus size={16} /> Add a site</Link>
      </div>
      {sites.length === 0 && <p className="text-ink-500">No sites yet.</p>}
      <section className="card divide-y divide-ink-100">
        {sites.map((site) => {
          const s = summaries[site.url];
          const news = s && [
            s.new_posts && plural(s.new_posts, "new post"),
            s.unread_messages && plural(s.unread_messages, "unread message"),
            s.new_comments_on_my_posts && plural(s.new_comments_on_my_posts, "new comment"),
            s.new_likes_on_my_posts && plural(s.new_likes_on_my_posts, "new like"),
          ].filter(Boolean).join(", ");
          return (
            <div key={site.url} className="flex items-center gap-3 p-4">
              <SiteLogo site={site} className="h-10 w-10" />
              <div className="min-w-0 flex-1">
                <Link to={`/?site=${encodeURIComponent(site.url)}`} className="block truncate font-semibold hover:underline">{site.info.name}</Link>
                <div className="truncate text-sm text-ink-500">
                  {new URL(site.url).host} · {displayName(site.user)}
                </div>
                {site.signedOut
                  ? <div className="text-sm text-rose-600">Signed out. <Link className="font-medium underline" to={`/add?site=${encodeURIComponent(site.url)}`}>Sign in again</Link></div>
                  : news && <div className="text-sm text-primary-700">{news}</div>}
              </div>
              <a className="btn-ghost hidden sm:inline-flex" href={site.url} target="_blank" rel="noreferrer">Website</a>
              <button
                className="btn-ghost text-rose-600"
                onClick={() => confirm(`Remove ${site.info.name} from the app? You can add it again any time.`) && void removeSite(site)}
              >
                Remove
              </button>
            </div>
          );
        })}
      </section>
    </div>
  );
}
