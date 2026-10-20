import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { displayName, type Profile } from "../../lib/types";
import Avatar from "../../components/Avatar";

export default function People() {
  const [people, setPeople] = useState<Profile[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => {
    api.get<Profile[]>("/api/people").then(setPeople);
  }, []);
  const shown = people.filter((p) => displayName(p).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">People</h1>
        <input className="input max-w-xs" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((p) => (
          <Link key={p.id} to={`/app/people/${p.id}`} className="card flex items-center gap-3 p-4 hover:border-primary-300">
            <Avatar profile={p} />
            <div className="min-w-0">
              <div className="truncate font-medium">{displayName(p)}</div>
              {p.bio && <div className="truncate text-sm text-ink-500">{p.bio}</div>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
