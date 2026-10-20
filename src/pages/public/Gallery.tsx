import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { Album } from "../../lib/types";
import { AlbumGrid } from "./Home";

export default function Gallery() {
  const [albums, setAlbums] = useState<Album[] | null>(null);
  useEffect(() => {
    supabase.from("albums").select("*").eq("is_public", true).order("created_at", { ascending: false })
      .then(({ data }) => setAlbums((data as Album[]) ?? []));
  }, []);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="mb-6 text-3xl font-semibold">Gallery</h1>
      {albums && albums.length === 0 && <p className="text-slate-500">No public albums yet.</p>}
      {albums && <AlbumGrid albums={albums} />}
    </div>
  );
}
