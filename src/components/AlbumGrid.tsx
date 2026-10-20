import { Link } from "react-router-dom";
import { Images } from "lucide-react";
import type { Album } from "../lib/types";

export default function AlbumGrid({ albums, base = "/gallery" }: { albums: Album[]; base?: string }) {
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3">
      {albums.map((a) => (
        <Link key={a.id} to={`${base}/${a.id}`} className="group block text-ink-900">
          <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-ink-200 shadow-sm ring-1 ring-ink-950/5">
            {a.cover_url ? (
              <img src={a.cover_url} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
            ) : (
              <div className="flex h-full items-center justify-center text-ink-400"><Images size={28} /></div>
            )}
          </div>
          <h3 className="mt-3 font-semibold group-hover:text-primary-700">{a.title}</h3>
          {a.description && <p className="mt-0.5 line-clamp-2 text-sm text-ink-500">{a.description}</p>}
        </Link>
      ))}
    </div>
  );
}
