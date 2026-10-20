# Northern Lights

A self-hosted personal social site. It has two halves:

- **A public page** for you, your family, or your group: a header, an about
  section, public photo albums, and public updates. Anyone can view it.
- **A private social network** that works like a small, private Facebook: a
  news feed with photos, likes and comments, member profiles, direct messages,
  and shared albums. Only people who were invited can sign in.

Built with React, Vite, Tailwind CSS and [Supabase](https://supabase.com)
(Postgres, Auth, Storage, Realtime, Edge Functions).

## Features

- Public home page and gallery, edited from the admin screen
- Invite-only accounts: members invite friends by email; there is no public sign-up
- Feed with text, photos and video, likes, and comments, updated in real time
- Choose per post or per album whether it also appears on the public page
- Profiles with avatar and bio
- Real-time direct messages with unread indicators
- Photo albums with covers and a lightbox viewer
- Admin tools: approve, suspend, promote, or remove members
- Row-level security on every table, so privacy is enforced by the database, not just the UI

## Getting started

### 1. Create a Supabase project

Create a project at [supabase.com](https://supabase.com) (or run locally with
`supabase start`). Then apply the schema and deploy the invite function with the
[Supabase CLI](https://supabase.com/docs/guides/cli):

```sh
supabase link --project-ref <your-project-ref>
supabase db push
supabase functions deploy invite-user
```

### 2. Lock down sign-ups

In the Supabase dashboard, open **Authentication → Sign In / Providers** and turn
off **Allow new users to sign up**. Under **Authentication → URL Configuration**,
set the Site URL to where you'll host the app and add `<site>/welcome` and
`<site>/reset-password` as redirect URLs. (Local development already has these
settings in `supabase/config.toml`.)

### 3. Create the first admin

In **Authentication → Users**, use **Invite user** (or **Add user**) with your
own email. The first account ever created becomes the site admin automatically.

### 4. Run the app

```sh
cp .env.example .env.local   # fill in your project URL and anon key
npm install
npm run dev
```

Open http://localhost:5173. Sign in, then visit **Admin** to fill in the public
page and **Invite** to bring people in.

### Deploying

`npm run build` produces a static site in `dist/` that you can host on Netlify,
Vercel, Cloudflare Pages, GitHub Pages, or any static host. Configure the host
to serve `index.html` for unknown paths (single-page app fallback) and set the
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` environment variables at build time.

## How access works

| Who | Can see |
| --- | --- |
| Anyone | Site settings, public posts, public albums and their photos |
| Signed in, not approved | Only their own profile and a "waiting for approval" page |
| Member (approved) | Everything in the network; can post, comment, like, message, create albums, and invite |
| Admin | Everything members can, plus editing the public page and managing members |

People who sign up through an invite are approved automatically. Anyone else an
admin adds by hand starts unapproved until an admin approves them.

Uploaded files live in a public `media` storage bucket under random file names,
so a photo's URL works for anyone who has it. The database rows that list
those URLs are private to members unless marked public.

## Project layout

```
src/
  auth/            session + profile context, route guards
  components/      layouts, post card, composer, avatars
  pages/public/    public page, gallery, login, invite landing
  pages/app/       feed, people, profiles, messages, albums, invite, admin
supabase/
  migrations/      database schema, RLS policies, triggers, storage bucket
  functions/       invite-user edge function
docs/
  recovered-schema.md   notes on the original project this was rebuilt from
```

## License

MIT
