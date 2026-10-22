# Northern Lights

[![CI](https://github.com/yeixio/northern-lights/actions/workflows/ci.yml/badge.svg)](https://github.com/yeixio/northern-lights/actions/workflows/ci.yml)
[![Release](https://github.com/yeixio/northern-lights/actions/workflows/release.yml/badge.svg)](https://github.com/yeixio/northern-lights/actions/workflows/release.yml)
[![Latest release](https://img.shields.io/github/v/release/yeixio/northern-lights?sort=semver)](https://github.com/yeixio/northern-lights/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

A self-hosted personal social site. It has two halves:

- **A public page** for you, your family, or your group: a header, an about
  section, public photo albums, and public updates. Anyone can view it.
- **A private social network** that works like a small, private Facebook: a
  news feed with photos, likes and comments, member profiles, direct messages,
  and shared albums. Only people who were invited can sign in.

It runs as a single Node.js server with **SQLite** (zero setup, ideal for a home
server or Raspberry Pi) or **Postgres** (for larger or managed hosting). Photos
are stored on disk or in any S3-compatible bucket. Install it with
[Docker](#docker-recommended), [apt](#debian-and-ubuntu-apt),
[dnf/yum](#fedora-rhel-rocky-and-alma-linux-dnf--yum),
[Homebrew](#macos-and-linux-with-homebrew) or [Helm](#kubernetes).

![The public home page of a demo family site](docs/screenshots/demo-home.png)

| The members' feed | Direct messages |
| --- | --- |
| ![A feed of family posts with photos, likes and comments](docs/screenshots/demo-feed.png) | ![A conversation between two family members](docs/screenshots/demo-messages.png) |
| **Shared albums** | **Each member's own colors, dark mode included** |
| ![The albums page](docs/screenshots/demo-albums.png) | ![The feed in a member's dark fjord palette](docs/screenshots/demo-feed-dark.png) |
| **A public album** | **Profiles** |
| ![A public photo album](docs/screenshots/demo-public-album.png) | ![A member's profile page](docs/screenshots/demo-profile.png) |

<p align="center">
  <img src="docs/screenshots/demo-home-mobile.png" alt="The public page on a phone" width="260">
  &nbsp;&nbsp;
  <img src="docs/screenshots/demo-feed-mobile.png" alt="The members' feed on a phone" width="260">
</p>

<sub>Screenshots show the built-in demo family: every name, message and photo is
made up, and the photos are painted in code. Run it yourself with
[`npm run demo`](#try-the-demo).</sub>

## Features

- A home page admins edit in place: click any text to change it, add photos,
  and add, reorder, hide or remove sections (header, text, image and text,
  highlight cards, photo, albums, updates, call to action). A fresh site starts
  with a ready-made page and a getting-started guide for the admin.
- Themes: six palettes, custom colors, light, dark or automatic mode, three
  typefaces and corner styles. Members can pick their own palette and light or
  dark mode for the private area.
- Invite-only accounts: members create invite links; there is no public sign-up
- Site settings for everything else an admin might want to change: name, logo,
  link-preview text, footer, and email, with a live preview. No config files.
- Works without email: invite and password-reset links are shown on screen to
  pass along yourself. Connect an email account in Site settings (or set
  `SMTP_URL`) and they're emailed too.
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
sudo dnf install northern-lights   # or: sudo yum install northern-lights
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

### Try the demo

To look around a site that's already full of people, posts and photos:

```sh
npm install
npm run demo
```

Open http://localhost:3000 and sign in as `astrid@example.com` (an admin) or
`maja@example.com` (a member), password `northern-lights`. The demo lives in
`./demo-data`; delete it to start over.

### Development

```sh
npm install
npm run dev      # API on :3000, Vite dev server with hot reload on :5173
npm test         # API tests against in-memory SQLite
TEST_DATABASE_URL=postgres://localhost/northern_test npm test   # same tests on Postgres
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for more, including how to work against
the demo data and refresh the screenshots.

## Configuration

All settings are environment variables (or lines in `.env`). Everything is optional.

| Variable | Default | What it does |
| --- | --- | --- |
| `PORT` | `3000` | Port to listen on |
| `DATA_DIR` | `./data` | Where the SQLite file and uploads go |
| `DATABASE_URL` | `sqlite:$DATA_DIR/northern-lights.db` | `sqlite:/path/to/file.db` or `postgres://user:pass@host:5432/db` |
| `APP_URL` | the request's address | Public URL, used in invite/reset links. An `https://` URL also makes the login cookie Secure. |
| `SMTP_URL` | off | e.g. `smtps://user:pass@smtp.example.com:465`. Turns on invite and reset emails. Admins can also set up email in **Site settings** instead; this wins when both are set. |
| `MAIL_FROM` | `Northern Lights <no-reply@localhost>` | Sender for emails sent with `SMTP_URL` |
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

## Customizing the site

Everything about how your site looks and what it says is changed from the site
itself, with no files to edit. Sign in as the admin account and open **Admin**.
A brand-new site also shows a getting-started guide on the home page that
walks through the same steps.

![The Admin screen with Edit home page, Theme and Site settings](docs/screenshots/admin.png)

- **Site settings**: your site's name, a logo (shown in the header, on the
  sign-in page and in the browser tab), a one-line description for link
  previews when you share your site in a chat app, a footer note and contact
  email, and whether to show "Powered by Northern Lights". A preview next to the
  form shows each change as you type, and nothing changes for visitors until
  you press **Save changes**.
- **Email**: on the same page, pick Gmail, iCloud Mail, Fastmail or another
  provider, enter the address and an app password, and press **Send a test
  email** to check it. From then on invitations and password resets are
  emailed. Without it, those links are shown on screen for you to pass along.
- **Edit home page**: click any text on the home page to change it, use the
  toolbar on each section to move, hide, duplicate or delete it, and the
  **+ Add section** buttons to add new ones.
- **Theme**: the palette, your own colors, light or dark, the typeface and
  corner style, with a live preview.

Each member can also choose their own colors and light or dark mode under
**Appearance** in the members' area. That only changes what they see.

| Name, logo, footer and link preview | Email, with a test button |
| --- | --- |
| ![Site settings with a live preview of the header, footer and a shared link](docs/screenshots/site-settings.png) | ![Setting up Gmail for invitations](docs/screenshots/site-settings-email.png) |
| **The getting-started guide on a new site** | **Editing the home page** |
| ![A fresh site with the getting-started guide](docs/screenshots/home-fresh.png) | ![Editing the home page](docs/screenshots/home-editing.png) |
| **Theme settings** | **A member's own colors** |
| ![Theme settings](docs/screenshots/theme-panel.png) | ![A member's appearance settings in dark mode](docs/screenshots/member-appearance-dark.png) |

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
  appearance.ts    what may be saved as a theme, home page or member preference
  mail.ts          sending email, set up by SMTP_URL or in Site settings
  routes/          auth, public, posts, messages, albums, files, invites, admin, live updates
  app.test.ts      end-to-end API tests
src/
  auth/            session context, route guards
  components/      layouts, post card, composer, avatars, theme panel
  components/home/ home page sections and the in-place editor
  lib/theme.ts     palettes and how site and member colors combine
  lib/home.ts      home page section types and the starter page
  pages/public/    public page, gallery, login, setup, invite and reset pages
  pages/app/       feed, people, profiles, messages, albums, invite, appearance, admin, site settings
packaging/
  linux/           .deb/.rpm packaging (nfpm), systemd service, config file
  repos/           builds the signed apt and dnf repositories
Formula/           Homebrew formula (this repo is also a tap)
charts/            Helm chart
deploy/kubernetes/ plain Kubernetes manifests (kustomize)
scripts/demo/       demo data (npm run demo) and the README screenshots (npm run screenshots)
docs/
  releasing.md          how releases are cut and the one-time setup they need
  recovered-schema.md   notes on the original project this was rebuilt from
```

## Contributing

Contributions are welcome, from typo fixes to new features. Start with
[CONTRIBUTING.md](CONTRIBUTING.md), look for issues labeled
[`good first issue`](https://github.com/yeixio/northern-lights/labels/good%20first%20issue),
and please follow the [code of conduct](CODE_OF_CONDUCT.md). Found a security
problem? Report it privately as described in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
