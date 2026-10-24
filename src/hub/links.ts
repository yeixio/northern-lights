/**
 * The app's path for a link that opened it: a QR code or "Open the app" link
 * (https://app.yeix.io/add#instance=…&code=…) or the same with the app's own
 * scheme (northernlights://add?instance=…&code=…, a query so Android's intent
 * links can carry it). Null for anything else.
 */
export function linkPath(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const path = parsed.protocol === "northernlights:"
    ? `/${parsed.host}${parsed.pathname}`.replace(/\/+$/, "") || "/"
    : parsed.protocol === "https:" && parsed.host === "app.yeix.io" ? parsed.pathname : null;
  if (path === null) return null;
  return { pathname: path, hash: parsed.hash || (parsed.search ? `#${parsed.search.slice(1)}` : "") };
}
