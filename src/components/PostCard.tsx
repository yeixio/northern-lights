import { useState } from "react";
import { Link } from "react-router-dom";
import { Globe, Heart, MessageCircle, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { displayName, type Comment, type Post } from "../lib/types";
import { timeAgo } from "../lib/format";
import Avatar from "./Avatar";
import MediaGrid from "./MediaGrid";

export default function PostCard({ post, onChange }: { post: Post; onChange: () => void }) {
  const { user: profile } = useAuth();
  const liked = post.liked;
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [draft, setDraft] = useState("");
  const canDelete = profile && (profile.id === post.user_id || profile.is_admin);

  async function toggleLike() {
    if (liked) await api.del(`/api/posts/${post.id}/like`);
    else await api.post(`/api/posts/${post.id}/like`);
    onChange();
  }

  async function loadComments() {
    setComments(await api.get<Comment[]>(`/api/posts/${post.id}/comments`));
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    await api.post(`/api/posts/${post.id}/comments`, { content: draft });
    setDraft("");
    await loadComments();
    onChange();
  }

  async function deleteComment(id: string) {
    await api.del(`/api/comments/${id}`);
    await loadComments();
    onChange();
  }

  async function deletePost() {
    if (!confirm("Delete this post?")) return;
    await api.del(`/api/posts/${post.id}`);
    onChange();
  }

  return (
    <article className="card space-y-3 p-4">
      <header className="flex items-center gap-3">
        <Link to={`/app/people/${post.user_id}`}><Avatar profile={post.author} /></Link>
        <div className="min-w-0 flex-1">
          <Link to={`/app/people/${post.user_id}`} className="font-semibold hover:underline">
            {displayName(post.author)}
          </Link>
          <div className="flex items-center gap-1 text-xs text-slate-500">
            {timeAgo(post.created_at)}
            {post.is_public && <><span>·</span><Globe size={12} /> Public</>}
          </div>
        </div>
        {canDelete && (
          <button onClick={deletePost} className="text-slate-400 hover:text-rose-600" aria-label="Delete post">
            <Trash2 size={18} />
          </button>
        )}
      </header>

      {post.content && <p className="whitespace-pre-wrap">{post.content}</p>}
      <MediaGrid urls={post.media_urls} />

      <div className="flex gap-4 border-t border-slate-100 pt-2 text-sm text-slate-600">
        <button onClick={toggleLike} className={`flex items-center gap-1 ${liked ? "text-rose-600" : "hover:text-rose-600"}`}>
          <Heart size={18} fill={liked ? "currentColor" : "none"} /> {post.like_count}
        </button>
        <button
          onClick={() => (comments ? setComments(null) : void loadComments())}
          className="flex items-center gap-1 hover:text-emerald-700"
        >
          <MessageCircle size={18} /> {post.comment_count}
        </button>
      </div>

      {comments && (
        <div className="space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2">
              <Avatar profile={c.author} size="sm" />
              <div className="flex-1 rounded-lg bg-slate-100 px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{displayName(c.author)}</span>
                  <span className="text-xs text-slate-500">{timeAgo(c.created_at)}</span>
                  {(profile?.id === c.user_id || profile?.is_admin) && (
                    <button onClick={() => deleteComment(c.id)} className="ml-auto text-slate-400 hover:text-rose-600" aria-label="Delete comment">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <p className="whitespace-pre-wrap">{c.content}</p>
              </div>
            </div>
          ))}
          <form onSubmit={addComment} className="flex gap-2">
            <input className="input" placeholder="Write a comment…" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <button className="btn-primary" disabled={!draft.trim()}>Send</button>
          </form>
        </div>
      )}
    </article>
  );
}
