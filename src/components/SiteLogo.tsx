import { useSite } from "../lib/site";

/** The site's logo, or the Northern Lights mark until an admin uploads one. */
export default function SiteLogo({ className = "h-8 w-8", src }: { className?: string; src?: string | null }) {
  const { settings } = useSite();
  const url = src === undefined ? settings?.logo_url : src;
  return url
    ? <img src={url} alt="" className={`${className} shrink-0 rounded-lg object-cover`} />
    : <img src="/favicon.svg" alt="" className={`${className} shrink-0`} />;
}
