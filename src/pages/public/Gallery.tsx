import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { Album } from "../../lib/types";
import { AlbumGrid } from "./Home";

export default function Gallery() {
  const [albums, setAlbums] = useState<Album[] | null>(null);
  useEffect(() => {
    api.get<Album[]>("/api/public/albums").then(setAlbums).catch(() => setAlbums([]));
  }, []);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="mb-6 text-3xl font-semibold">Gallery</h1>
      {albums && albums.length === 0 && <p className="text-slate-500">No public albums yet.</p>}
      {albums && <AlbumGrid albums={albums} />}
    </div>
  );
}
