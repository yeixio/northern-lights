# Contributing to Northern Lights

Thanks for helping out! Northern Lights is a small, friendly project, and
contributions of every size are welcome: bug reports, ideas, docs fixes,
translations of confusing wording into plain English, and code.

## Ways to help

- **Try it and tell us what was confusing.** Installation and first-run
  problems are bugs. [Open an issue](https://github.com/yeixio/northern-lights/issues/new/choose).
- **Pick up an issue.** Issues labeled
  [`good first issue`](https://github.com/yeixio/northern-lights/labels/good%20first%20issue)
  are small and well scoped. Comment on one to say you're working on it.
- **Suggest a feature.** Open a feature request first for anything big, so we
  can agree on the approach before you spend time on it.
- **Improve the docs.** The README, `docs/` and code comments all count.

## Getting set up

You need Node.js 22 or newer and git. Nothing else: the default database is
SQLite in a local file.

```sh
git clone https://github.com/yeixio/northern-lights.git
cd northern-lights
npm install
npm run dev      # API on :3000, Vite dev server with hot reload on :5173
```

Open http://localhost:5173. The first visit asks you to create an admin account.

### Demo data

To work against a site that already has people, posts, albums and messages:

```sh
npm run demo
```

That builds the app, fills `./demo-data` with a made-up family (all names,
messages and photos are fictional; the photos are painted in code), and starts
the server on http://localhost:3000. Sign in as `astrid@example.com` (an admin)
or `maja@example.com`, `erik@example.com`, `nils@example.com` and others, all
with the password `northern-lights`. Delete `demo-data` to start over.

`npm run demo:seed` only seeds, into whatever `DATA_DIR` or `DATABASE_URL`
points at, so you can also use it with `npm run dev`:

```sh
DATA_DIR=demo-data npm run demo:seed
DATA_DIR=demo-data npm run dev
```

It never touches a database that already has accounts.

## Checks to run before a pull request

```sh
npm run typecheck
npm test                                                     # SQLite
TEST_DATABASE_URL=postgres://localhost/northern_test npm test # Postgres, if you have it
npm run build
```

CI runs the same checks on every pull request, plus the Linux package,
Kubernetes and Homebrew install tests in `.github/workflows/release.yml`.

## How the code is organized

The [project layout](README.md#project-layout) in the README is the map. In
short: `server/` is the Hono API (Kysely over SQLite or Postgres) and `src/` is
the React front end. A few things worth knowing:

- **Every permission check lives on the server.** The browser never talks to the
  database, and nothing in `src/` is trusted.
- **The schema must work on both SQLite and Postgres.** Add a new migration in
  `server/db/migrations.ts` rather than editing an old one, and keep column
  types portable (text ids and ISO timestamps, 0/1 booleans, JSON as text).
- **Add a test** in `server/app.test.ts` for new API behavior. The tests spin up
  the whole app against an in-memory database, so they're fast.
- **Keep the UI wording plain.** The people using this are families, not
  sysadmins. "Photos" not "media assets", "sign in" not "authenticate".

## Screenshots

The README screenshots come from the demo data. If your change affects how a
page looks, refresh them:

```sh
npm run build
npx playwright install chromium   # once
npm run screenshots
```

That writes PNGs to `docs/screenshots/`. Add or change shots in
`scripts/demo/screenshots.ts`, and new demo content in `scripts/demo/seed.ts`.
Never use real people's photos or names in demo data.

## Pull requests

- Branch from `main`, keep each pull request to one change, and fill in the
  template.
- Write commit messages that say what changed and why, in the imperative
  ("Add album sorting", not "added album sorting").
- Include a screenshot for UI changes.
- If you change how the app is installed or configured, update the README and
  the packaging under `packaging/`, `Formula/`, `charts/` and `deploy/` to match.

A maintainer will review within a few days. Don't worry about getting
everything perfect the first time; we'll work through it together.

## Releases

Maintainers cut releases by pushing a `v*` tag; see
[docs/releasing.md](docs/releasing.md). That one tag publishes the Docker image,
the `.deb` and `.rpm` packages and their apt and dnf repositories, the Homebrew
formula and the Helm chart.

## Code of conduct

Everyone taking part is expected to follow the
[code of conduct](CODE_OF_CONDUCT.md). Report security problems privately, as
described in [SECURITY.md](SECURITY.md), not in public issues.
