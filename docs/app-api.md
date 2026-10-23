# The app API

The Northern Lights app shows several Northern Lights sites in one feed. It
keeps a separate sign-in for each site and calls each site's normal `/api`
directly; there is no central server. This page covers what a site offers the
app on top of the website's API.

## Finding out about a site

`GET /.well-known/northern-lights` needs no sign-in and answers from any origin:

```json
{
  "software": "northern-lights",
  "api": 1,
  "features": ["device-tokens", "pairing", "signed-files", "summary", "feed-cursor"],
  "url": "https://family.example.org",
  "name": "The Smiths",
  "tagline": "Our corner of the internet",
  "logo_url": "https://family.example.org/files/abc.png",
  "theme": { "preset": "aurora", "primary": null }
}
```

`api` goes up when the app has to change to keep working. `features` lists what
the site supports, so the app can hide what an older site lacks.

## Signing in

The app gets a **device token** and sends it on every request as
`Authorization: Bearer <token>`. It never gets a cookie. Device tokens last
`DEVICE_DAYS` (180) days after they were last used, appear under **Get the app
→ Your devices** on the website, and end when the member removes them there,
signs the app out, or resets their password. A device token can do what a
member can on the website, except the admin pages.

There are three ways to get one. Each answers `201` with
`{ "token", "user", "instance" }`, where `instance` is the info above.

| How | Request |
| --- | --- |
| Scan a QR code | `POST /api/app/pair` `{ "code", "device_name"? }` |
| Email and password | `POST /api/app/login` `{ "email", "password", "device_name"? }` |
| Accept an invite | `POST /api/app/invitations/accept` `{ "token", "password", "first_name", "last_name", "device_name"? }` |

**QR codes.** A signed-in member opens **Get the app** on the website, which
calls `POST /api/app/pairing` and shows the returned `link` as a QR code:

```
https://app.yeix.io/add#instance=https%3A%2F%2Ffamily.example.org&code=<code>
```

The part after `#` is never sent to app.yeix.io. The app reads `instance` and
`code` and calls `POST <instance>/api/app/pair`. A code works once and expires
after 5 minutes. Sites can point the link elsewhere with `APP_LINK_URL`.

`POST /api/auth/logout` with the bearer header ends that device's sign-in.
`GET /api/me/devices` lists the member's devices (`current` marks the caller)
and `DELETE /api/me/devices/:id` removes one.

## Cross-origin requests

`/api`, `/files` and `/.well-known` answer any origin
(`Access-Control-Allow-Origin: *`) and allow the `Authorization` header, but
never credentials, so another site can't use a browser's cookie. The website's
cross-site write check only applies to cookie requests.

## Photos and videos

The app shows photos with ordinary image tags, which can't send its token. So
in every JSON response to a device token, each `"/files/<key>"` link is replaced
with a signed one:

```
/files/<key>?exp=<unix seconds>&sig=<signature>
```

Prefix it with the site's address. A signed link works without signing in until
the end of the next day (UTC) and stays the same all day, so it caches well.
Signed links can be sent back as-is (as a post's `media_urls`, an avatar, an
album cover); the site stores them without the signature.

## Paging the feed

`GET /api/posts` returns 30 posts, newest first. For the next page pass
`before=<created_at>,<id>` of the last post, which never skips or repeats posts
that share a timestamp. A bare `before=<created_at>` still works.

## Live updates and badges

`GET /api/events` is the website's server-sent events stream (`posts` and
`messages` events say "refetch"). `EventSource` can't send headers, so read it
with `fetch` and the bearer header.

`GET /api/app/summary?since=<ISO time>` returns counts for a badge, cheap
enough to ask every site often (`since` defaults to a week ago):

```json
{
  "since": "2026-10-23T08:00:00.000Z",
  "unread_messages": 2,
  "new_posts": 5,
  "new_comments_on_my_posts": 1,
  "new_likes_on_my_posts": 3
}
```
