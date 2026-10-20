# Recovered schema (original project, April 2025)

The original Northern Lights source code was lost. This repository was rebuilt
from a Supabase `db_cluster` backup and a storage export. This note records
what the backup contained and how the rebuild differs. No user data from the
backup is included in this repository.

## Stack

The original migration names (`foggy_wood`, `bitter_cake`, `delicate_shape`, …)
are the style Bolt generates, which points to a React + Vite + Supabase app.
The rebuild uses the same stack.

## Original tables (`public` schema)

| Table | Columns | Notes |
| --- | --- | --- |
| `users` | id → auth.users, email (unique), first_name, last_name, avatar_url, is_admin, is_approved, email_verified, created_at | Main member table. RLS was **not enabled** on it. |
| `profiles` | id (identity), user_id → auth.users, display_name, bio, avatar_url, is_admin, is_approved | Added later; duplicated `users`. Empty in the backup. |
| `posts` | id, user_id → users, content, media_urls text[], media_type, like_count, comment_count | |
| `comments` | id, post_id → posts, user_id → users, content | |
| `reactions` | id, user_id, post_id, type; unique (user_id, post_id) | |
| `messages` | id, sender_id, recipient_id, content, read | Direct messages. |
| `albums` | id, title, description, cover_url | No owner column. |
| `media` | id, user_id, album_id → albums, url, type, caption | |
| `verification_codes` | id, email, code, expires_at | Email-code login flow, likely backed by an edge function that was not in the backup. |

Triggers: `update_post_comment_count` and `update_post_like_count` kept the
counters on `posts` in sync. Both are carried over.

Storage: one public bucket, `media`, with paths `albums/<album_id>/<file>` and
`albums/<album_id>/cover/<file>`. Policies let any signed-in user upload and
let owners update or delete their own files.

## Problems in the original policies

- `public.users` had policies but RLS disabled, so anyone with the anon key could
  read every member's email and change rows.
- The "Allow users to update their own profile" check compared `is_admin = is_admin`
  (always true), so members could make themselves admins.
- Comments, reactions, messages, albums and media could only be inserted by
  admins, so ordinary members couldn't comment, like, or message.
- Any authenticated user counted as a member; "approved" was only enforced in the UI.

## What the rebuild changes

- `users` and `profiles` are merged into a single `profiles` table keyed by the auth user id.
- Membership is enforced in the database: `is_member()` (signed in and approved)
  and `is_admin()` gate every policy, and a trigger stops non-admins from changing
  `is_admin` / `is_approved`.
- Invite-only sign-in uses Supabase's own invite emails (`invite-user` edge
  function) and a new `invitations` table instead of hand-rolled verification codes.
  Public sign-ups are turned off.
- New `site_settings` table holds the public page's name, tagline, about text and header image.
- Posts and albums gained an `is_public` flag so selected content can appear on the public page.
- Albums gained an `owner_id` so members can manage their own albums.
