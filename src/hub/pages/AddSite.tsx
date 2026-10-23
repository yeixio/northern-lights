import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { QrCode } from "lucide-react";
import Spinner from "../../components/Spinner";
import { SiteLogo } from "../SiteBadge";
import { acceptInvite, fetchInfo, inviteFor, login, pair, siteAddress, type Site, type SiteInfo } from "../sites";

type Step =
  | { kind: "address" }
  | { kind: "pairing"; address: string }
  | { kind: "login"; info: SiteInfo }
  | { kind: "invite"; info: SiteInfo; token: string; email: string; message: string | null };

/** An invite link from a site, e.g. https://family.example.org/welcome?token=…. */
function parseInvite(text: string) {
  try {
    const url = new URL(text.trim());
    const token = url.searchParams.get("token");
    return url.pathname === "/welcome" && token ? { address: url.origin, token } : null;
  } catch {
    return null;
  }
}

const preview = (info: SiteInfo) => ({ url: info.url, info } as Site);

/**
 * Adding a site, three ways: the QR code from a site's "Get the app" page
 * (opened as /add#instance=…&code=…), an invite link, or an address plus
 * email and password.
 */
export default function AddSite() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState<Step>({ kind: "address" });
  const [input, setInput] = useState(params.get("site") ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  const done = (site: Site) => navigate(`/?site=${encodeURIComponent(site.url)}`, { replace: true });

  async function attempt(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // A scanned QR code: sign in straight away, then drop the code from the address bar.
  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const instance = hash.get("instance");
    const code = hash.get("code");
    const invite = hash.get("invite");
    history.replaceState(null, "", window.location.pathname + window.location.search);
    if (instance && code) {
      const address = siteAddress(instance);
      setStep({ kind: "pairing", address });
      void attempt(async () => done(await pair(address, code)));
    } else if (invite) {
      setInput(invite);
      void next(invite);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function next(text = input) {
    return attempt(async () => {
      const inv = parseInvite(text);
      if (inv) {
        const [info, details] = await Promise.all([fetchInfo(inv.address), inviteFor(inv.address, inv.token)]);
        setStep({ kind: "invite", info, token: inv.token, ...details });
        return;
      }
      let address: string;
      try {
        address = siteAddress(text);
      } catch {
        throw new Error("Enter a site address like family.example.org");
      }
      setStep({ kind: "login", info: await fetchInfo(address) });
    });
  }

  if (step.kind === "pairing") {
    return (
      <div className="mx-auto max-w-md space-y-4 py-12 text-center">
        {busy ? <Spinner full /> : error && (
          <>
            <p className="text-rose-600">{error}</p>
            <button className="btn-secondary" onClick={() => (setError(null), setStep({ kind: "address" }))}>Add the site another way</button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Add a site</h1>
        <p className="text-ink-600">See every Northern Lights site you belong to in one place.</p>
      </div>

      {step.kind === "address" && (
        <>
          <div className="card flex gap-3 p-4 text-sm text-ink-600">
            <QrCode className="shrink-0 text-primary-700" size={28} />
            <p>
              <strong className="text-ink-900">Fastest:</strong> on the site, open the menu and choose <strong>Get the app</strong>,
              then point your phone's camera at the code. You'll be signed in without typing anything.
            </p>
          </div>
          <form className="card space-y-3 p-4" onSubmit={(e) => (e.preventDefault(), void next())}>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Site address or invite link</span>
              <input className="input" autoFocus placeholder="family.example.org" value={input} onChange={(e) => setInput(e.target.value)} />
            </label>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <button className="btn-primary w-full" disabled={busy || !input.trim()}>{busy ? "Checking…" : "Continue"}</button>
          </form>
        </>
      )}

      {step.kind === "login" && (
        <form
          className="card space-y-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void attempt(async () => done(await login(step.info.url, email, password)));
          }}
        >
          <div className="flex items-center gap-3">
            <SiteLogo site={preview(step.info)} className="h-10 w-10" />
            <div className="min-w-0">
              <div className="truncate font-semibold">{step.info.name}</div>
              <div className="truncate text-sm text-ink-500">{new URL(step.info.url).host}</div>
            </div>
          </div>
          <input className="input" type="email" autoComplete="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input" type="password" autoComplete="current-password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Signing in…" : `Sign in to ${step.info.name}`}</button>
          <button type="button" className="btn-ghost w-full" onClick={() => setStep({ kind: "address" })}>Back</button>
        </form>
      )}

      {step.kind === "invite" && (
        <form
          className="card space-y-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void attempt(async () => done(await acceptInvite(step.info.url, { token: step.token, password, first_name: first, last_name: last })));
          }}
        >
          <div className="flex items-center gap-3">
            <SiteLogo site={preview(step.info)} className="h-10 w-10" />
            <div className="min-w-0">
              <div className="truncate font-semibold">Join {step.info.name}</div>
              <div className="truncate text-sm text-ink-500">as {step.email}</div>
            </div>
          </div>
          {step.message && <p className="rounded-lg bg-ink-100 px-3 py-2 text-sm italic">"{step.message}"</p>}
          <div className="flex gap-2">
            <input className="input" required placeholder="First name" value={first} onChange={(e) => setFirst(e.target.value)} />
            <input className="input" required placeholder="Last name" value={last} onChange={(e) => setLast(e.target.value)} />
          </div>
          <input className="input" type="password" autoComplete="new-password" required minLength={8} placeholder="Choose a password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Joining…" : `Join ${step.info.name}`}</button>
          <button type="button" className="btn-ghost w-full" onClick={() => setStep({ kind: "address" })}>Back</button>
        </form>
      )}
    </div>
  );
}
