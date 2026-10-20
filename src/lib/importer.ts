import { api, ApiError } from "./api";
import type { ImportItem, ImportPlan } from "./facebook";

export interface ImportProgress {
  done: number;
  total: number;
  step: string;
  skipped: { name: string; reason: string }[];
  albums: number;
  posts: number;
}

const BATCH = 50;
const PARALLEL = 3;

const chunks = <T,>(list: T[], size: number) =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

/**
 * Upload everything in the plan. Safe to run again after an interruption:
 * the server remembers what was imported, so finished photos, albums and
 * posts are skipped.
 */
export async function runImport(
  plan: ImportPlan,
  opts: { posts: boolean; signal: AbortSignal; onProgress: (p: ImportProgress) => void },
) {
  const all = new Map<string, ImportItem>();
  for (const a of plan.albums) for (const it of a.items) all.set(it.key, it);
  const progress: ImportProgress = { done: 0, total: all.size, step: "Checking what's already here…", skipped: [], albums: 0, posts: 0 };
  const report = () => opts.onProgress({ ...progress, skipped: [...progress.skipped] });
  report();

  const urls = new Map<string, string>();
  for (const keys of chunks([...all.keys()], 1000)) {
    const { found } = await api.post<{ found: Record<string, string> }>("/api/imports/lookup", { keys });
    for (const [k, url] of Object.entries(found)) urls.set(k, url);
  }
  const failed = new Set<string>();

  async function upload(it: ImportItem) {
    if (urls.has(it.key) || failed.has(it.key)) return;
    opts.signal.throwIfAborted();
    try {
      const form = new FormData();
      form.append("key", it.key);
      form.append("file", new File([await it.entry.blob()], it.name, { type: it.mime }));
      const res = await api.post<{ url: string }>("/api/imports/files", form);
      urls.set(it.key, res.url);
    } catch (err) {
      // A bad file shouldn't stop the import; a lost connection or a cancel should.
      if (!(err instanceof ApiError) || err.status === 401) throw err;
      failed.add(it.key);
      progress.skipped.push({ name: it.name, reason: err.message });
    }
  }

  async function uploadAll(list: ImportItem[]) {
    let next = 0;
    await Promise.all(Array.from({ length: PARALLEL }, async () => {
      while (next < list.length) {
        const it = list[next++];
        const wasNew = !urls.has(it.key) && !failed.has(it.key);
        await upload(it);
        if (wasNew) progress.done++;
        report();
      }
    }));
  }

  // Count photos that were imported last time as done straight away.
  progress.done = [...all.keys()].filter((k) => urls.has(k)).length;

  for (const album of plan.albums) {
    progress.step = `Album: ${album.title}`;
    report();
    for (const batch of chunks(album.items, BATCH)) {
      await uploadAll(batch);
      opts.signal.throwIfAborted();
      const items = batch.filter((it) => urls.has(it.key)).map((it) => ({
        url: urls.get(it.key), type: it.type, caption: it.caption, created_at: it.created_at ?? undefined,
      }));
      if (items.length === 0) continue;
      await api.post("/api/imports/albums", {
        key: album.key,
        title: album.title,
        description: album.description,
        created_at: album.created_at ?? undefined,
        items,
      });
    }
    progress.albums++;
    report();
  }

  if (opts.posts && plan.posts.length > 0) {
    progress.step = "Posts";
    report();
    for (const batch of chunks(plan.posts, BATCH)) {
      opts.signal.throwIfAborted();
      const { added } = await api.post<{ added: number }>("/api/imports/posts", {
        posts: batch.map((p) => ({
          key: p.key,
          content: p.content,
          created_at: p.created_at ?? undefined,
          media_urls: p.items.filter((it) => urls.has(it.key)).map((it) => urls.get(it.key)),
        })),
      });
      progress.posts += added;
      report();
    }
  }

  progress.step = "Done";
  report();
  return progress;
}
