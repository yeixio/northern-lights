import { useEffect, useState } from "react";
import { Images } from "lucide-react";
import { api } from "../../lib/api";
import type { Album } from "../../lib/types";
import AlbumGrid from "../../components/AlbumGrid";
import Spinner from "../../components/Spinner";

export default function Gallery() {
  const [albums, setAlbums] = useState<Album[] | null>(null);
  useEffect(() => {
    api.get<Album[]>("/api/public/albums").then(setAlbums).catch(() => setAlbums([]));
  }, []);
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <p className="mb-3 text-sm font-semibold tracking-wider text-primary-600 uppercase">Gallery</p>
      <h1 className="mb-12 text-4xl font-semibold tracking-tight sm:text-5xl">Photo albums</h1>
      {!albums && <Spinner full />}
      {albums?.length === 0 && (
        <div className="card flex flex-col items-center gap-3 px-6 py-20 text-center text-ink-500">
          <Images size={32} className="text-ink-300" />
          No public albums yet. Check back soon.
        </div>
      )}
      {albums && albums.length > 0 && <AlbumGrid albums={albums} />}
    </div>
  );
}
