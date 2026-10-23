# The Northern Lights app

The app shows every Northern Lights site a person belongs to in one place: one
News Feed with each post marked by the site it came from, one inbox, and badges
for what's new. It is a static web app that installs to the home screen
("Add to Home Screen" on iPhone, "Install app" on Android and desktop Chrome
or Edge). It lives at **https://app.yeix.io**.

Each site keeps its own accounts and data. The app holds one sign-in per site
(a device token, see [app-api.md](app-api.md)) and talks to every site
directly from the person's device; there is no server behind the app.

## Adding a site

- **Scan a code.** On the site, a member opens **Get the app**, which shows a
  QR code. Pointing a phone's camera at it opens
  `app.yeix.io/add#instance=…&code=…`, and the app signs in without a password.
- **Invite link.** Paste an invite link (`…/welcome?token=…`) into **Add a
  site** to create the account from the app.
- **Address and password.** Type the site's address and sign in.

A site that removes the device (on **Get the app → Your devices**) shows as
signed out in the app, with a link to sign in again.

## What's in it

| Screen | What it does |
| --- | --- |
| Feed | Every site's posts merged newest first, live. Posting picks the site with **Post to**. Likes, comments and deletes go to the post's site. A site that can't be reached is skipped with a notice, and the last feed is shown while sites load or offline. |
| A site's feed | Tap a site in the sidebar or on a post to see only its posts. |
| Messages | Conversations from every site in one list, live, with unread dots. The same person on two sites is two accounts, so two conversations. |
| Sites | What's new on each site since you last looked, and removing a site. |

## Running it locally

```sh
npm run dev:server   # a site on http://localhost:3000
npm run dev:hub      # the app on http://localhost:5174
```

Add `localhost:3000` in the app (or open **Get the app** on the site and change
the QR link's host to `localhost:5174`). Browsers allow an app served over
https to call `http://localhost`, but not plain `http://` addresses on a home
network, so sites need https to be added from app.yeix.io.

`npm run build:hub` writes the app to `dist/hub/`. `404.html` is a copy of
`index.html` so the app's pages work when opened directly on GitHub Pages.

## Publishing

`.github/workflows/app.yml` builds the app on every pull request and publishes
`dist/hub/` to GitHub Pages on every push to `main`. One-time setup:

1. In the repository's **Settings → Pages**, set **Source** to **GitHub Actions**.
2. Add a DNS record for `app.yeix.io`: `CNAME` pointing to `yeixio.github.io`.
3. Back in **Settings → Pages**, check that the custom domain shows
   `app.yeix.io` (it comes from `hub/public/CNAME`) and turn on **Enforce HTTPS**
   once the certificate is ready.

## Not yet

Push notifications when the app is closed, store apps for iPhone and Android,
and linking the same person across sites come in later phases.
