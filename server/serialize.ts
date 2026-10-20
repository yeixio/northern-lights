import type { Selectable } from "kysely";
import type { AlbumsTable, MediaTable, User } from "./db/schema.js";

export const bool = (v: unknown) => v === 1 || v === true || v === "1";

export function profile(u: User) {
  return {
    id: u.id,
    email: u.email,
    first_name: u.first_name,
    last_name: u.last_name,
    display_name: u.display_name,
    bio: u.bio,
    avatar_url: u.avatar_url,
    is_admin: bool(u.is_admin),
    is_active: bool(u.is_active),
    created_at: u.created_at,
  };
}

export const album = (a: Selectable<AlbumsTable>) => ({ ...a, is_public: bool(a.is_public) });
export const media = (m: Selectable<MediaTable>) => m;

/** Columns of `users` that are safe to embed (as `author`) in other responses. */
export const authorColumns = [
  "users.id as author_id",
  "users.email as author_email",
  "users.first_name as author_first_name",
  "users.last_name as author_last_name",
  "users.display_name as author_display_name",
  "users.avatar_url as author_avatar_url",
] as const;

type AuthorRow = {
  author_id: string;
  author_email: string;
  author_first_name: string;
  author_last_name: string;
  author_display_name: string | null;
  author_avatar_url: string | null;
};

export function withAuthor<T extends AuthorRow>(row: T) {
  const {
    author_id, author_email, author_first_name, author_last_name, author_display_name, author_avatar_url,
    ...rest
  } = row;
  return {
    ...rest,
    author: {
      id: author_id,
      email: author_email,
      first_name: author_first_name,
      last_name: author_last_name,
      display_name: author_display_name,
      avatar_url: author_avatar_url,
    },
  };
}
