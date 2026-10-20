import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useSiteSettings } from "../../lib/useSiteSettings";
import type { Album, PublicPost } from "../../lib/types";
import { timeAgo } from "../../lib/format";
import MediaGrid from "../../components/MediaGrid";

export default function Home() {
  const settings = useSiteSettings();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [posts, setPosts] = useState<PublicPost[]>([]);

  useEffect(() => {
    api.get<Album[]>("/api/public/albums").then((a) => setAlbums(a.slice(0, 6))).catch(() => undefined);
    api.get<PublicPost[]>("/api/public/posts").then(setPosts).catch(() => undefined);
  }, []);

  return (
    <>
      <section className="aurora-bg relative overflow-hidden text-white">
        {settings?.hero_image_url && (
          <img src={settings.hero_image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
        )}
        <div className="relative mx-auto max-w-5xl px-4 py-24 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">{settings?.site_name ?? "Northern Lights"}</h1>
          {settings?.tagline && <p className="mt-4 text-lg text-white/80 sm:text-xl">{settings.tagline}</p>}
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-16 px-4 py-12">
        {settings?.about && (
          <section className="mx-auto max-w-3xl">
            <h2 className="mb-4 text-2xl font-semibold">About</h2>
            <p className="whitespace-pre-wrap text-lg leading-relaxed text-slate-700">{settings.about}</p>
          </section>
        )}

        {albums.length > 0 && (
          <section>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-2xl font-semibold">Photos</h2>
              <Link to="/gallery" className="text-sm text-emerald-700 hover:underline">See all</Link>
            </div>
            <AlbumGrid albums={albums} />
          </section>
        )}

        {posts.length > 0 && (
          <section className="mx-auto max-w-2xl">
            <h2 className="mb-4 text-2xl font-semibold">Updates</h2>
            <div className="space-y-6">
              {posts.map((p) => (
                <article key={p.id} className="card space-y-3 p-5">
                  <p className="text-xs text-slate-500">{timeAgo(p.created_at)}</p>
                  {p.content && <p className="whitespace-pre-wrap">{p.content}</p>}
                  <MediaGrid urls={p.media_urls} />
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

export function AlbumGrid({ albums, base = "/gallery" }: { albums: Album[]; base?: string }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {albums.map((a) => (
        <Link key={a.id} to={`${base}/${a.id}`} className="group card overflow-hidden">
          <div className="aspect-[4/3] bg-slate-200">
            {a.cover_url && <img src={a.cover_url} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />}
          </div>
          <div className="p-3">
            <h3 className="font-medium">{a.title}</h3>
            {a.description && <p className="line-clamp-2 text-sm text-slate-500">{a.description}</p>}
          </div>
        </Link>
      ))}
    </div>
  );
}
