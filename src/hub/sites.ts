import { useSyncExternalStore } from "react";
import type { Author, Profile } from "../lib/types";
import { keep } from "./native";

// The Northern Lights app keeps one sign-in per site and talks to each site's
// own API directly (docs/app-api.md). This file holds that list of sites and
// a small client for calling them.

/** What a site says about itself at /.well-known/northern-lights. */
export interface SiteInfo {
  software: "northern-lights";
  api: number;
  features: string[];
  url: string;
  name: string;
  tagline: string | null;
  logo_url: string | null;
  theme: { preset: string; primary: string | null };
}

export interface Site {
  /** The site's address, e.g. https://family.example.org. Unique in the list. */
  url: string;
  token: string;
  info: SiteInfo;
  user: Profile;
  /** Set when the site no longer accepts the token. */
  signedOut?: boolean;
  /** When the person last looked at this site's news, for the "new" badges. */
  seenAt: string;
}

const KEY = "nl-hub-sites";
const MIN_API = 1;

function read(): Site[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Site[];
  } catch {
    return [];
  }
}

let sites = read();
const listeners = new Set<() => void>();

function write(next: Site[]) {
  sites = next;
  keep(KEY, JSON.stringify(next));
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private windows can refuse storage; the list still works until the tab closes.
  }
  listeners.forEach((fn) => fn());
}

export const getSites = () => sites;

export function useSites() {
  return useSyncExternalStore((fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, getSites);
}

export function saveSite(site: Site) {
  write([...sites.filter((s) => s.url !== site.url), site]);
}

export function updateSite(url: string, change: Partial<Site>) {
  write(sites.map((s) => (s.url === url ? { ...s, ...change } : s)));
}

export async function removeSite(site: Site) {
  // Sign this device out on the site too; if it can't be reached, forget it anyway.
  await call(site, "POST", "/api/auth/logout").catch(() => undefined);
  write(sites.filter((s) => s.url !== site.url));
}

// ---- talking to a site ------------------------------------------------------

export class SiteError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Turns what someone typed ("family.example.org") into a site address. */
export function siteAddress(input: string) {
  const text = input.trim();
  const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  const url = new URL(withScheme);
  return url.origin;
}

async function request<T>(base: string, method: string, path: string, body?: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const init: RequestInit = { method, headers, credentials: "omit" };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    init.body = JSON.stringify(body);
    headers["Content-Type"] = "application/json";
  }
  let res: Response;
  try {
    res = await fetch(base + path, init);
  } catch {
    throw new SiteError(`Can't reach ${new URL(base).host}`, 0);
  }
  const data = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
  if (!res.ok) throw new SiteError(data?.error ?? `Request failed (${res.status})`, res.status);
  return data as T;
}

/** Calls a signed-in site. A refused token marks the site as signed out. */
export async function call<T = { ok: true }>(site: Site, method: string, path: string, body?: unknown): Promise<T> {
  try {
    return await request<T>(site.url, method, path, body, site.token);
  } catch (err) {
    if (err instanceof SiteError && err.status === 401 && !site.signedOut) updateSite(site.url, { signedOut: true });
    throw err;
  }
}

/** Absolute address for a link the site returned, such as /files/abc.jpg?exp=…&sig=…. */
export const abs = (site: Site | { url: string }, url: string | null) => (url && url.startsWith("/") ? site.url + url : url);

/** Rewrites an author's avatar so it loads from the right site. */
export const withSiteAuthor = <T extends Author>(site: Site, a: T): T => ({ ...a, avatar_url: abs(site, a.avatar_url) });

export async function fetchInfo(address: string): Promise<SiteInfo> {
  const info = await request<SiteInfo>(address, "GET", "/.well-known/northern-lights").catch((err) => {
    if (err instanceof SiteError && err.status === 404) {
      throw new SiteError("This site needs an update before it can be added to the app", 404);
    }
    throw err;
  });
  if (info.software !== "northern-lights") throw new SiteError("That address isn't a Northern Lights site", 400);
  if (info.api < MIN_API) throw new SiteError("This site needs an update before it can be added to the app", 400);
  return { ...info, url: address };
}

/** A name for this device on the site's "Your devices" list. */
export function deviceName() {
  const ua = navigator.userAgent;
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android"
    : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : null;
  return os ? `Northern Lights app on ${os}` : "Northern Lights app";
}

type SignIn = { token: string; user: Profile; instance: SiteInfo };

function signedIn(address: string, res: SignIn): Site {
  const site: Site = { url: address, token: res.token, info: { ...res.instance, url: address }, user: res.user, seenAt: new Date().toISOString() };
  saveSite(site);
  return site;
}

export async function pair(address: string, code: string) {
  return signedIn(address, await request<SignIn>(address, "POST", "/api/app/pair", { code, device_name: deviceName() }));
}

export async function login(address: string, email: string, password: string) {
  return signedIn(address, await request<SignIn>(address, "POST", "/api/app/login", { email, password, device_name: deviceName() }));
}

export async function inviteFor(address: string, token: string) {
  return request<{ email: string; message: string | null }>(address, "GET", `/api/auth/invitations/${encodeURIComponent(token)}`);
}

export async function acceptInvite(address: string, body: { token: string; password: string; first_name: string; last_name: string }) {
  return signedIn(address, await request<SignIn>(address, "POST", "/api/app/invitations/accept", { ...body, device_name: deviceName() }));
}
