import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../auth/AuthProvider";
import { displayName, type Message, type Profile } from "../../lib/types";
import { timeAgo } from "../../lib/format";
import Avatar from "../../components/Avatar";

export default function Messages() {
  const { id: otherId } = useParams();
  const { profile: me } = useAuth();
  const [people, setPeople] = useState<Record<string, Profile>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!me) return;
    const { data } = await supabase
      .from("messages").select("*")
      .or(`sender_id.eq.${me.id},recipient_id.eq.${me.id}`)
      .order("created_at");
    setMessages((data as Message[]) ?? []);
  }, [me]);

  useEffect(() => {
    supabase.from("profiles").select("*").eq("is_approved", true).then(({ data }) => {
      setPeople(Object.fromEntries(((data as Profile[]) ?? []).map((p) => [p.id, p])));
    });
    void load();
    const channel = supabase
      .channel("messages")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => void load())
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [load]);

  // Latest message per conversation partner, newest first.
  const threads = useMemo(() => {
    const latest = new Map<string, Message>();
    for (const m of messages) {
      const other = m.sender_id === me?.id ? m.recipient_id : m.sender_id;
      latest.set(other, m);
    }
    return [...latest.entries()].sort((a, b) => b[1].created_at.localeCompare(a[1].created_at));
  }, [messages, me]);

  const conversation = messages.filter((m) => otherId && (m.sender_id === otherId || m.recipient_id === otherId));

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
    const unread = conversation.filter((m) => m.recipient_id === me?.id && !m.read).map((m) => m.id);
    if (unread.length) void supabase.from("messages").update({ read: true }).in("id", unread);
  }, [conversation.length, otherId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!me || !otherId || !draft.trim()) return;
    await supabase.from("messages").insert({ sender_id: me.id, recipient_id: otherId, content: draft.trim() });
    setDraft("");
    await load();
  }

  const other = otherId ? people[otherId] : undefined;
  const newPeople = Object.values(people).filter((p) => p.id !== me?.id && !threads.some(([id]) => id === p.id));

  return (
    <div className="card flex h-[calc(100vh-9rem)] overflow-hidden">
      <aside className={`${otherId ? "hidden sm:block" : "block"} w-full overflow-y-auto border-r border-slate-200 sm:w-72`}>
        <h1 className="p-4 text-lg font-semibold">Messages</h1>
        {threads.map(([id, m]) => (
          <Link key={id} to={`/app/messages/${id}`} className={`flex gap-3 px-4 py-3 hover:bg-slate-50 ${id === otherId ? "bg-emerald-50" : ""}`}>
            <Avatar profile={people[id]} />
            <div className="min-w-0 flex-1">
              <div className="flex justify-between gap-2">
                <span className={`truncate ${!m.read && m.recipient_id === me?.id ? "font-bold" : "font-medium"}`}>{displayName(people[id])}</span>
                <span className="shrink-0 text-xs text-slate-400">{timeAgo(m.created_at)}</span>
              </div>
              <p className="truncate text-sm text-slate-500">{m.content}</p>
            </div>
          </Link>
        ))}
        {newPeople.length > 0 && <p className="px-4 pt-4 pb-1 text-xs font-semibold text-slate-400 uppercase">Start a conversation</p>}
        {newPeople.map((p) => (
          <Link key={p.id} to={`/app/messages/${p.id}`} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50">
            <Avatar profile={p} size="sm" /> <span className="text-sm">{displayName(p)}</span>
          </Link>
        ))}
      </aside>
      {otherId ? (
        <section className="flex flex-1 flex-col">
          <header className="flex items-center gap-3 border-b border-slate-200 p-3">
            <Link to="/app/messages" className="text-sm text-slate-500 sm:hidden">Back</Link>
            <Avatar profile={other} size="sm" />
            <span className="font-medium">{displayName(other)}</span>
          </header>
          <div className="flex-1 space-y-2 overflow-y-auto p-4">
            {conversation.map((m) => (
              <div key={m.id} className={`flex ${m.sender_id === me?.id ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${m.sender_id === me?.id ? "bg-emerald-600 text-white" : "bg-slate-100"}`}>
                  {m.content}
                </div>
              </div>
            ))}
            <div ref={bottom} />
          </div>
          <form onSubmit={send} className="flex gap-2 border-t border-slate-200 p-3">
            <input className="input" placeholder="Type a message" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <button className="btn-primary" disabled={!draft.trim()}>Send</button>
          </form>
        </section>
      ) : (
        <section className="hidden flex-1 items-center justify-center text-slate-400 sm:flex">Pick a conversation</section>
      )}
    </div>
  );
}
