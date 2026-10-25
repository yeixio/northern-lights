import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, PenSquare } from "lucide-react";
import Avatar from "../../components/Avatar";
import Spinner from "../../components/Spinner";
import { Modal } from "../../components/ui";
import { timeAgo } from "../../lib/format";
import { displayName, type Profile } from "../../lib/types";
import { useInbox } from "../inbox";
import SiteBadge from "../SiteBadge";
import { call, useSites, withSiteAuthor, type Site } from "../sites";

/** Every conversation on every site in one inbox. ?c=<site url> <person id> opens one. */
export default function HubMessages() {
  const sites = useSites().filter((s) => !s.signedOut);
  const { conversations, errors, reload, loading } = useInbox(sites);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const open = params.get("c");
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  // A conversation can be opened before it has any messages (from "New message").
  const [openSite, personId] = open ? [open.slice(0, open.lastIndexOf(" ")), open.slice(open.lastIndexOf(" ") + 1)] : [null, null];
  const current = conversations.find((c) => c.key === open);
  const site = sites.find((s) => s.url === openSite);
  const [newPerson, setNewPerson] = useState<Profile | null>(null);
  const person = current?.person ?? (newPerson?.id === personId ? newPerson : null);

  // Reading a conversation marks it read on its site.
  useEffect(() => {
    if (!current || !site) return;
    const ids = current.messages.filter((m) => m.recipient_id === site.user.id && !m.read).map((m) => m.id);
    if (ids.length) void call(site, "POST", "/api/messages/read", { ids });
    bottom.current?.scrollIntoView();
  }, [current?.messages.length, open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!site || !personId || !draft.trim()) return;
    setError(null);
    try {
      await call(site, "POST", "/api/messages", { recipient_id: personId, content: draft });
      setDraft("");
      await reload(site);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const list = (
    <section className={`card divide-y divide-ink-100 overflow-hidden ${open ? "hidden lg:block" : ""}`}>
      <div className="flex items-center justify-between p-4">
        <h1 className="font-semibold">Messages</h1>
        <button className="btn-ghost px-2" onClick={() => setPicking(true)} aria-label="New message"><PenSquare size={18} /></button>
      </div>
      {Object.entries(errors).map(([url, msg]) => <p key={url} className="px-4 py-2 text-sm text-ink-500">{msg}</p>)}
      {loading && conversations.length === 0 && <div className="flex justify-center p-6"><Spinner /></div>}
      {!loading && conversations.length === 0 && <p className="p-4 text-sm text-ink-500">No messages yet.</p>}
      {conversations.map((c) => (
        <Link key={c.key} to={`/messages?c=${encodeURIComponent(c.key)}`} className={`flex gap-3 px-4 py-3 hover:bg-ink-50 ${c.key === open ? "bg-primary-50" : ""}`}>
          <Avatar profile={c.person} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`truncate ${c.unread ? "font-semibold" : "font-medium"}`}>{displayName(c.person)}</span>
              <span className="ml-auto shrink-0 text-xs text-ink-400">{timeAgo(c.last.created_at)}</span>
            </div>
            <div className="text-xs text-ink-500"><SiteBadge site={c.site} link={false} /></div>
            <p className={`truncate text-sm ${c.unread ? "text-ink-900" : "text-ink-500"}`}>{c.last.content}</p>
          </div>
          {c.unread > 0 && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-primary-600" aria-label={`${c.unread} unread`} />}
        </Link>
      ))}
    </section>
  );

  return (
    <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
      {list}
      {open && site && person ? (
        <section className="card flex h-[calc(100dvh-10rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col">
          <header className="flex items-center gap-3 border-b border-ink-100 p-4">
            <button className="btn-ghost px-2 lg:hidden" onClick={() => navigate("/messages")} aria-label="Back"><ArrowLeft size={18} /></button>
            <Avatar profile={person} size="sm" />
            <div className="min-w-0">
              <div className="truncate font-semibold">{displayName(person)}</div>
              <div className="text-xs text-ink-500"><SiteBadge site={site} /></div>
            </div>
          </header>
          <div className="flex-1 space-y-2 overflow-y-auto p-4">
            {current?.messages.map((m) => {
              const mine = m.sender_id === site.user.id;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : ""}`}>
                  <p className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary-600 text-on-primary" : "bg-ink-100"}`}>{m.content}</p>
                </div>
              );
            })}
            <div ref={bottom} />
          </div>
          <form onSubmit={send} className="flex gap-2 border-t border-ink-100 p-3">
            <input className="input" placeholder={`Message ${person.first_name}…`} value={draft} onChange={(e) => setDraft(e.target.value)} />
            <button className="btn-primary" disabled={!draft.trim()}>Send</button>
          </form>
          {error && <p className="px-3 pb-3 text-sm text-rose-600">{error}</p>}
        </section>
      ) : (
        <section className="card hidden items-center justify-center p-12 text-ink-500 lg:flex">Pick a conversation</section>
      )}
      {picking && (
        <NewMessage
          sites={sites}
          onClose={() => setPicking(false)}
          onPick={(s, p) => {
            setPicking(false);
            setNewPerson(p);
            navigate(`/messages?c=${encodeURIComponent(`${s.url} ${p.id}`)}`);
          }}
        />
      )}
    </div>
  );
}

/** Pick someone to write to, from the members of every site. */
function NewMessage({ sites, onClose, onPick }: { sites: Site[]; onClose: () => void; onPick: (site: Site, person: Profile) => void }) {
  const [people, setPeople] = useState<{ site: Site; person: Profile }[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    void Promise.all(sites.map(async (site) => {
      const rows = await call<Profile[]>(site, "GET", "/api/people").catch(() => []);
      return rows.filter((p) => p.id !== site.user.id).map((p) => ({ site, person: withSiteAuthor(site, p) }));
    })).then((all) => setPeople(all.flat()));
  }, [sites]);

  const shown = useMemo(() => (people ?? []).filter(({ person }) => displayName(person).toLowerCase().includes(query.toLowerCase())), [people, query]);

  return (
    <Modal title="New message" onClose={onClose}>
      <input className="input mb-3" autoFocus placeholder="Search people" value={query} onChange={(e) => setQuery(e.target.value)} />
      {!people && <div className="flex justify-center p-6"><Spinner /></div>}
      <div className="max-h-80 divide-y divide-ink-100 overflow-y-auto">
        {shown.map(({ site, person }) => (
          <button key={`${site.url} ${person.id}`} className="flex w-full items-center gap-3 px-1 py-2 text-left hover:bg-ink-50" onClick={() => onPick(site, person)}>
            <Avatar profile={person} size="sm" />
            <span className="min-w-0 flex-1 truncate">{displayName(person)}</span>
            <span className="max-w-[40%] text-xs text-ink-500"><SiteBadge site={site} link={false} /></span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
