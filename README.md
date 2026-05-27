<!--
SPDX-License-Identifier: Apache-2.0
Copyright (c) SLR Software Solutions Inc.
-->

# CpltUI — Native desktop GUI for GitHub Copilot CLI

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg?style=flat-square)](https://www.apache.org/licenses/LICENSE-2.0)
[![Buy Me A Coffee](https://img.shields.io/badge/%E2%99%A5%20Donate-Buy%20Me%20A%20Coffee-FFDD00?style=flat-square)](https://buymeacoffee.com/slrsoft.ca)

> **GitHub Copilot CLI, with a face.** CpltUI wraps the official [GitHub Copilot CLI](https://docs.github.com/en/copilot/github-copilot-in-the-cli) in a tiny native window so you can drive multi-agent sessions, inspect tool calls, resume past conversations, and edit files inline — without giving up the headless-grade fidelity of the CLI itself. Same `~/.copilot/session-store.db` on disk, same Agent Client Protocol (ACP) under the hood, same `copilot` binary on your PATH. Sibling project to [ClawdUI](https://github.com/SLR-Software-Solutions-Inc/ClawdUI).

## Features

| | |
|---|---|
| **Real ACP wiring** | Speaks Agent Client Protocol v1 over stdio with `copilot --acp` — same protocol Zed editor uses. Bidirectional, structured, versioned. |
| **Master Orchestrator Harness** | 5-phase loop (Architect → Dispatch → Gather → 3-parallel-Reviewer Consensus → Decide) injected as system prompt; host-side mechanical loop counter + hard stop at 5 iterations; live `HARNESS  N/5  A·B·C` badge in chat header. |
| **Live model picker** | Click `Model ▾` in header → switch among real Copilot models (Claude Sonnet 4.5, GPT-5, Gemini 2.5 Pro, o3, etc.) via `/model` slash mid-session. |
| **30 live slash commands** | Streamed live from Copilot via ACP `available_commands_update` — `/plan`, `/fleet`, `/research`, `/usage`, `/mcp`, `/model`, `/sandbox`, etc. Composer `/` autocomplete from the live list. |
| **@file picker + drag-drop** | Reference any project file with `@filename`. ACP `resource_link` blocks. Drop files onto composer to attach. |
| **Inline DiffCard** | Every `fs/write_text_file` from Copilot renders as a unified-diff card before landing on disk. |
| **CodeMirror 6 EditorPane** | Click any file in the rail to open in a real editor with syntax highlighting (JS/TS/MD/JSON/HTML/CSS/Rust/Python). `Cmd+S` saves. |
| **Embedded terminal** | xterm.js wired to a Rust PTY (`portable-pty`). Cwd matches session. |
| **Session resume** | Reads `~/.copilot/session-store.db` (sqlite) — every past Copilot session is one click away from full restore. |
| **MCP integration** | Live read of `~/.copilot/mcp-config.json` + per-session `--additional-mcp-config`. |
| **Command palette (⌘K)** | Fuzzy across actions + live slash + model swap + history. |
| **Onboarding device-flow** | Surfaces `verification_uri` + `user_code` parsed from `copilot` stderr — copy + open browser inline. |

## Installation

### macOS (Apple Silicon, recommended)

1. Download the latest `.dmg` from [GitHub Releases](https://github.com/SLR-Software-Solutions-Inc/CpltUI/releases).
2. Open the DMG, drag `CpltUI.app` into `/Applications`.
3. Launch. The binary is signed with `Developer ID Application` (SLR Software Solutions Inc.) and notarized by Apple, so no Gatekeeper override is needed.

### Windows / Linux

Pre-built bundles (`.msi`, `.exe`, `.deb`, `.AppImage`, `.rpm`) are attached to each [release](https://github.com/SLR-Software-Solutions-Inc/CpltUI/releases). macOS arm64 is the primary target; Windows and Linux builds are produced from the same source on every tagged release.

## Quick start

1. **Install Copilot CLI** — `npm install -g @github/copilot@1.0.54`. Authenticate once: run `copilot` in any terminal and complete `/login`.
2. **Open a folder.** CpltUI uses it as the session `cwd`.
3. **Click `+ New session`** in the sidebar. CpltUI seeds the Master Orchestrator harness as the first message; subsequent prompts run through the 5-phase loop automatically.
4. **Ask a question.** Tool calls (Shell, Edit, Web, MCP, ...) appear inline as cards. Approve, reject, or set `allow-all` for the session.

## Requirements

- **GitHub Copilot CLI** v1.0.54 installed and authenticated (`copilot --version` should print 1.0.54). CpltUI delegates credentials to the CLI — it never reads your GitHub token directly.
- **macOS 14** (Sonoma) or newer, **Windows 10** or newer, or a modern **Linux x64** distro with WebKit2GTK.
- **Node 20+** on PATH (current v1.0.0 ships sidecar that calls system `node`; future versions will bundle the runtime — see [`docs/PACKAGING.md`](docs/PACKAGING.md)).
- ~150 MB disk for the app.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ Tauri Window  (native: macOS / Linux / Windows)                  │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ Webview — Svelte 5 + TS + Vite                               │ │
│ │   Sidebar · ChatPane · Composer · Editor · Terminal · HUD    │ │
│ │   design-system/ (Aurora-Linear tokens + primitives)         │ │
│ └──────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬─────────────────────────────────────┘
                             │ stdio (newline JSON)
┌────────────────────────────┴─────────────────────────────────────┐
│ Node sidecar — ACP client                                        │
│   spawns `copilot --acp --no-auto-update`                        │
│   harness injection + orchestrator-loop parser                   │
│   handlers/{sessionUpdate, permission, fs, environment, history} │
└────────────────────────────┬─────────────────────────────────────┘
                             │ ACP JSON-RPC over stdio
                             ▼
                    copilot v1.0.54  →  GitHub Copilot · MCP · BYOK
```

Full details: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Development

```sh
git clone git@github.com:SLR-Software-Solutions-Inc/CpltUI.git
cd CpltUI
npm install
npm --prefix sidecar install && npm run sidecar:build
npm run tauri:dev
```

Smoke-test the ACP handshake without launching the app:

```sh
npm run smoke:handshake
```

## Privacy

CpltUI itself does **not** ship telemetry. The GitHub Copilot CLI it wraps collects prompts and responses per the Copilot Product Terms — see [`docs/AUTH.md`](docs/AUTH.md) for opt-out paths (BYOK mode via `COPILOT_PROVIDER_*` env, `COPILOT_OFFLINE=true`).

## License

Apache 2.0 — see [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).

Sibling project: [ClawdUI](https://github.com/SLR-Software-Solutions-Inc/ClawdUI) (same architecture, wraps Claude Code instead of Copilot).
