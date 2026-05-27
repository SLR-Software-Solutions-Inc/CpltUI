# CpltUI Architecture

Cross-platform desktop GUI wrapping [GitHub Copilot CLI](https://docs.github.com/en/copilot/github-copilot-in-the-cli) (v1.0.54) via its Agent Client Protocol (ACP) server mode.

```
┌──────────────────────────────────────────────────────────────────┐
│ Tauri Window  (native: macOS / Linux / Windows)                  │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ Webview  ── Svelte 5 + TypeScript + Vite                     │ │
│ │   Sidebar · ChatPane · Composer · MessageBlock · HUD         │ │
│ │   RepoChip · PlanCard · PremiumMeter · Onboarding            │ │
│ │   design-system/ (Aurora-Linear tokens + primitives)         │ │
│ │   ipc.ts: typed invoke + listen wrappers                     │ │
│ └──────────────────────────────────────────────────────────────┘ │
│           ▲ event "sidecar-event"     │ command "send_to_sidecar"│
│ ┌─────────┴───────────────────────────┴───────────────────────┐  │
│ │ Tauri Backend  ── Rust 1.95 + tauri 2.11                    │  │
│ │   spawn_sidecar() → node sidecar/dist/index.js              │  │
│ │   stdin Mutex<ChildStdin>  ·  stdout/stderr reader threads  │  │
│ │   env: COPILOT_AUTO_UPDATE=false  NO_COLOR=1                │  │
│ └─────────────────────────────────────────────────────────────┘  │
└────────────────────────────┬─────────────────────────────────────┘
                             │ stdio (newline JSON, IPC_CONTRACT.md)
┌────────────────────────────┴─────────────────────────────────────┐
│ Sidecar Process  ── Node ≥ 20 + TypeScript                       │
│   readline → InboundMessage dispatch                             │
│   AcpClient (acpClient.ts) wraps ClientSideConnection            │
│   handlers/{sessionUpdate, permission, fs}.ts                    │
└────────────────────────────┬─────────────────────────────────────┘
                             │ ACP JSON-RPC over stdio
                ┌────────────┴────────────┐
                │ copilot --acp v1.0.54   │
                │ --no-auto-update        │
                └────────────┬────────────┘
                             │ HTTPS
                             ▼
              GitHub Copilot · MCP servers · BYOK providers
```

## Why this shape

Copilot CLI exposes two machine-readable I/O modes: JSONL (`--output-format json`) and ACP (`--acp`). We chose **ACP** because it is:

- **Bidirectional** — sidecar responds to tool-permission requests; JSONL is one-way.
- **Spec'd + versioned** — `protocolVersion: 1` (Zed's Agent Client Protocol).
- **Structured** — `available_commands_update` notifications carry every slash command; no ANSI scraping.
- **Has reference clients** — Zed editor implements ACP.
- **Matches the ClawdUI shape** — JSON-RPC over stdio mirrors how ClawdUI's sidecar bridges the Anthropic Claude Agent SDK.

The Rust layer is intentionally thin: spawn + stdio relay. All Copilot logic lives in TypeScript.

## Components

### Frontend (`src/`)

| File | Role |
|------|------|
| `App.svelte` | Orchestrator. Mounts IPC listener, dispatches `SidecarEvt`, owns top-level state. |
| `lib/Sidebar.svelte` | Repo-grouped sessions, status pill. |
| `lib/ChatPane.svelte` | Header (repo + model + agent + plan toggle + HUD) + message stream + Composer slot. |
| `lib/Composer.svelte` | Textarea, `#` PR picker, `@` agent picker, `/` command palette, Send/Stop. |
| `lib/MessageBlock.svelte` | Renders user / assistant / tool-call / plan blocks. |
| `lib/PlanCard.svelte` | Checklist UI for `session/update.plan` entries. |
| `lib/HUD.svelte` + `PremiumMeter.svelte` | Token + premium-request meters with model multiplier. |
| `lib/RepoChip.svelte` | owner/repo @ branch chip. |
| `lib/SettingsPanel.svelte` | 9-tab slide-over: Model / Permissions / Session / SystemPrompt / Tools / MCP / Agents / Limits / Advanced. |
| `lib/FieldControl.svelte` | Generic control renderer. |
| `lib/Onboarding.svelte` | First-run modal that surfaces `auth_required` and starts ACP `authenticate`. |
| `lib/ipc.ts` | Typed `sendToSidecar(msg)` and `onSidecarEvent(handler)` wrappers. |
| `lib/types.ts` / `settings.ts` / `format.ts` | Data shapes, persistent settings store, formatters. |
| `lib/mock-data.ts` | DEV-only fallback when no sidecar is reachable. |
| `lib/design-system/tokens.{css,ts}` + `primitives/{Button,Card,Pill,Input}.svelte` | Aurora-Linear tokens + primitives. |

### Rust backend (`src-tauri/src/lib.rs`)

| Concern | Implementation |
|---------|----------------|
| Sidecar discovery | `resolve_sidecar_script()` checks `CPLTUI_SIDECAR` env, then `cwd / cwd/.. / cwd/../..` for `sidecar/dist/index.js`, falls back to `CARGO_MANIFEST_DIR/../sidecar/dist/index.js`. |
| Spawn | `std::process::Command::new("node").arg(script).stdin/out/err(piped).spawn()` |
| Env | `COPILOT_AUTO_UPDATE=false`, `NO_COLOR=1`, `CPLTUI_VERSION=<build>` |
| Stdin | `Arc<Sidecar { stdin: Mutex<ChildStdin> }>` in app state |
| Stdout | Background thread, line-buffered, JSON-parsed, forwarded as `sidecar-event` |
| Stderr | Background thread, line-buffered, forwarded as `sidecar-stderr` |
| FE → BE command | `send_to_sidecar(payload: String) -> Result<(), String>` writes `payload + \n` to child stdin |
| BE → FE events | `sidecar-event`, `sidecar-stderr` |

### Sidecar (`sidecar/`)

| File | Role |
|------|------|
| `index.ts` | Readline loop over stdin, dispatches `InboundMessage` to ACP client + handlers; emits `SidecarEvt` JSON lines to stdout. |
| `acpClient.ts` | `AcpClient` class — spawns `copilot --acp --no-auto-update`; wraps `@zed-industries/agent-client-protocol`'s `ClientSideConnection`; exposes `initialize`, `newSession`, `prompt`, `cancel`, `authenticate`, `setModelViaSlash`, `dispose`. |
| `handlers/sessionUpdate.ts` | Forwards ACP `session/update` notifications. |
| `handlers/permission.ts` | Bridges ACP `session/request_permission` ↔ frontend (pending request map, resolves on `permission_response`). |
| `handlers/fs.ts` | Serves ACP `fs/read_text_file` + `fs/write_text_file` callbacks. |

### Copilot CLI

| Concern | Value |
|---------|-------|
| Binary | `copilot` (`npm install -g @github/copilot@1.0.54`) |
| Version pin | `1.0.54` exact (no caret) |
| Spawn flags | `--acp --no-auto-update` |
| Spawn env | `COPILOT_AUTO_UPDATE=false`, `NO_COLOR=1`, `TERM=dumb` |
| Auth source | Owned by CLI (`~/.copilot/` device-code) OR env `COPILOT_GITHUB_TOKEN` / `GH_TOKEN` / `GITHUB_TOKEN` |
| Session storage | `~/.copilot/session-store.db` (sqlite) — Copilot-owned |

## Session lifecycle

1. App boots → Rust spawns sidecar → sidecar spawns `copilot --acp`.
2. Sidecar sends ACP `initialize` → emits `ready` event.
3. If `authMethods` non-empty and no env token → emit `auth_required` → frontend opens Onboarding.
4. User clicks "New session" → frontend sends `{type:"session_new", cwd, model}` → sidecar calls ACP `session/new` → emits `session_started` with `sessionId`.
5. User types prompt → frontend sends `{type:"session_prompt", sessionId, content:[{type:"text",text}]}` → sidecar calls ACP `session/prompt`.
6. Sidecar receives streamed `session/update` notifications and forwards as `session_update` events:
   - `agent_message_chunk` → appends to streaming assistant message
   - `tool_call` / `tool_call_update` → renders in MessageBlock
   - `plan` → renders in PlanCard
   - `available_commands_update` → Composer slash-command list updates live
   - `current_mode_update` → Plan toggle reflects
7. Sidecar may receive ACP `session/request_permission` → emits `permission_request` → user picks an option → frontend sends `{type:"permission_response", requestId, optionId}` → sidecar resolves the awaiting promise.
8. Turn ends → sidecar emits `session_turn_complete` with `stopReason`.
9. User clicks Stop → frontend sends `{type:"session_cancel", sessionId}` → sidecar calls ACP `session/cancel`.

## Settings flow

`Cmd+,` opens the panel.

| Tab | Covers | Live? |
|-----|--------|-------|
| Model | `model`, reasoning effort, custom provider env (`COPILOT_PROVIDER_*`) | LIVE via `set_model` → `/model` slash |
| Permissions | permission mode, trusted-folders, URL allow list, `--allow-all` guard | respawn |
| Session | `--cwd`, `--add-dir`, `--resume`, `--continue` | respawn |
| System Prompt | AGENTS.md chain | respawn |
| Tools | `--allow-tool`, `--deny-tool` (shell(cmd) / write / MCP_SERVER) | respawn |
| MCP | `~/.copilot/mcp-config.json` editor + `--additional-mcp-config` + GH MCP toolset filter | respawn |
| Agents | `--agent` picker, custom agent markdown | respawn |
| Limits / Usage | premium-request budget guard, session token cap | live (advisory) |
| Advanced | `--autopilot` guard, `COPILOT_OFFLINE`, `COPILOT_HOME` | respawn |

## Threat model

- **Sidecar inherits the host's `copilot` CLI authentication.** CpltUI never reads or stores credentials directly.
- **Settings live in `localStorage`** (Tauri webview, app-private). Not synced.
- **Permission-mode is honored end-to-end**: ACP `session/request_permission` is surfaced as a modal; `--allow-all` (the Copilot equivalent of `bypassPermissions`) requires explicit user toggle.
- **Tool calls happen inside Copilot CLI.** This app does not invent its own tool execution path; we only relay events.
- **Telemetry**: Copilot CLI collects prompts/responses per Copilot Product Terms. The Onboarding modal links to disclosure. BYOK mode (`COPILOT_PROVIDER_*` + Ollama) is the privacy escape hatch.

## Build / run / package

```sh
# install
npm install
cd sidecar && npm install && cd ..

# dev (Vite + Tauri + sidecar live)
npm run tauri:dev

# build production binary
npm run tauri:build

# smoke test the ACP handshake against the system-installed copilot
npm run smoke:handshake
```

Requires Node ≥ 20, Rust 1.95+, `copilot` v1.0.54 on `PATH`.

## Version pin policy

- `@github/copilot` pinned exact to `1.0.54` (no caret).
- `COPILOT_AUTO_UPDATE=false` set in both sidecar env and Rust spawn env.
- `--no-auto-update` flag on every spawn.
- CI runs `npm run smoke:handshake` on every PR; asserts `protocolVersion === 1` and `agentCapabilities.loadSession === true`. Build fails on drift.
- Bump cadence: monthly. Re-run handshake snapshot test on bump.

## CI

`.forgejo/workflows/handshake.yml`:

- Runs on `macos-arm64` (per Master CLAUDE.md = `macos-vm103`).
- Jobs:
  1. `acp-handshake`: install Copilot 1.0.54 globally → run `smoke:handshake` → fail on assertion mismatch.
  2. `build-frontend`: `npm run build` + `cd src-tauri && cargo check`.
- `concurrency` cancels in-flight runs on same ref.
- Notarization / signing live in a separate workflow (TODO).
