import type { Insertable, Selectable, Updateable } from "kysely";

// Column types are kept portable across SQLite and Postgres:
// ids are text UUIDs, timestamps are ISO-8601 text, booleans are 0/1 integers,
// and lists are JSON text.

export interface UsersTable {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_admin: number;
  is_active: number;
  preferences: string | null; // JSON, see server/appearance.ts
  created_at: string;
  updated_at: string;
}

export interface SessionsTable {
  id: string; // sha256 of the cookie or device token
  user_id: string;
  expires_at: string;
  created_at: string;
  kind: "browser" | "device"; // browser = nl_session cookie, device = Authorization: Bearer
  device_name: string | null;
  last_used_at: string | null;
}

/** One-time codes shown as a QR on the website so the app can sign in. */
export interface PairingCodesTable {
  code_hash: string;
  user_id: string;
  expires_at: string;
  created_at: string;
}

/** Server-generated keys, such as the one that signs media links. */
export interface SecretsTable {
  name: string;
  value: string;
}

export interface InvitationsTable {
  id: string;
  token_hash: string;
  email: string;
  invited_by: string | null;
  message: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface PasswordResetsTable {
  token_hash: string;
  user_id: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export interface SiteSettingsTable {
  id: number;
  site_name: string;
  tagline: string | null;
  about: string | null;
  hero_image_url: string | null;
  contact_email: string | null;
  theme: string | null; // JSON, see server/appearance.ts
  home: string | null; // JSON home page sections
  logo_url: string | null;
  footer_text: string | null;
  show_credit: number;
  mail: string | null; // JSON, see mailSettingsSchema in server/mail.ts
  updated_at: string;
}

export interface PostsTable {
  id: string;
  user_id: string;
  content: string;
  media_urls: string; // JSON array
  is_public: number;
  created_at: string;
  updated_at: string;
}

export interface CommentsTable {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface ReactionsTable {
  id: string;
  post_id: string;
  user_id: string;
  type: string;
  created_at: string;
}

export interface MessagesTable {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  read: number;
  created_at: string;
}

export interface AlbumsTable {
  id: string;
  owner_id: string | null;
  title: string;
  description: string | null;
  cover_url: string | null;
  is_public: number;
  created_at: string;
  updated_at: string;
}

export interface MediaTable {
  id: string;
  user_id: string | null;
  album_id: string;
  url: string;
  type: string;
  caption: string | null;
  created_at: string;
}

export interface FilesTable {
  key: string;
  owner_id: string | null;
  mime: string;
  size: number;
  created_at: string;
}

export interface ImportsTable {
  user_id: string;
  source_key: string; // e.g. "fb:file:123_456_n.jpg:20481"
  kind: "file" | "album" | "post";
  ref: string; // file key, album id or post id
  created_at: string;
}

export interface Database {
  users: UsersTable;
  sessions: SessionsTable;
  pairing_codes: PairingCodesTable;
  secrets: SecretsTable;
  invitations: InvitationsTable;
  password_resets: PasswordResetsTable;
  site_settings: SiteSettingsTable;
  posts: PostsTable;
  comments: CommentsTable;
  reactions: ReactionsTable;
  messages: MessagesTable;
  albums: AlbumsTable;
  media: MediaTable;
  files: FilesTable;
  imports: ImportsTable;
}

export type User = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;
