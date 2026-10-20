import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useLive } from "../../lib/live";
import type { Post } from "../../lib/types";
import PostComposer from "../../components/PostComposer";
import PostCard from "../../components/PostCard";
import Spinner from "../../components/Spinner";

export function usePosts(authorId?: string) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const load = useCallback(async () => {
    setPosts(await api.get<Post[]>(`/api/posts${authorId ? `?author=${authorId}` : ""}`));
  }, [authorId]);
  useEffect(() => void load(), [load]);
  useLive("posts", () => void load());
  return { posts, reload: load };
}

export default function Feed() {
  const { posts, reload } = usePosts();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PostComposer onPosted={reload} />
      {!posts && <Spinner full />}
      {posts?.length === 0 && <p className="py-12 text-center text-ink-500">No posts yet. Say hello!</p>}
      {posts?.map((p) => <PostCard key={p.id} post={p} onChange={reload} />)}
    </div>
  );
}
