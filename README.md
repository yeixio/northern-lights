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

### Docker (recommended)

A ready-made image for regular PCs (amd64) and ARM machines (Apple Silicon,
Raspberry Pi 4/5, most NAS boxes) is published at
`ghcr.io/yeixio/northern-lights`. Save this as `docker-compose.yml`:

```yaml
services:
  app:
    image: ghcr.io/yeixio/northern-lights:latest
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - northern-data:/data
volumes:
  northern-data:
```

then run:

```sh
docker compose up -d
```

Open http://localhost:3000. The first visit asks you to create the admin
account. Your database and photos live in the `northern-data` volume.

To update to a newer version:

```sh
docker compose pull && docker compose up -d
```

Image tags: `latest` is the newest release, `1.2.3` / `1.2` pin a release, and
`main` follows the main branch.

The repo's own [`docker-compose.yml`](docker-compose.yml) is the same setup with
the optional settings (email, Postgres) written out. It builds the image from
source if it can't pull it; `docker compose up -d --build` always builds locally.

#### HTTPS on your own domain

[`docker-compose.caddy.yml`](docker-compose.caddy.yml) adds
[Caddy](https://caddyserver.com), which gets a free certificate automatically.
Point your domain at the machine, open ports 80 and 443, then:

```sh
DOMAIN=family.example.com docker compose -f docker-compose.yml -f docker-compose.caddy.yml up -d
```

#### Postgres

Uncomment the `db` service and `DATABASE_URL` in `docker-compose.yml`.

### Debian and Ubuntu (apt)

Packages for amd64 and arm64 run on Debian 12+, Ubuntu 22.04+ and Raspberry Pi OS
(64-bit). They include their own Node.js and run as a systemd service.

```sh
sudo install -d /etc/apt/keyrings
sudo curl -fsSL -o /etc/apt/keyrings/northern-lights.gpg https://yeixio.github.io/northern-lights/northern-lights.gpg
echo "deb [signed-by=/etc/apt/keyrings/northern-lights.gpg] https://yeixio.github.io/northern-lights/apt stable main" \
  | sudo tee /etc/apt/sources.list.d/northern-lights.list
sudo apt-get update && sudo apt-get install northern-lights
sudo systemctl enable --now northern-lights
```

### Fedora, RHEL, Rocky and Alma Linux (dnf / yum)

For Fedora and RHEL-compatible 9 or newer:

```sh
sudo curl -fsSL -o /etc/yum.repos.d/northern-lights.repo https://yeixio.github.io/northern-lights/northern-lights.repo
sudo dnf install northern-lights
sudo systemctl enable --now northern-lights
```

With either package, open http://localhost:3000 to create the admin account.
Settings are in `/etc/northern-lights/northern-lights.env` (restart the service
after changing it) and data lives in `/var/lib/northern-lights`. The `.deb` and
`.rpm` files are also attached to each
[release](https://github.com/yeixio/northern-lights/releases) if you'd rather
install one directly.

### macOS and Linux with Homebrew

```sh
brew tap yeixio/northern-lights https://github.com/yeixio/northern-lights
brew install northern-lights
brew services start northern-lights
```

Settings are in `$(brew --prefix)/etc/northern-lights.env` and data in
`$(brew --prefix)/var/northern-lights`. `brew install --HEAD northern-lights`
builds the main branch instead of the latest release.

### Kubernetes

With [Helm](https://helm.sh):

```sh
helm install northern-lights oci://ghcr.io/yeixio/charts/northern-lights \
  --namespace northern-lights --create-namespace \
  --set env.APP_URL=https://family.example.com \
  --set ingress.enabled=true --set 'ingress.hosts[0].host=family.example.com'
```

See [`charts/northern-lights/values.yaml`](charts/northern-lights/values.yaml) for
every option (storage size and class, TLS, passwords kept in a Secret, Postgres).

Or apply the plain manifests in [`deploy/kubernetes`](deploy/kubernetes) with
`kubectl apply -n northern-lights -k deploy/kubernetes`.

Either way the app runs as one pod with a persistent volume for the SQLite
database and uploads. To run more than one copy, use Postgres and S3 storage.

### From source

Requires Node.js 22 or newer.

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

With Docker, use the Caddy setup above. On Kubernetes, use an Ingress. Otherwise, run it behind any reverse
proxy that handles HTTPS (Caddy, nginx, a Cloudflare Tunnel) and set `APP_URL`
to the public address. With Caddy installed directly, that's:

```
family.example.com {
  reverse_proxy localhost:3000
}
```

## Backups

- **SQLite:** copy the `data` folder (`/var/lib/northern-lights` with the Linux
  packages). With Docker, the files are in the
  `northern-data` volume; `docker compose cp app:/data ./backup` copies them out. For a backup while
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
packaging/
  linux/           .deb/.rpm packaging (nfpm), systemd service, config file
  repos/           builds the signed apt and dnf repositories
Formula/           Homebrew formula (this repo is also a tap)
charts/            Helm chart
deploy/kubernetes/ plain Kubernetes manifests (kustomize)
docs/
  recovered-schema.md   notes on the original project this was rebuilt from
```

## License

MIT
