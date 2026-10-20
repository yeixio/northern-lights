# Releasing

Push a version tag and the workflows do the rest:

```sh
git tag v0.1.0
git push origin v0.1.0
```

- **Docker** (`docker.yml`) publishes `ghcr.io/yeixio/northern-lights:0.1.0`,
  `:0.1` and `:latest`.
- **Release** (`release.yml`) builds and tests every installer, then:
  - creates the GitHub release with the `.deb` and `.rpm` packages (amd64 and
    arm64) and the Helm chart attached
  - pushes the chart to `oci://ghcr.io/yeixio/charts/northern-lights`
  - points `Formula/northern-lights.rb` at the release (a commit to main)
  - publishes signed apt and dnf repositories to the `gh-pages` branch

Keep `version` in `package.json` in step with the tag.

## One-time setup

### Package signing key

The apt and dnf repositories are only published when this key is set. Create a
key with no expiry that is only used for these packages:

```sh
gpg --quick-gen-key "Northern Lights packages <you@example.com>" rsa4096 sign never
gpg --armor --export-secret-keys "Northern Lights packages" > signing-key.asc
```

Add two repository secrets (Settings > Secrets and variables > Actions):

- `PACKAGE_SIGNING_KEY`: the contents of `signing-key.asc`
- `PACKAGE_SIGNING_PASSPHRASE`: its passphrase

Then delete `signing-key.asc` and keep a backup of the key somewhere safe. If the
key changes, everyone who added the repository has to fetch the new public key.

### GitHub Pages

After the first release publishes the `gh-pages` branch, turn on Pages under
Settings > Pages: Source "Deploy from a branch", branch `gh-pages`, folder `/`.
The repositories are then served at https://yeixio.github.io/northern-lights/.
If Pages uses a custom domain, set the `PACKAGES_URL` repository variable to it.

### Package visibility

GitHub Container Registry packages start out private. After the first release,
make both `northern-lights` and `charts/northern-lights` public under the
organization's Packages tab (Package settings > Change visibility).

### Homebrew

The formula commit goes straight to main. If main is protected, allow GitHub
Actions to push to it, or update the formula's `url` and `sha256` by hand.
