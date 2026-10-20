import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Star, Trash2, X } from "lucide-react";
import { api, errorText } from "../../lib/api";
import { uploadFiles } from "../../lib/storage";
import { useAuth } from "../../auth/AuthProvider";
import type { AlbumWithMedia, Album, Media } from "../../lib/types";
import ImagePicker from "../../components/ImagePicker";
import Spinner from "../../components/Spinner";

export default function AlbumManage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [album, setAlbum] = useState<AlbumWithMedia | null>(null);
  const [open, setOpen] = useState<Media | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canEdit = !!user && (album?.owner_id === user.id || user.is_admin);

  const load = useCallback(async () => setAlbum(await api.get<AlbumWithMedia>(`/api/albums/${id}`)), [id]);
  useEffect(() => void load(), [load]);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function upload(files: File[]) {
    setBusy(true);
    await run(async () => {
      const uploaded = await uploadFiles(files);
      await api.post(`/api/albums/${id}/media`, { items: uploaded });
    });
    setBusy(false);
  }

  const update = (patch: Partial<Album>) => run(() => api.patch(`/api/albums/${id}`, patch));

  async function deleteAlbum() {
    if (!confirm("Delete this album and all its photos?")) return;
    await api.del(`/api/albums/${id}`);
    navigate("/app/albums");
  }

  if (!album) return <Spinner full />;

  return (
    <div className="space-y-4">
      <Link to="/app/albums" className="inline-flex items-center gap-1 text-sm text-ink-600 hover:underline"><ArrowLeft size={16} /> Albums</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{album.title}</h1>
          {album.description && <p className="text-ink-600">{album.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <ImagePicker multiple label={busy ? "Uploading…" : "Add photos"} onPick={upload} />
          {canEdit && (
            <>
              <label className="btn-secondary cursor-pointer">
                <input type="checkbox" checked={album.is_public} onChange={(e) => update({ is_public: e.target.checked })} /> Public
              </label>
              <button className="btn-secondary" onClick={() => {
                const d = prompt("Album description", album.description ?? "");
                if (d !== null) void update({ description: d || null });
              }}>Describe</button>
              <button className="btn-danger" onClick={deleteAlbum} aria-label="Delete album"><Trash2 size={16} /></button>
            </>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {busy && <Spinner />}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {album.media.map((m) => (
          <div key={m.id} className="group relative aspect-square overflow-hidden rounded-lg bg-ink-200">
            <button className="h-full w-full" onClick={() => setOpen(m)}>
              {m.type === "video"
                ? <video src={m.url} className="h-full w-full object-cover" muted />
                : <img src={m.url} alt={m.caption ?? ""} loading="lazy" className="h-full w-full object-cover" />}
            </button>
            {canEdit && (
              <div className="absolute inset-x-0 top-0 flex justify-end gap-1 p-1 opacity-0 transition group-hover:opacity-100">
                {m.type !== "video" && (
                  <button onClick={() => update({ cover_url: m.url })} className="rounded bg-black/60 p-1 text-white" title="Use as cover">
                    <Star size={16} fill={album.cover_url === m.url ? "currentColor" : "none"} />
                  </button>
                )}
                <button onClick={() => run(() => api.del(`/api/media/${m.id}`))} className="rounded bg-black/60 p-1 text-white" title="Delete">
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4" onClick={() => setOpen(null)}>
          <button className="absolute top-4 right-4 text-white" aria-label="Close"><X /></button>
          {open.type === "video"
            ? <video src={open.url} controls autoPlay className="max-h-[85vh] max-w-full" onClick={(e) => e.stopPropagation()} />
            : <img src={open.url} alt={open.caption ?? ""} className="max-h-[85vh] max-w-full object-contain" />}
        </div>
      )}
    </div>
  );
}
