-- Northern Lights: initial schema
--
-- Rebuilt from the original project's Supabase backup (April 2025). The
-- original tables (users, profiles, posts, comments, reactions, messages,
-- albums, media, verification_codes) are consolidated here:
--   * users + profiles      -> profiles (one row per auth user)
--   * verification_codes    -> replaced by Supabase invite emails + invitations
--   * new: site_settings    -> content for the public page
--   * new: invitations      -> who invited whom, for the invite-only network
--
-- Access model
--   anon       : can read site_settings and anything marked is_public
--   member     : signed in AND profiles.is_approved = true
--   admin      : member with profiles.is_admin = true

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null unique,
  first_name  text not null default '',
  last_name   text not null default '',
  display_name text,
  bio         text,
  avatar_url  text,
  is_admin    boolean not null default false,
  is_approved boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Helpers used by RLS. SECURITY DEFINER so policies on profiles can call them
-- without recursing into profiles' own policies.
create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_approved
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_approved and is_admin
  );
$$;

-- ---------------------------------------------------------------------------
-- Public page content
-- ---------------------------------------------------------------------------

create table public.site_settings (
  id          boolean primary key default true check (id), -- single row
  site_name   text not null default 'Northern Lights',
  tagline     text,
  about       text,
  hero_image_url text,
  contact_email text,
  updated_at  timestamptz not null default now()
);

insert into public.site_settings (id) values (true);

-- ---------------------------------------------------------------------------
-- Invitations
-- ---------------------------------------------------------------------------

create table public.invitations (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  invited_by  uuid references public.profiles (id) on delete set null,
  message     text,
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);

create unique index invitations_email_open_idx
  on public.invitations (lower(email)) where accepted_at is null;

-- ---------------------------------------------------------------------------
-- Social: posts, comments, reactions
-- ---------------------------------------------------------------------------

create table public.posts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  content       text not null default '',
  media_urls    text[] not null default '{}',
  is_public     boolean not null default false,
  like_count    integer not null default 0,
  comment_count integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index posts_created_at_idx on public.posts (created_at desc);

create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index comments_post_id_idx on public.comments (post_id, created_at);

create table public.reactions (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null default 'like',
  created_at timestamptz not null default now(),
  unique (user_id, post_id)
);

-- ---------------------------------------------------------------------------
-- Direct messages
-- ---------------------------------------------------------------------------

create table public.messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  content      text not null,
  read         boolean not null default false,
  created_at   timestamptz not null default now()
);

create index messages_pair_idx on public.messages (sender_id, recipient_id, created_at);

-- ---------------------------------------------------------------------------
-- Photo albums
-- ---------------------------------------------------------------------------

create table public.albums (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references public.profiles (id) on delete set null,
  title       text not null,
  description text,
  cover_url   text,
  is_public   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.media (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles (id) on delete set null,
  album_id   uuid references public.albums (id) on delete cascade,
  url        text not null,
  type       text not null default 'image',
  caption    text,
  created_at timestamptz not null default now()
);

create index media_album_id_idx on public.media (album_id, created_at);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger posts_touch before update on public.posts
  for each row execute function public.touch_updated_at();
create trigger comments_touch before update on public.comments
  for each row execute function public.touch_updated_at();
create trigger albums_touch before update on public.albums
  for each row execute function public.touch_updated_at();
create trigger site_settings_touch before update on public.site_settings
  for each row execute function public.touch_updated_at();

-- Counter triggers (carried over from the original project).
create or replace function public.update_post_comment_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger on_comment_change after insert or delete on public.comments
  for each row execute function public.update_post_comment_count();

create or replace function public.update_post_like_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger on_reaction_change after insert or delete on public.reactions
  for each row execute function public.update_post_like_count();

-- Members cannot promote themselves. Only admins may change is_admin/is_approved.
create or replace function public.protect_profile_flags()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.is_admin is distinct from old.is_admin
      or new.is_approved is distinct from old.is_approved)
     and coalesce(auth.role(), '') <> 'service_role'
     and not public.is_admin() then
    raise exception 'only admins can change membership flags';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_flags before update on public.profiles
  for each row execute function public.protect_profile_flags();

-- Create a profile for every new auth user. A user is approved automatically
-- when an open invitation exists for their email. The very first user to sign
-- up becomes the site admin so a fresh install can be bootstrapped.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invited boolean;
  first_user boolean;
begin
  select not exists (select 1 from public.profiles) into first_user;

  update public.invitations
     set accepted_at = now()
   where lower(email) = lower(new.email) and accepted_at is null;
  invited := found;

  insert into public.profiles (id, email, first_name, last_name, is_admin, is_approved)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    first_user,
    first_user or invited
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles      enable row level security;
alter table public.site_settings enable row level security;
alter table public.invitations   enable row level security;
alter table public.posts         enable row level security;
alter table public.comments      enable row level security;
alter table public.reactions     enable row level security;
alter table public.messages      enable row level security;
alter table public.albums        enable row level security;
alter table public.media         enable row level security;

-- profiles
create policy "Members can read profiles" on public.profiles
  for select to authenticated using (public.is_member() or id = auth.uid());
create policy "Users update their own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "Admins manage profiles" on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- site_settings
create policy "Anyone can read site settings" on public.site_settings
  for select using (true);
create policy "Admins update site settings" on public.site_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- invitations (inserted by the invite-user edge function with the service role)
create policy "Members see invitations they sent" on public.invitations
  for select to authenticated using (invited_by = auth.uid() or public.is_admin());
create policy "Admins delete invitations" on public.invitations
  for delete to authenticated using (public.is_admin());

-- posts
create policy "Public posts are readable by anyone" on public.posts
  for select using (is_public);
create policy "Members read all posts" on public.posts
  for select to authenticated using (public.is_member());
create policy "Members create their own posts" on public.posts
  for insert to authenticated with check (public.is_member() and user_id = auth.uid());
create policy "Authors update their posts" on public.posts
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Authors and admins delete posts" on public.posts
  for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- comments
create policy "Members read comments" on public.comments
  for select to authenticated using (public.is_member());
create policy "Members comment as themselves" on public.comments
  for insert to authenticated with check (public.is_member() and user_id = auth.uid());
create policy "Authors update comments" on public.comments
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Authors and admins delete comments" on public.comments
  for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- reactions
create policy "Members read reactions" on public.reactions
  for select to authenticated using (public.is_member());
create policy "Members react as themselves" on public.reactions
  for insert to authenticated with check (public.is_member() and user_id = auth.uid());
create policy "Members remove their reactions" on public.reactions
  for delete to authenticated using (user_id = auth.uid());

-- messages
create policy "Participants read messages" on public.messages
  for select to authenticated using (auth.uid() in (sender_id, recipient_id));
create policy "Members send messages as themselves" on public.messages
  for insert to authenticated with check (public.is_member() and sender_id = auth.uid());
create policy "Recipients mark messages read" on public.messages
  for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create policy "Senders and admins delete messages" on public.messages
  for delete to authenticated using (sender_id = auth.uid() or public.is_admin());

-- albums
create policy "Public albums are readable by anyone" on public.albums
  for select using (is_public);
create policy "Members read all albums" on public.albums
  for select to authenticated using (public.is_member());
create policy "Members create albums" on public.albums
  for insert to authenticated with check (public.is_member() and owner_id = auth.uid());
create policy "Owners and admins update albums" on public.albums
  for update to authenticated using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());
create policy "Owners and admins delete albums" on public.albums
  for delete to authenticated using (owner_id = auth.uid() or public.is_admin());

-- media
create policy "Media in public albums is readable by anyone" on public.media
  for select using (exists (
    select 1 from public.albums a where a.id = album_id and a.is_public
  ));
create policy "Members read all media" on public.media
  for select to authenticated using (public.is_member());
create policy "Members add media" on public.media
  for insert to authenticated with check (public.is_member() and user_id = auth.uid());
create policy "Uploaders and admins update media" on public.media
  for update to authenticated using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
create policy "Uploaders and admins delete media" on public.media
  for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
-- A single public "media" bucket, as in the original project. Paths:
--   site/...                     public page images (admins)
--   albums/<album_id>/...        album photos
--   posts/<user_id>/...          post attachments
--   avatars/<user_id>/...        profile pictures
-- Files are publicly reachable by URL (unguessable UUID names); only members
-- can upload, and only the uploader or an admin can change or remove a file.

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy "Anyone can view media" on storage.objects
  for select using (bucket_id = 'media');
create policy "Members upload media" on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and public.is_member());
create policy "Owners and admins update media files" on storage.objects
  for update to authenticated using (bucket_id = 'media' and (owner_id = auth.uid()::text or public.is_admin()));
create policy "Owners and admins delete media files" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and (owner_id = auth.uid()::text or public.is_admin()));

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.posts;
