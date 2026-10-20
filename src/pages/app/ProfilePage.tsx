import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Mail } from "lucide-react";
import { api, errorText } from "../../lib/api";
import { uploadFiles } from "../../lib/storage";
import { useAuth } from "../../auth/AuthProvider";
import { displayName, type Profile } from "../../lib/types";
import Avatar from "../../components/Avatar";
import ImagePicker from "../../components/ImagePicker";
import PostCard from "../../components/PostCard";
import Spinner from "../../components/Spinner";
import { usePosts } from "./Feed";

export default function ProfilePage() {
  const { id } = useParams();
  const { user: me, refresh } = useAuth();
  const [person, setPerson] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", display_name: "", bio: "" });
  const { posts, reload } = usePosts(id);
  const isMe = me?.id === id;

  useEffect(() => {
    api.get<Profile>(`/api/people/${id}`).then((p) => {
      setPerson(p);
      setForm({ first_name: p.first_name, last_name: p.last_name, display_name: p.display_name ?? "", bio: p.bio ?? "" });
    });
  }, [id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      setPerson(await api.patch<Profile>("/api/me", form));
      setEditing(false);
      await refresh();
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function changeAvatar([file]: File[]) {
    if (!file) return;
    try {
      const [up] = await uploadFiles([file]);
      setPerson(await api.patch<Profile>("/api/me", { avatar_url: up.url }));
      await refresh();
    } catch (err) {
      setError(errorText(err));
    }
  }

  if (!person) return <Spinner full />;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <section className="card overflow-hidden">
        <div className="aurora-bg h-28" />
        <div className="-mt-12 space-y-3 p-4">
          <div className="flex items-end justify-between">
            <div className="rounded-full ring-4 ring-white"><Avatar profile={person} size="lg" /></div>
            <div className="flex gap-2">
              {isMe ? (
                <>
                  <ImagePicker label="Photo" onPick={changeAvatar} />
                  <button className="btn-secondary" onClick={() => setEditing(!editing)}>Edit profile</button>
                </>
              ) : (
                <Link to={`/app/messages/${person.id}`} className="btn-primary"><Mail size={16} /> Message</Link>
              )}
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{displayName(person)}</h1>
            {person.bio && <p className="mt-1 whitespace-pre-wrap text-slate-600">{person.bio}</p>}
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          {editing && (
            <form onSubmit={save} className="space-y-2 border-t border-slate-100 pt-3">
              <div className="grid grid-cols-2 gap-2">
                <input className="input" placeholder="First name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                <input className="input" placeholder="Last name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              </div>
              <input className="input" placeholder="Display name (optional)" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
              <textarea className="input" placeholder="Bio" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
              <button className="btn-primary">Save</button>
            </form>
          )}
        </div>
      </section>
      {posts?.map((p) => <PostCard key={p.id} post={p} onChange={reload} />)}
    </div>
  );
}
