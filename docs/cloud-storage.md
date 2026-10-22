# Keeping photos in Google Drive, Dropbox or OneDrive

Northern Lights stores photos and videos on the server's own disk, or in an
S3-compatible bucket. If you'd rather keep them in cloud storage you already
pay for (Google Drive, Dropbox, OneDrive, pCloud, Box and
[many others](https://rclone.org/overview/)), run
[rclone](https://rclone.org) next to the app. rclone signs in to your cloud
account and makes it look like an S3 bucket, so Northern Lights works with it
without any changes.

Photos stay private either way. Visitors never get a link to your cloud
storage: every photo is still served through Northern Lights, which checks
that the person is a member (or that the photo is on the public page) first.

This guide uses Docker Compose. Your database still lives on the server, so
keep backing up the `northern-data` volume as described in the
[README](../README.md#backups).

## Before you start

- **Space.** Free accounts are small: Google Drive has 15 GB (shared with
  Gmail), OneDrive 5 GB and Dropbox 2 GB. Phone videos fill that quickly.
- **Speed.** Fetching a photo from the cloud is slower than reading it from
  disk, and providers limit how many requests an app can make. The setup below
  keeps a copy of recently viewed photos on the server (5 GB by default) so
  that pages stay fast.
- **One site per folder.** Each Northern Lights site needs its own folder in
  your cloud storage. Don't edit or rename the files in it: they are named by
  the app, not by you.

## 1. Connect your cloud account

This step needs a computer with a web browser, because Google, Dropbox and
Microsoft ask you to sign in on their own page. It doesn't have to be the
server.

1. [Install rclone](https://rclone.org/install/) on that computer. On a Mac
   with Homebrew, that's `brew install rclone`. On Windows, `winget install
   Rclone.Rclone`.
2. Run `rclone config` and answer the questions:
   - `n` for a new remote, and name it **`cloud`**.
   - Pick your provider from the list (for example `drive` for Google Drive,
     `dropbox` or `onedrive`).
   - Leave `client_id` and `client_secret` empty.
   - **Google Drive only:** when asked for the scope, choose the one that only
     lets rclone see files it created itself (`drive.file`). rclone then can't
     read anything else in your Drive.
   - Accept the defaults for the rest. When it asks to use a web browser to
     sign in, say yes and approve access in the page that opens.
   - **OneDrive only:** pick your personal OneDrive when it lists drives.
3. Make the folder the site will use:

   ```sh
   rclone mkdir cloud:northern-lights
   ```

   You should now see an empty `northern-lights` folder in your cloud storage.
4. Run `rclone config file` to see where the settings were saved, and copy
   that `rclone.conf` file to the server, into a folder named `rclone` next to
   your `docker-compose.yml`.

`rclone.conf` contains the key to your cloud account. Keep it private, and
don't commit it to git.

## 2. Start Northern Lights with rclone

Put [`docker-compose.cloud.yml`](../docker-compose.cloud.yml) next to your
`docker-compose.yml`, then run:

```sh
docker compose -f docker-compose.yml -f docker-compose.cloud.yml up -d
```

Using Caddy for HTTPS too? Add both files:

```sh
docker compose -f docker-compose.yml -f docker-compose.caddy.yml -f docker-compose.cloud.yml up -d
```

To check it works, post a photo, then look in the `northern-lights` folder in
your cloud storage. A file with a long random name should appear.

Settings you can put in a `.env` file next to the compose files:

| Variable | Default | What it does |
| --- | --- | --- |
| `CLOUD_FOLDER` | `northern-lights` | The folder in your cloud storage. Change it if you made the folder under another name. |
| `CLOUD_CACHE_SIZE` | `5G` | How much disk to use for the copy of recently viewed photos |

## Moving photos you already have

Switching storage doesn't move photos that were uploaded before. Copy them
over once, before members post anything new:

```sh
docker compose cp app:/data/uploads ./uploads
docker compose -f docker-compose.yml -f docker-compose.cloud.yml run --rm \
  -v "$PWD/uploads:/uploads:ro" rclone copy /uploads cloud:northern-lights --progress
```

When the photos all show up on the site, you can delete the local `uploads`
copy.

## Troubleshooting

- **Photos don't load, and `docker compose logs rclone` says the token
  expired or was revoked.** Run `rclone config reconnect cloud:` on the
  computer with the browser, then copy the new `rclone.conf` to the server
  again and run `docker compose restart rclone`.
- **Uploads fail with "NoSuchBucket".** The folder in step 1.3 doesn't exist,
  or `CLOUD_FOLDER` doesn't match its name.
- **Google Drive is slow or says "rate limit exceeded".** rclone's built-in
  Google app is shared by everyone who uses rclone. Make
  [your own client ID](https://rclone.org/drive/#making-your-own-client-id)
  and run `rclone config` again with it.

## Without Docker

The same works with the apt, dnf or Homebrew packages: run
`rclone serve s3 cloud: --addr 127.0.0.1:8080 --auth-key KEY,SECRET
--vfs-cache-mode full --vfs-write-back 0s` as a service, and set `STORAGE=s3`,
`S3_ENDPOINT=http://127.0.0.1:8080`, `S3_BUCKET=northern-lights`,
`S3_FORCE_PATH_STYLE=true`, `S3_ACCESS_KEY_ID=KEY` and
`S3_SECRET_ACCESS_KEY=SECRET`. Use your own random values for `KEY` and
`SECRET`.

Keep `--vfs-write-back 0s`: with rclone's default delay, a photo can't be read
back for a few seconds after it's uploaded, so it shows as broken right after
posting.
