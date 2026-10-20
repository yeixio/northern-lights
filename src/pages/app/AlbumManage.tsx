import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Star, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { removeMedia, uploadMedia } from "../../lib/storage";
import { useAuth } from "../../auth/AuthProvider";
import type { Album, Media } from "../../lib/types";
import ImagePicker from "../../components/ImagePicker";
import Spinner from "../../components/Spinner";

export default function AlbumManage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [album, setAlbum] = useState<Album | null>(null);
  const [items, setItems] = useState<Media[]>([]);
  const [busy, setBusy] = useState(false);
  const canEdit = !!profile && (album?.owner_id === profile.id || profile.is_admin);

  async function load() {
    const { data } = await supabase.from("albums").select("*").eq("id", id!).maybeSingle();
    setAlbum(data as Album | null);
    const { data: m } = await supabase.from("media").select("*").eq("album_id", id!).order("created_at");
    setItems((m as Media[]) ?? []);
  }
  useEffect(() => void load(), [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function upload(files: File[]) {
    if (!profile || !album) return;
    setBusy(true);
    for (const file of files) {
      const url = await uploadMedia(`albums/${album.id}`, file);
      await supabase.from("media").insert({
        album_id: album.id, user_id: profile.id, url,
        type: file.type.startsWith("video/") ? "video" : "image",
      });
      if (!album.cover_url && !file.type.startsWith("video/")) {
        await supabase.from("albums").update({ cover_url: url }).eq("id", album.id);
        album.cover_url = url;
      }
    }
    setBusy(false);
    await load();
  }

  async function update(patch: Partial<Album>) {
    await supabase.from("albums").update(patch).eq("id", id!);
    await load();
  }

  async function removeItem(m: Media) {
    await supabase.from("media").delete().eq("id", m.id);
    await removeMedia(m.url);
    if (album?.cover_url === m.url) await update({ cover_url: null });
    else await load();
  }

  async function deleteAlbum() {
    if (!confirm("Delete this album and all its photos?")) return;
    await Promise.all(items.map((m) => removeMedia(m.url)));
    await supabase.from("albums").delete().eq("id", id!);
    navigate("/app/albums");
  }

  if (!album) return <Spinner full />;

  return (
    <div className="space-y-4">
      <Link to="/app/albums" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:underline"><ArrowLeft size={16} /> Albums</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{album.title}</h1>
          {album.description && <p className="text-slate-600">{album.description}</p>}
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <label className="btn-secondary cursor-pointer">
              <input type="checkbox" checked={album.is_public} onChange={(e) => update({ is_public: e.target.checked })} /> Public
            </label>
            <button className="btn-secondary" onClick={() => {
              const d = prompt("Album description", album.description ?? "");
              if (d !== null) void update({ description: d || null });
            }}>Describe</button>
            <ImagePicker multiple label={busy ? "Uploading…" : "Add photos"} onPick={upload} />
            <button className="btn-danger" onClick={deleteAlbum}><Trash2 size={16} /></button>
          </div>
        )}
      </div>
      {busy && <Spinner />}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((m) => (
          <div key={m.id} className="group relative aspect-square overflow-hidden rounded-lg bg-slate-200">
            {m.type === "video"
              ? <video src={m.url} controls className="h-full w-full object-cover" />
              : <img src={m.url} alt={m.caption ?? ""} loading="lazy" className="h-full w-full object-cover" />}
            {canEdit && (
              <div className="absolute inset-x-0 top-0 flex justify-end gap-1 p-1 opacity-0 transition group-hover:opacity-100">
                {m.type !== "video" && (
                  <button onClick={() => update({ cover_url: m.url })} className="rounded bg-black/60 p-1 text-white" title="Use as cover">
                    <Star size={16} fill={album.cover_url === m.url ? "currentColor" : "none"} />
                  </button>
                )}
                <button onClick={() => removeItem(m)} className="rounded bg-black/60 p-1 text-white" title="Delete"><Trash2 size={16} /></button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
