# The Northern Lights app

The app shows every Northern Lights site a person belongs to in one place: one
News Feed with each post marked by the site it came from, one inbox, and badges
for what's new. It is an iPhone and Android app (Capacitor around the React
code in `src/hub/`); [mobile.md](mobile.md) covers building and publishing it.
On a computer, people use each site's own website.

Each site keeps its own accounts and data. The app holds one sign-in per site
(a device token, see [app-api.md](app-api.md)) and talks to every site
directly from the person's device; there is no server behind the app.

## Adding a site

- **Scan a code.** On the site, a member opens **Get the app**, which shows a
  QR code. Pointing a phone's camera at it opens
  `app.yeix.io/add#instance=…&code=…`, a page whose **Open in Northern
  Lights** button hands the code to the app (or points to the stores), and the
  app signs in without a password.
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
npm run dev:hub      # the app in a browser on http://localhost:5174
```

Add `localhost:3000` in the app. In a browser the app behaves as on a phone,
except that links from QR codes can't open it; paste the code's link path
(`/add#instance=…&code=…`) after `localhost:5174` instead.

`npm run build:hub` writes the app to `dist/hub/`, which `npx cap sync`
copies into the iPhone and Android projects.

## Not yet

Push notifications when the app is closed, scanning codes from inside the
app, and linking the same person across sites come in later phases.
