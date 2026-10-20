export interface Profile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  is_approved: boolean;
  created_at: string;
}

export interface SiteSettings {
  site_name: string;
  tagline: string | null;
  about: string | null;
  hero_image_url: string | null;
  contact_email: string | null;
}

export interface Post {
  id: string;
  user_id: string;
  content: string;
  media_urls: string[];
  is_public: boolean;
  like_count: number;
  comment_count: number;
  created_at: string;
  author?: Profile;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author?: Profile;
}

export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

export interface Album {
  id: string;
  owner_id: string | null;
  title: string;
  description: string | null;
  cover_url: string | null;
  is_public: boolean;
  created_at: string;
}

export interface Media {
  id: string;
  user_id: string | null;
  album_id: string | null;
  url: string;
  type: string;
  caption: string | null;
  created_at: string;
}

export interface Invitation {
  id: string;
  email: string;
  invited_by: string | null;
  accepted_at: string | null;
  created_at: string;
}

export function displayName(p?: Pick<Profile, "display_name" | "first_name" | "last_name" | "email"> | null) {
  if (!p) return "Unknown";
  return p.display_name || `${p.first_name} ${p.last_name}`.trim() || p.email;
}
