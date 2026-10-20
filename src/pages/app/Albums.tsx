import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../auth/AuthProvider";
import type { Album } from "../../lib/types";
import { AlbumGrid } from "../public/Home";

export default function Albums() {
  const { profile } = useAuth();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  const load = () =>
    supabase.from("albums").select("*").order("created_at", { ascending: false })
      .then(({ data }) => setAlbums((data as Album[]) ?? []));
  useEffect(() => void load(), []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !title.trim()) return;
    await supabase.from("albums").insert({ title: title.trim(), owner_id: profile.id, is_public: isPublic });
    setTitle("");
    await load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Albums</h1>
      <form onSubmit={create} className="card flex flex-wrap items-center gap-2 p-4">
        <input className="input flex-1" placeholder="New album title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /> Show on public page
        </label>
        <button className="btn-primary" disabled={!title.trim()}>Create</button>
      </form>
      <AlbumGrid albums={albums} base="/app/albums" />
    </div>
  );
}
