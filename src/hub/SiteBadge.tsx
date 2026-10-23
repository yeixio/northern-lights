import { Link } from "react-router-dom";
import { PRESETS, type PresetId } from "../lib/theme";
import { abs, type Site } from "./sites";

const HUES = Object.entries(PRESETS).filter(([id]) => id !== "graphite").map(([, p]) => p.primary); // graphite would vanish in dark mode

/**
 * The site's own color, so posts from different sites are easy to tell apart.
 * Sites still on the default look get one picked from their address instead,
 * or they would all be the same green.
 */
export function siteColor(site: Site) {
  const { preset, primary } = site.info.theme;
  if (primary) return primary;
  if (preset !== "aurora" && PRESETS[preset as PresetId]) return PRESETS[preset as PresetId].primary;
  let hash = 0;
  for (const ch of site.url) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return HUES.at(hash % HUES.length)!;
}

export function SiteLogo({ site, className = "h-8 w-8" }: { site: Site; className?: string }) {
  const logo = abs(site, site.info.logo_url);
  if (logo) return <img src={logo} alt="" className={`${className} shrink-0 rounded-lg object-cover`} />;
  return (
    <div className={`${className} flex shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white`} style={{ background: siteColor(site) }}>
      {site.info.name.slice(0, 1).toUpperCase()}
    </div>
  );
}

/** "● Family site", linking to that site's posts only unless it sits inside another link. */
export default function SiteBadge({ site, link = true }: { site: Site; link?: boolean }) {
  const inner = (
    <>
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: siteColor(site) }} />
      <span className="truncate">{site.info.name}</span>
    </>
  );
  const cls = "inline-flex min-w-0 items-center gap-1.5";
  return link
    ? <Link to={`/?site=${encodeURIComponent(site.url)}`} className={`${cls} hover:underline`}>{inner}</Link>
    : <span className={cls}>{inner}</span>;
}
