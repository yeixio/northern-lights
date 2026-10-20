import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import { api } from "../../lib/api";
import type { Album } from "../../lib/types";
import { AlbumGrid } from "../public/Home";

export default function Albums() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  const load = () => api.get<Album[]>("/api/albums").then(setAlbums);
  useEffect(() => void load(), []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await api.post("/api/albums", { title, is_public: isPublic });
    setTitle("");
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Albums</h1>
        <Link to="/app/import/facebook" className="btn-secondary"><Download size={16} /> Import from Facebook</Link>
      </div>
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
