import { useState } from "react";
import { X } from "lucide-react";
import Avatar from "../components/Avatar";
import ImagePicker from "../components/ImagePicker";
import { call, withSiteAuthor, type Site } from "./sites";

const LAST = "nl-hub-post-to";

function lastUsed(sites: Site[]) {
  try {
    const url = localStorage.getItem(LAST);
    return sites.find((s) => s.url === url) ?? sites[0];
  } catch {
    return sites[0];
  }
}

/** Write a post on one of the sites, chosen with "Post to". */
export default function HubComposer({ sites, onPosted }: { sites: Site[]; onPosted: (site: Site) => void }) {
  const [siteUrl, setSiteUrl] = useState(() => lastUsed(sites)?.url);
  const site = sites.find((s) => s.url === siteUrl) ?? sites[0];
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!site) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() && files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      let media_urls: string[] = [];
      if (files.length) {
        const form = new FormData();
        files.forEach((f) => form.append("file", f));
        media_urls = (await call<{ url: string }[]>(site, "POST", "/api/uploads", form)).map((u) => u.url);
      }
      await call(site, "POST", "/api/posts", { content, media_urls });
      try {
        localStorage.setItem(LAST, site.url);
      } catch {
        // Remembering the choice is only a convenience.
      }
      setContent("");
      setFiles([]);
      onPosted(site);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-4">
      <div className="flex gap-3">
        <Avatar profile={withSiteAuthor(site, site.user)} />
        <textarea
          className="input min-h-20 resize-y"
          placeholder={`What's on your mind, ${site.user.first_name || "friend"}?`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div key={i} className="relative">
              {f.type.startsWith("video/")
                ? <video src={URL.createObjectURL(f)} className="h-20 w-20 rounded-lg object-cover" />
                : <img src={URL.createObjectURL(f)} alt="" className="h-20 w-20 rounded-lg object-cover" />}
              <button
                type="button"
                className="absolute -top-2 -right-2 rounded-full bg-black/70 p-0.5 text-white"
                onClick={() => setFiles(files.filter((_, j) => j !== i))}
                aria-label="Remove"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <ImagePicker multiple onPick={(picked) => setFiles([...files, ...picked])} />
        {sites.length > 1 && (
          <label className="flex items-center gap-2 text-sm text-ink-600">
            Post to
            <select className="input w-auto py-1.5" value={site.url} onChange={(e) => setSiteUrl(e.target.value)}>
              {sites.map((s) => <option key={s.url} value={s.url}>{s.info.name}</option>)}
            </select>
          </label>
        )}
        <button className="btn-primary ml-auto" disabled={busy}>
          {busy ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}
