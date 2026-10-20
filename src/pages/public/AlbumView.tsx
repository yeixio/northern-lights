import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, X } from "lucide-react";
import { api } from "../../lib/api";
import type { AlbumWithMedia, Media } from "../../lib/types";
import Spinner from "../../components/Spinner";

/** Read-only public album page. */
export default function AlbumView() {
  const { id } = useParams();
  const [album, setAlbum] = useState<AlbumWithMedia | null | undefined>(undefined);
  const [open, setOpen] = useState<Media | null>(null);

  useEffect(() => {
    api.get<AlbumWithMedia>(`/api/public/albums/${id}`).then(setAlbum).catch(() => setAlbum(null));
  }, [id]);

  if (album === undefined) return <Spinner full />;
  if (album === null) return <p className="p-12 text-center text-slate-500">Album not found.</p>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link to="/gallery" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:underline">
        <ArrowLeft size={16} /> Back
      </Link>
      <h1 className="text-3xl font-semibold">{album.title}</h1>
      {album.description && <p className="mt-2 text-slate-600">{album.description}</p>}
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {album.media.map((m) => (
          <button key={m.id} onClick={() => setOpen(m)} className="aspect-square overflow-hidden rounded-lg bg-slate-200">
            {m.type === "video"
              ? <video src={m.url} className="h-full w-full object-cover" muted />
              : <img src={m.url} alt={m.caption ?? ""} loading="lazy" className="h-full w-full object-cover" />}
          </button>
        ))}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4" onClick={() => setOpen(null)}>
          <button className="absolute top-4 right-4 text-white" aria-label="Close"><X /></button>
          {open.type === "video"
            ? <video src={open.url} controls autoPlay className="max-h-[85vh] max-w-full" onClick={(e) => e.stopPropagation()} />
            : <img src={open.url} alt={open.caption ?? ""} className="max-h-[85vh] max-w-full object-contain" />}
          {open.caption && <p className="mt-3 text-white/80">{open.caption}</p>}
        </div>
      )}
    </div>
  );
}
