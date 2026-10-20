import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../auth/AuthProvider";
import type { Post } from "../../lib/types";
import PostComposer from "../../components/PostComposer";
import PostCard from "../../components/PostCard";
import Spinner from "../../components/Spinner";

export function usePosts(userId?: string) {
  const { profile } = useAuth();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [liked, setLiked] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    let q = supabase.from("posts").select("*, author:profiles(*)").order("created_at", { ascending: false }).limit(50);
    if (userId) q = q.eq("user_id", userId);
    const { data } = await q;
    const list = (data as Post[]) ?? [];
    setPosts(list);
    if (profile && list.length) {
      const { data: mine } = await supabase
        .from("reactions").select("post_id").eq("user_id", profile.id).in("post_id", list.map((p) => p.id));
      setLiked(new Set((mine ?? []).map((r) => r.post_id as string)));
    }
  }, [userId, profile]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel(`posts-${userId ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => void load())
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [load, userId]);

  return { posts, liked, reload: load };
}

export default function Feed() {
  const { posts, liked, reload } = usePosts();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PostComposer onPosted={reload} />
      {!posts && <Spinner full />}
      {posts?.length === 0 && <p className="py-12 text-center text-slate-500">No posts yet. Say hello!</p>}
      {posts?.map((p) => <PostCard key={p.id} post={p} liked={liked.has(p.id)} onChange={reload} />)}
    </div>
  );
}
