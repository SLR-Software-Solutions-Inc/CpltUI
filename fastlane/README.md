fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## Mac

### mac setup_env

```sh
[bundle exec] fastlane mac setup_env
```

Sanity-check required env vars and ASC API key file.

### mac sync_certs

```sh
[bundle exec] fastlane mac sync_certs
```

Sync App Store signing cert + profile via match (read-only).

### mac register_bundle_id

```sh
[bundle exec] fastlane mac register_bundle_id
```

Register the bundle ID on the Apple Developer Portal (one-time bootstrap).

### mac match_bootstrap

```sh
[bundle exec] fastlane mac match_bootstrap
```

Bootstrap match for App Store cert + profile. Run once per match repo.

### mac build_appstore

```sh
[bundle exec] fastlane mac build_appstore
```

Build, codesign, and produce a .pkg ready for App Store Connect upload.

### mac upload_appstore

```sh
[bundle exec] fastlane mac upload_appstore
```

Upload an existing .pkg to App Store Connect via Transporter.

### mac build_dmg_notarized

```sh
[bundle exec] fastlane mac build_dmg_notarized
```

Build, codesign with Developer ID, package as DMG, notarize, and staple.

### mac build_both

```sh
[bundle exec] fastlane mac build_both
```

Build BOTH artifacts (App Store .pkg + notarized DMG).

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
