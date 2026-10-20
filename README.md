# Northern Lights

A self-hosted personal social site. It has two halves:

- **A public page** for you, your family, or your group: a header, an about
  section, public photo albums, and public updates. Anyone can view it.
- **A private social network** that works like a small, private Facebook: a
  news feed with photos, likes and comments, member profiles, direct messages,
  and shared albums. Only people who were invited can sign in.

It runs as a single Node.js server with **SQLite** (zero setup, ideal for a home
server or Raspberry Pi) or **Postgres** (for larger or managed hosting). Photos
are stored on disk or in any S3-compatible bucket.

## Features

- Public home page and gallery, edited from the admin screen
- Invite-only accounts: members create invite links; there is no public sign-up
- Works without email: invite and password-reset links are shown on screen to
  pass along yourself. Add SMTP settings and they're emailed too.
- Feed with text, photos and video, likes, and comments, updated live
- Choose per post or per album whether it also appears on the public page
- Profiles with avatar and bio
- Live direct messages with unread indicators
- Shared photo albums with covers and a lightbox viewer
- Import your photos, videos and albums (and optionally posts) from a Facebook
  "Download your information" export, with captions and original dates
- Admin tools: suspend, restore, promote, or remove members, and make reset links
- Uploaded photos are private to members unless they're used on the public page

## Quick start

### Docker

```sh
git clone https://github.com/yeixio/northern-lights.git
cd northern-lights
docker compose up -d
```

Open http://localhost:3000. The first visit asks you to create the admin
account. Your database and photos live in the `northern-data` Docker volume.

To use Postgres instead, uncomment the `db` service and `DATABASE_URL` in
`docker-compose.yml`.

### Without Docker

Requires Node.js 20.12 or newer.

```sh
npm install
npm run build
npm start
```

Data goes in `./data` by default. Copy `.env.example` to `.env` to change any
setting.

### Development

```sh
npm install
npm run dev      # API on :3000, Vite dev server with hot reload on :5173
npm test         # API tests against in-memory SQLite
TEST_DATABASE_URL=postgres://localhost/northern_test npm test   # same tests on Postgres
```

## Configuration

All settings are environment variables (or lines in `.env`). Everything is optional.

| Variable | Default | What it does |
| --- | --- | --- |
| `PORT` | `3000` | Port to listen on |
| `DATA_DIR` | `./data` | Where the SQLite file and uploads go |
| `DATABASE_URL` | `sqlite:$DATA_DIR/northern-lights.db` | `sqlite:/path/to/file.db` or `postgres://user:pass@host:5432/db` |
| `APP_URL` | the request's address | Public URL, used in invite/reset links. An `https://` URL also makes the login cookie Secure. |
| `SMTP_URL` | off | e.g. `smtps://user:pass@smtp.example.com:465`. Turns on invite and reset emails. |
| `MAIL_FROM` | `Northern Lights <no-reply@localhost>` | Sender for those emails |
| `STORAGE` | `local` | `local` or `s3` |
| `MAX_UPLOAD_MB` | `50` | Largest photo or video allowed |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE` | | For `STORAGE=s3`. Works with AWS, Backblaze B2, Cloudflare R2, MinIO and others. |
| `SESSION_DAYS` | `30` | How long a login lasts |
| `INVITE_DAYS` | `14` | How long an invite link works |

The database schema is created and upgraded automatically when the server starts.

## Putting it on the internet

Run it behind a reverse proxy that handles HTTPS, such as Caddy, nginx, or a
Cloudflare Tunnel, and set `APP_URL` to the public address. With Caddy that's one line:

```
family.example.com {
  reverse_proxy localhost:3000
}
```

## Backups

- **SQLite:** copy the `data` folder (or the Docker volume). For a backup while
  it's running, use `sqlite3 data/northern-lights.db ".backup backup.db"`.
- **Postgres:** `pg_dump`, plus the uploads folder or bucket.

## How access works

| Who | Can see |
| --- | --- |
| Anyone | The public page: site info, public posts, public albums and their photos |
| Member | Everything in the network; can post, comment, like, message, add to albums, and invite |
| Admin | Everything members can, plus editing the public page and managing members |

Every check happens on the server. The browser never talks to the database.

## Project layout

```
server/
  index.ts         starts the server
  app.ts           routes, error handling, serving the built front end
  db/              Kysely schema and migrations (SQLite + Postgres)
  routes/          auth, public, posts, messages, albums, files, invites, admin, live updates
  app.test.ts      end-to-end API tests
src/
  auth/            session context, route guards
  components/      layouts, post card, composer, avatars
  pages/public/    public page, gallery, login, setup, invite and reset pages
  pages/app/       feed, people, profiles, messages, albums, invite, admin
docs/
  recovered-schema.md   notes on the original project this was rebuilt from
```

## License

MIT
