import { useEffect, useState } from "react";
import { Smartphone, Trash2 } from "lucide-react";
import { renderSVG } from "uqr";
import { api, errorText } from "../../lib/api";
import { timeAgo } from "../../lib/format";

interface Device {
  id: string;
  device_name: string | null;
  created_at: string;
  last_used_at: string | null;
}

interface Pairing {
  link: string;
  expires_at: string;
  /** How many devices were signed in when the code was shown. */
  before: number;
}

/** Shows a one-time QR code that signs the Northern Lights app in, and the devices already signed in. */
export default function GetApp() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [left, setLeft] = useState(0);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => api.get<Device[]>("/api/me/devices").then((list) => {
    setDevices(list);
    return list;
  });
  useEffect(() => void load(), []);

  // While a code is showing, count down and watch for the app to sign in.
  useEffect(() => {
    if (!pairing) return;
    const tick = () => {
      const ms = Date.parse(pairing.expires_at) - Date.now();
      setLeft(Math.max(0, Math.ceil(ms / 1000)));
      if (ms <= 0) setPairing(null);
    };
    tick();
    const timer = setInterval(tick, 1000);
    const poll = setInterval(() => void load().then((list) => {
      if (list.length > pairing.before) {
        setConnected(true);
        setPairing(null);
      }
    }), 3000);
    return () => {
      clearInterval(timer);
      clearInterval(poll);
    };
  }, [pairing]);

  async function showCode() {
    setError(null);
    setConnected(false);
    try {
      const code = await api.post<Omit<Pairing, "before">>("/api/app/pairing");
      setPairing({ ...code, before: devices.length });
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function remove(id: string) {
    await api.del(`/api/me/devices/${id}`);
    await load();
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Get the app</h1>
        <p className="text-ink-600">
          The Northern Lights app shows this site together with any other Northern Lights sites you belong to, in one feed.
          Scan a code here to add this site to it without typing a password.
        </p>
      </div>

      <section className="card space-y-4 p-4">
        {pairing ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <div
              className="w-56 overflow-hidden rounded-lg border border-ink-200"
              aria-label="QR code for the Northern Lights app"
              role="img"
              dangerouslySetInnerHTML={{ __html: renderSVG(pairing.link) }}
            />
            <p className="text-sm text-ink-600">
              Open the Northern Lights app, tap <strong>Add a site</strong> and scan this code.
              It works once and expires in {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}.
            </p>
            <a className="text-sm font-medium text-primary-700 hover:underline" href={pairing.link}>
              On this phone? Open the app instead
            </a>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <Smartphone className="shrink-0 text-ink-400" size={32} />
            <p className="flex-1 text-sm text-ink-600">
              {connected ? "Your app is connected. You can close this page." : "Show a code to connect a phone, tablet or computer."}
            </p>
            <button className="btn-primary" onClick={showCode}>{connected ? "Connect another" : "Show a code"}</button>
          </div>
        )}
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </section>

      {devices.length > 0 && (
        <section className="card divide-y divide-ink-100">
          <h2 className="p-4 font-semibold">Your devices</h2>
          {devices.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
              <span className="truncate">{d.device_name ?? "Northern Lights app"}</span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="text-ink-400">Used {timeAgo(d.last_used_at ?? d.created_at)}</span>
                <button onClick={() => remove(d.id)} className="text-ink-400 hover:text-rose-600" aria-label={`Sign out ${d.device_name ?? "device"}`}>
                  <Trash2 size={14} />
                </button>
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
