import { displayName, type Author } from "../lib/types";

const sizes = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-24 w-24 text-2xl" };

export default function Avatar({ profile, size = "md" }: { profile?: Author | null; size?: keyof typeof sizes }) {
  const name = displayName(profile);
  if (profile?.avatar_url) {
    return <img src={profile.avatar_url} alt={name} className={`${sizes[size]} shrink-0 rounded-full object-cover`} />;
  }
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className={`${sizes[size]} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-accent-500 font-semibold text-white`}>
      {initials}
    </div>
  );
}
