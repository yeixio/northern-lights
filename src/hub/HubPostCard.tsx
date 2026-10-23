import { useState } from "react";
import { Heart, MessageCircle, Trash2 } from "lucide-react";
import Avatar from "../components/Avatar";
import MediaGrid from "../components/MediaGrid";
import { timeAgo } from "../lib/format";
import { displayName, type Comment } from "../lib/types";
import type { FeedPost } from "./feed";
import SiteBadge from "./SiteBadge";
import { call, withSiteAuthor } from "./sites";

/** A post in the combined feed. Every action goes to the site the post came from. */
export default function HubPostCard({ post, onChange }: { post: FeedPost; onChange: () => void }) {
  const { site } = post;
  const me = site.user;
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const canDelete = me.id === post.user_id || me.is_admin;

  async function act(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const loadComments = () => act(async () => {
    const rows = await call<Comment[]>(site, "GET", `/api/posts/${post.id}/comments`);
    setComments(rows.map((c) => ({ ...c, author: withSiteAuthor(site, c.author) })));
  });

  const toggleLike = () => act(async () => {
    await call(site, post.liked ? "DELETE" : "POST", `/api/posts/${post.id}/like`);
    onChange();
  });

  const addComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    void act(async () => {
      await call(site, "POST", `/api/posts/${post.id}/comments`, { content: draft });
      setDraft("");
      await loadComments();
      onChange();
    });
  };

  const deleteComment = (id: string) => act(async () => {
    await call(site, "DELETE", `/api/comments/${id}`);
    await loadComments();
    onChange();
  });

  const deletePost = () => {
    if (!confirm("Delete this post?")) return;
    void act(async () => {
      await call(site, "DELETE", `/api/posts/${post.id}`);
      onChange();
    });
  };

  return (
    <article className="card space-y-3 p-4">
      <header className="flex items-center gap-3">
        <Avatar profile={post.author} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{displayName(post.author)}</div>
          <div className="flex min-w-0 items-center gap-1 text-xs text-ink-500">
            <SiteBadge site={site} />
            <span>·</span>
            <span className="shrink-0">{timeAgo(post.created_at)}</span>
          </div>
        </div>
        {canDelete && (
          <button onClick={deletePost} className="text-ink-400 hover:text-rose-600" aria-label="Delete post">
            <Trash2 size={18} />
          </button>
        )}
      </header>

      {post.content && <p className="whitespace-pre-wrap">{post.content}</p>}
      <MediaGrid urls={post.media_urls} />

      <div className="flex gap-4 border-t border-ink-100 pt-2 text-sm text-ink-600">
        <button onClick={toggleLike} className={`flex items-center gap-1 ${post.liked ? "text-rose-600" : "hover:text-rose-600"}`}>
          <Heart size={18} fill={post.liked ? "currentColor" : "none"} /> {post.like_count}
        </button>
        <button onClick={() => (comments ? setComments(null) : void loadComments())} className="flex items-center gap-1 hover:text-primary-700">
          <MessageCircle size={18} /> {post.comment_count}
        </button>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}

      {comments && (
        <div className="space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2">
              <Avatar profile={c.author} size="sm" />
              <div className="flex-1 rounded-lg bg-ink-100 px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{displayName(c.author)}</span>
                  <span className="text-xs text-ink-500">{timeAgo(c.created_at)}</span>
                  {(me.id === c.user_id || me.is_admin) && (
                    <button onClick={() => deleteComment(c.id)} className="ml-auto text-ink-400 hover:text-rose-600" aria-label="Delete comment">
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
