# Packaging — runtime + bundling

## Current state (v0.1.0)

| Component | Status |
|---|---|
| Frontend (Vite/Svelte) | Bundled into `dist/` at build time. Self-contained. |
| Rust shell (`src-tauri/target/release/app`) | Single-binary per platform. Self-contained. |
| Sidecar `dist/index.js` | esbuild bundle. ~200 KB. Self-contained except native modules. |
| Sidecar native modules | `better-sqlite3` + `bindings` + `file-uri-to-path` bundled in `bundle.resources`. Platform-specific `.node` binaries ride along with each per-OS installer. |
| **Node runtime** | **REQUIRED on host machine.** Not yet bundled into the installer. |
| Copilot CLI | Required separately (`npm install -g @github/copilot@1.0.54`). License forbids redistribution standalone. |

## What's missing for full standalone install

1. **Node runtime bundling.** Tauri spawns `node <script>`; `node` must be on `PATH`. Non-developers may not have it.

### Path A — Tauri externalBin (recommended)

```jsonc
// tauri.conf.json
{
  "bundle": {
    "externalBin": ["binaries/node"]
  }
}
```

CI must place `binaries/node-aarch64-apple-darwin`, `binaries/node-x86_64-apple-darwin`, `binaries/node-x86_64-pc-windows-msvc.exe`, `binaries/node-x86_64-unknown-linux-gnu` before `tauri build`. Use the official Node tarball releases. Rust `spawn_sidecar` must change to invoke the resolved sidecar binary path (Tauri provides via `app.path().resource_dir()` + platform suffix).

### Path B — Migrate sidecar to Bun single-binary

```sh
bun build --compile --minify --target=bun-darwin-arm64 \
  sidecar/index.ts --outfile sidecar-bin/cpltui-sidecar-aarch64
```

Produces a single ~70 MB binary with Bun runtime embedded. Add to Tauri `externalBin`. better-sqlite3 has Bun-native bindings (works as of bun@1.1+).

**Tradeoffs:**
- Bun: smaller binary surface, faster startup, but new runtime dependency to vet.
- externalBin Node: official runtime, larger total install (Node ~80 MB), proven path.

### Path C — Require user-installed Node (current shipping reality)

- Document `brew install node` (macOS), `apt install nodejs` (Debian), `winget install OpenJS.NodeJS` (Windows) as pre-requisites.
- Installer shows a check-and-prompt screen on first run if `node --version` < 20.

## Copilot CLI

License explicitly forbids redistributing the `copilot` binary as part of an app. User installs separately:

```sh
npm install -g @github/copilot@1.0.54
```

Onboarding modal links to the install command.

## Sign + notarize

- macOS: `fastlane mac release_arm64` lane signs via match (Developer ID), notarizes via `notarytool`. CI workflow `release.yml` triggers on `v*` tag push.
- Linux: AppImage unsigned (community norm).
- Windows: NSIS .exe unsigned. Future: EV cert for SmartScreen pass.

## Auto-update

Not configured. `tauri-plugin-updater` would need:
1. Generated keypair (`cargo tauri signer generate`).
2. `updater` block in `tauri.conf.json` with endpoint URL.
3. Backend serving `latest.json` per platform.
4. Static-site host or Forgejo release JSON shimmed.

Deferred to v0.2.

## Telemetry

CpltUI itself: no telemetry shipped.
Copilot CLI: collects prompts/responses per GitHub Copilot Product Terms. No documented opt-out for Copilot subscription users; BYOK mode (`COPILOT_PROVIDER_*` env) escapes.
