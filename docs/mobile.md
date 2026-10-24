# Building and publishing the iPhone and Android apps

The app's code is `src/hub/` and `hub/`, the same React code that
`npm run dev:hub` runs in a browser. [Capacitor](https://capacitorjs.com)
puts it in a native shell:

| Path | What it is |
| --- | --- |
| `capacitor.config.ts` | App id `com.yeix.northernlights`, name, where the native projects live |
| `mobile/ios/` | The Xcode project (Swift Package Manager, no CocoaPods) |
| `mobile/android/` | The Gradle project |
| `mobile/assets/` | Icon and splash sources; regenerate the native ones with `@capacitor/assets` (below) |
| `mobile/scripts/` | Store build scripts, adapted from yeixio/prox |
| `mobile/landing/` | app.yeix.io: the page QR codes open, and the privacy policy |

`src/hub/native.ts` holds what differs on a phone: the site list is also kept
in the phone's own app storage (a WebView's storage can be cleared when space
runs low), and links that open the app (`northernlights://add?…`) go to the
**Add a site** page (`src/hub/links.ts`).

## Working on it

```sh
npm run build:hub && npx cap sync   # copy the app into both native projects
npx cap open ios                    # Xcode (macOS)
npx cap open android                # Android Studio
```

The **Mobile** workflow (`.github/workflows/mobile.yml`) builds both apps,
unsigned, on every pull request: a debug APK (attached to the run) and an
iPhone simulator build.

To change the icon or splash screen, edit the PNGs in `mobile/assets/`, then:

```sh
npx @capacitor/assets generate --ios --android --assetPath mobile/assets \
  --iosProject mobile/ios/App --androidProject mobile/android \
  --iconBackgroundColor '#0b1220' --iconBackgroundColorDark '#0b1220' \
  --splashBackgroundColor '#0b1220' --splashBackgroundColorDark '#0b1220'
```

## Releasing

Push a tag `app-vX.Y.Z` (app versions are separate from the server's `vX.Y.Z`
tags):

```sh
git tag app-v1.0.0 && git push origin app-v1.0.0
```

- **iPhone App Store** (`ios-appstore.yml`) archives and signs the app on a
  macOS runner and uploads it to App Store Connect, where it shows up in
  TestFlight after Apple processes it.
- **Google Play** (`android-play.yml`) builds a signed App Bundle and uploads
  it to Play's internal testing track. The bundle is also attached to the run.

Both can also be run by hand from the Actions tab with a version. Build
numbers come from the time, so every build is higher than the last. Moving a
build from TestFlight or internal testing to the public store is done by hand
in each store, on purpose.

## Secrets

The workflows use the same yeixio **organization secrets** as Proxa
(yeixio/prox `packaging/org-secrets.md` has how each was made):
`ASC_API_KEY_ID`, `ASC_API_ISSUER_ID`, `ASC_API_KEY_P8_BASE64`,
`APPSTORE_DISTRIBUTION_P12_BASE64`, `APPSTORE_DISTRIBUTION_PASSWORD`,
`ANDROID_UPLOAD_KEYSTORE_BASE64`, `ANDROID_UPLOAD_STORE_PASSWORD`,
`ANDROID_UPLOAD_KEY_ALIAS`, `ANDROID_UPLOAD_KEY_PASSWORD` and
`PLAY_SERVICE_ACCOUNT_JSON`.

Organization secrets only reach the repositories they're shared with. Add
**northern-lights** to each one: organization **Settings → Secrets and
variables → Actions**, open the secret, and add the repository under
**Repository access**. Or with the GitHub CLI, for each secret:
`gh secret set NAME --org yeixio --repos prox,toskar-apps,northern-lights`
(this sets the value again, so it needs the original file or text).

There is no provisioning profile secret: the iOS workflow registers the
bundle id and makes or finds its App Store profile with the API key
(`mobile/scripts/fetch-ios-profile.py`).

## One-time store setup

**App Store Connect**

1. The first iOS run registers the bundle id `com.yeix.northernlights`. Then
   create the app: **Apps → + → New App**, platform iOS, name
   "Northern Lights", that bundle id, SKU `northern-lights`.
2. **App Privacy:** Data Not Collected. The app sends what people post only to
   the site they post on, run by that site's owner; yeix collects nothing.
   Privacy policy URL: `https://app.yeix.io/privacy`.
3. **Age rating:** user-generated content and messaging.
4. **App Review:** the reviewer needs a site to sign in to. Give them a demo
   site's address and a member account in the review notes.
5. Once the listing is live, put its App Store link in `APP_STORE` in
   `mobile/landing/site/index.html`.

**Google Play Console**

1. **Create app**, "Northern Lights", package `com.yeix.northernlights`.
2. Play's API can't upload an app's first bundle. Run **Google Play** once,
   download the bundle from the run, and upload it by hand under **Testing →
   Internal testing**. Later runs upload by themselves.
3. Complete App content: privacy policy `https://app.yeix.io/privacy`, Data
   safety (no data collected or shared by the developer), App access (the
   same demo site and account as for Apple), content rating, target audience,
   and the user-generated content declaration.
4. Give the service account in `PLAY_SERVICE_ACCOUNT_JSON` release access to
   the new app under **Users and permissions**, if it doesn't have access to
   all apps.

## app.yeix.io

QR codes from **Get the app** point to `https://app.yeix.io/add#instance=…&code=…`
(`APP_LINK_URL` on the server). That page (`mobile/landing/`) shows an
**Open in Northern Lights** button that passes the code to the app, using an
Android intent link that falls back to Google Play when the app isn't
installed, and store buttons for people who need the app first. The **App**
workflow publishes it as `ghcr.io/yeixio/northern-lights-app`, which the
yeix.io cluster serves (yeix.io `k8s/overlays/prod/northern-lights-app.yaml`);
a new build goes live with
`kubectl -n yeix-io-prod rollout restart deployment/northern-lights-app`.

Opening the app straight from the camera, without the page, needs iOS
Universal Links and Android App Links: an `apple-app-site-association` file
with the team id and an `assetlinks.json` file with Play's signing key
fingerprint, served from app.yeix.io, plus the Associated Domains capability
on the app. That can follow once both store listings exist.
