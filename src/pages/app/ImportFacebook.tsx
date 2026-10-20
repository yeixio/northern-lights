import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FileArchive, FolderOpen } from "lucide-react";
import { errorText } from "../../lib/api";
import { buildPlan, type ImportPlan } from "../../lib/facebook";
import { runImport, type ImportProgress } from "../../lib/importer";
import { folderEntries, readZip, type ArchiveEntry } from "../../lib/zip";
import Spinner from "../../components/Spinner";

type State =
  | { step: "pick" }
  | { step: "scanning" }
  | { step: "ready"; plan: ImportPlan }
  | { step: "importing"; plan: ImportPlan; progress: ImportProgress | null }
  | { step: "done"; plan: ImportPlan; progress: ImportProgress; stopped: string | null };

const plural = (n: number, word: string, many = `${word}s`) => `${n.toLocaleString()} ${n === 1 ? word : many}`;

export default function ImportFacebook() {
  const [state, setState] = useState<State>({ step: "pick" });
  const [error, setError] = useState<string | null>(null);
  const [withPosts, setWithPosts] = useState(false);
  const zipInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);

  async function scan(load: () => Promise<ArchiveEntry[]>) {
    setError(null);
    setState({ step: "scanning" });
    try {
      const plan = await buildPlan(await load());
      if (plan.albums.length === 0) throw new Error("No photos or videos were found in this export.");
      setState({ step: "ready", plan });
    } catch (err) {
      setError(errorText(err));
      setState({ step: "pick" });
    }
  }

  async function start(plan: ImportPlan) {
    abort.current = new AbortController();
    setState({ step: "importing", plan, progress: null });
    let last: ImportProgress = { done: 0, total: 0, step: "", skipped: [], albums: 0, posts: 0 };
    try {
      last = await runImport(plan, {
        posts: withPosts,
        signal: abort.current.signal,
        onProgress: (progress) => {
          last = progress;
          setState({ step: "importing", plan, progress });
        },
      });
      setState({ step: "done", plan, progress: last, stopped: null });
    } catch (err) {
      const stopped = abort.current.signal.aborted ? "Import stopped." : errorText(err);
      setState({ step: "done", plan, progress: last, stopped });
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <Link to="/app/albums" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:underline"><ArrowLeft size={16} /> Albums</Link>
      <h1 className="text-2xl font-semibold">Import from Facebook</h1>

      {state.step === "pick" && (
        <>
          <div className="card space-y-3 p-4 text-sm text-slate-700">
            <p>Bring your Facebook photos and videos here, with their albums, captions and dates.</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>On Facebook, open <b>Settings → Accounts Center → Your information and permissions → Export your information</b> (called <b>Download your information</b> in some versions).</li>
              <li>Choose <b>Photos and videos</b> (and <b>Posts</b> if you want those too), set the format to <b>JSON</b>, media quality to <b>High</b>, and the date range to <b>All time</b>.</li>
              <li>When Facebook says it's ready, download the zip file. Big accounts get several; choose them all at once below.</li>
            </ol>
            <p className="text-slate-500">The zip is read in your browser, so nothing except the photos themselves is sent to this site.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => zipInput.current?.click()}><FileArchive size={16} /> Choose zip file(s)</button>
            <button className="btn-secondary" onClick={() => folderInput.current?.click()}><FolderOpen size={16} /> Choose an unzipped folder</button>
          </div>
          <input ref={zipInput} type="file" accept=".zip,application/zip" multiple hidden onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length) void scan(async () => (await Promise.all(files.map(readZip))).flat());
          }} />
          <input ref={folderInput} type="file" hidden {...{ webkitdirectory: "" }} onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length) void scan(async () => folderEntries(files));
          }} />
        </>
      )}

      {state.step === "scanning" && <div className="card flex items-center gap-3 p-4 text-sm"><Spinner /> Reading your export…</div>}

      {state.step === "ready" && (
        <div className="card space-y-4 p-4 text-sm">
          <p>
            Found <b>{plural(state.plan.photos, "photo")}</b>
            {state.plan.videos > 0 && <> and <b>{plural(state.plan.videos, "video")}</b></>} in{" "}
            <b>{plural(state.plan.albums.length, "album")}</b>
            {state.plan.posts.length > 0 && <>, plus <b>{plural(state.plan.posts.length, "post")}</b></>}.
          </p>
          {state.plan.missing > 0 && (
            <p className="text-amber-700">
              {plural(state.plan.missing, "file")} mentioned in the export {state.plan.missing === 1 ? "wasn't" : "weren't"} in
              what you chose. If Facebook gave
              you several zip files, start again and choose all of them together.
            </p>
          )}
          <ul className="max-h-48 space-y-0.5 overflow-auto text-slate-600">
            {state.plan.albums.map((a) => <li key={a.key}>{a.title} <span className="text-slate-400">({a.items.length})</span></li>)}
          </ul>
          {state.plan.posts.length > 0 && (
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={withPosts} onChange={(e) => setWithPosts(e.target.checked)} />
              <span>Also add my {plural(state.plan.posts.length, "post")} to the feed, with their original dates.</span>
            </label>
          )}
          <p className="text-slate-500">
            Everything is imported as members-only. You can choose which albums to show on the public page afterwards.
            Keep this page open while it runs; if it's interrupted, run it again and it will pick up where it left off.
          </p>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={() => void start(state.plan)}>Start import</button>
            <button className="btn-secondary" onClick={() => setState({ step: "pick" })}>Cancel</button>
          </div>
        </div>
      )}

      {state.step === "importing" && (
        <div className="card space-y-3 p-4 text-sm">
          <ProgressBar progress={state.progress} />
          <button className="btn-secondary" onClick={() => abort.current?.abort()}>Stop</button>
        </div>
      )}

      {state.step === "done" && (
        <div className="card space-y-3 p-4 text-sm">
          {state.stopped
            ? <p className="text-rose-600">{state.stopped} Run the import again to continue; what's already here won't be copied twice.</p>
            : <p className="font-medium text-emerald-700">Import finished.</p>}
          <p>
            {(state.progress.done - state.progress.skipped.length).toLocaleString()} of{" "}
            {plural(state.progress.total, "photo and video", "photos and videos")} are here, in{" "}
            {plural(state.progress.albums, "album")}
            {state.progress.posts > 0 && <>, and {plural(state.progress.posts, "post")} added to the feed</>}.
          </p>
          {state.progress.skipped.length > 0 && (
            <details>
              <summary className="cursor-pointer text-amber-700">{plural(state.progress.skipped.length, "file")} skipped</summary>
              <ul className="mt-2 max-h-48 overflow-auto text-slate-600">
                {state.progress.skipped.map((s) => <li key={s.name}>{s.name}: {s.reason}</li>)}
              </ul>
            </details>
          )}
          <div className="flex gap-2">
            <Link to="/app/albums" className="btn-primary">See albums</Link>
            {state.stopped && <button className="btn-secondary" onClick={() => void start(state.plan)}>Resume</button>}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}

function ProgressBar({ progress }: { progress: ImportProgress | null }) {
  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-slate-600">
        <span className="truncate">{progress?.step ?? "Starting…"}</span>
        <span>{progress ? `${progress.done.toLocaleString()} / ${progress.total.toLocaleString()}` : ""}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
