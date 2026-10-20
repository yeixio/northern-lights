import type { HomePage } from "./home";
import type { Preferences, SiteTheme } from "./theme";

export interface Author {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface Profile extends Author {
  bio: string | null;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
}

export interface SiteSettings {
  site_name: string;
  tagline: string | null;
  about: string | null;
  hero_image_url: string | null;
  contact_email: string | null;
  theme: SiteTheme | null;
  home: HomePage | null;
}

/** The signed-in member, with their own appearance choices. */
export interface Me extends Profile {
  preferences: Preferences | null;
}

export interface Post {
  id: string;
  user_id: string;
  content: string;
  media_urls: string[];
  is_public: boolean;
  like_count: number;
  comment_count: number;
  liked: boolean;
  created_at: string;
  author: Author;
}

export interface PublicPost {
  id: string;
  content: string;
  media_urls: string[];
  created_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author: Author;
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
  url: string;
  type: string;
  caption: string | null;
  created_at: string;
}

export interface AlbumWithMedia extends Album {
  media: Media[];
}

export interface Invitation {
  id: string;
  email: string;
  invited_by: string | null;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
}

export function displayName(p?: Pick<Author, "display_name" | "first_name" | "last_name" | "email"> | null) {
  if (!p) return "Unknown";
  return p.display_name || `${p.first_name} ${p.last_name}`.trim() || p.email;
}
