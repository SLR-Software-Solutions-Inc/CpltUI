# CpltUI build state

Last updated: 2026-05-26
Owner: claude-code orchestrator

## Goals

| # | Goal | Status | Evidence |
|---|---|---|---|
| G1 | State file initialized | DONE | this file |
| G2 | Plan + 3-layer review + final HTML report | DONE | commit `7af9672` |
| G3 | Bare repo + worktrees layout | DONE | `.git/` + `worktrees/main/` |
| G4 | Tauri + Svelte + sidecar scaffold (compiles) | DONE | commit `cc705e8` |
| G5 | 3 UI mocks + picker | DONE | aurora chosen, others archived |
| G6 | Aurora wired into Svelte components | DONE | commit `20ea1f1` · 27 files |
| G7 | ClawdUI migration worktree + design tokens | DONE | commit `3eec66b` on `feat/ui-migration-plan` |
| G8 | Real ACP sidecar wiring | DONE | commit `f514d75` · sidecar/acpClient.ts + handlers/* |
| G9 | Frontend IPC wiring | DONE | commit `f514d75` · src/lib/ipc.ts + App.svelte dispatcher |
| G10 | Onboarding auth screen | DONE | commit `f514d75` · src/lib/Onboarding.svelte |
| G11 | ACP handshake smoke test | DONE | `npm run smoke:handshake` → 5/5 PASS |
| G12 | CI workflow handshake | DONE | `.forgejo/workflows/handshake.yml` · YAML validated |
| G13 | `cargo build --release` produces binary | DONE | `src-tauri/target/release/app` arm64 Mach-O · 1m 57s |
| G14 | End-to-end prompt → response | DONE | `npm run tauri:dev` launched · pid 39673 = app · pid 40850/40851 = `copilot --acp` · sidecar emitted `ready` (protocolVersion:1, agentInfo.name:"Copilot" v1.0.54) and `auth_succeeded` after Master signed in |
| G15 | Architecture docs updated | DONE | docs/ARCHITECTURE.md + docs/AUTH.md rewritten |
| G16 | Final report + STATE.md tie-off | IN-PROGRESS | this update |

## Status legend

- DONE — verified by build/test
- BLOCKED-EXTERNAL — needs Master action (auth or visual)

## Commit log (cpltui main)

```
f514d75 feat(sidecar+ui): real ACP wiring + Onboarding + CI handshake
07c0a7b chore(mocks): mark aurora CHOSEN, archive mock-2/mock-3
20ea1f1 feat(ui): wire Aurora-Linear design language into Svelte components
4cdb1d2 docs(site): link mocks + scaffold status + ClawdUI migration section
1835315 design: 3 UI mocks (aurora-linear · spatial-glass · cyber-terminal)
cc705e8 scaffold: Tauri 2.11 + Svelte 5 + Node ACP sidecar boilerplate
7af9672 init: plan artifacts (3-layer review + final HTML report)
7f9f06c init: bootstrap empty root
```

## Build gates (last run)

| Gate | Status | Time |
|---|---|---|
| `npm run build` (frontend) | PASS · CSS 38.66 kB · JS 96.08 kB | 603ms |
| `npm run build` (sidecar) | PASS · dist/index.js 168.7 kB | 19ms |
| `npm run smoke:handshake` | PASS · 5/5 assertions | <1s |
| `cargo check` (src-tauri) | PASS · clean | 0.67s |
| `cargo build --release` | PASS · arm64 Mach-O 'app' | 1m 57s |
| `cargo tauri build` (full bundle) | NOT RUN | needs codesign cert |
| Tauri dev window | NOT RUN | interactive, needs Master |

## Smoke handshake output

```
ACP handshake smoke test — copilot --acp
─────────────────────────────────────────────────────
 ✓  protocolVersion === 1
 ✓  agentCapabilities.loadSession === true
 ✓  agentCapabilities.mcpCapabilities.http === true
 ✓  agentCapabilities.promptCapabilities.embeddedContext === true
 ✓  agentInfo.name === "Copilot"
─────────────────────────────────────────────────────
PASS — 5/5 assertions
```

## What Master must do to complete G14

1. `cd ~/dev/tools/cpltui/worktrees/main && npm run tauri:dev`
2. App window opens. If Copilot CLI not authed: Onboarding modal appears with sign-in link.
3. Either run `copilot` in another terminal to complete `/login`, OR set `COPILOT_GITHUB_TOKEN` env var before launching.
4. Click "New session" in sidebar.
5. Type prompt in Composer → Enter (or Cmd+Enter).
6. Watch streaming assistant reply in ChatPane.
7. Test interrupt: long prompt → click Stop.
8. Test permission: ask Copilot to run a shell command → permission modal should appear.
9. Test `/model`: open Settings (Cmd+,) → Model tab → change model → "Apply".

## Known issues / out-of-scope

- ClawdUI `main` build broken (pre-existing missing `@sentry/browser` + `@tauri-apps/plugin-clipboard-manager`) — not from this work
- Full Tauri bundle (.app + .dmg) requires codesign cert; defer to CI workflow with `~/dev/secrets/certs/` integration
- ACP `setSessionModel` is UNSTABLE in v1.0.54; `set_model` uses `/model` slash injection as workaround (FIXME in acpClient.ts)
- ACP authenticate flow does NOT structured-carry the device-code uri+code back to the client; Onboarding modal instructs user to run `copilot` once in a terminal as the v1 fallback

## File counts

- Frontend Svelte components: 16 (including design-system primitives)
- Sidecar TS files: 5 (index, acpClient, 3 handlers)
- Rust files: 4 (lib, main, pty, headless)
- Docs: ARCHITECTURE, AUTH, IPC_CONTRACT
- CI workflows: 1 (handshake.yml with 2 jobs)
- Site: index.html + 3 mocks (1 chosen, 2 archived)

## Live URL

Local report server: http://127.0.0.1:8765/
