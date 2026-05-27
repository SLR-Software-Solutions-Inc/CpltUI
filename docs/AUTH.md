# Auth

CpltUI never holds the GitHub Copilot token. The `copilot` CLI owns auth. CpltUI only detects auth state and surfaces UI.

## Auth sources (precedence)

| # | Source | How CLI discovers |
|---|--------|-------------------|
| 1 | `COPILOT_GITHUB_TOKEN` env | Highest priority. Set before CpltUI launches. |
| 2 | `GH_TOKEN` env | Falls back when (1) is unset. |
| 3 | `GITHUB_TOKEN` env | Falls back when (2) is unset. |
| 4 | `~/.copilot/` device-code state | Auto-detected by CLI on every spawn. |

If none of the above are present, the sidecar's `initialize` handshake returns a non-empty `authMethods[]` array, and the sidecar emits `auth_required` to the frontend.

## First-run UX

1. Sidecar boots, calls ACP `initialize`, gets `authMethods=[{id:"login", name:"..."}]`.
2. Sidecar emits `{type:"auth_required", methods, hint}`.
3. Frontend opens **Onboarding modal** (`src/lib/Onboarding.svelte`).
4. User clicks **"Sign in with GitHub"** → frontend sends `{type:"authenticate", methodId}` → sidecar calls ACP `authenticate` → Copilot CLI prints `verification_uri` + `user_code` to its own stderr.
5. ACP today does NOT carry the device code back into the channel structured; the CLI expects an interactive TTY. In v1 of CpltUI we recommend the user run `copilot` once in any terminal to complete `/login`, then return to CpltUI. The Onboarding modal includes this fallback instruction.
6. Sidecar re-emits `ready` once `~/.copilot/` shows valid credentials; frontend closes the modal.

## Token storage

| Where | What | CpltUI access |
|-------|------|---------------|
| `~/.copilot/auth.json` (or equivalent) | Device-code credentials, refresh tokens | None — Copilot CLI owns it |
| OS env (`COPILOT_GITHUB_TOKEN`, etc.) | PAT if used | Read by CLI only; CpltUI never reads |
| `localStorage` (Tauri webview) | App settings (NOT tokens) | UI-only |
| `~/.copilot/session-store.db` | Session history (sqlite) | Read-only via ACP `loadSession` |

## BYOK — bring your own model

Copilot CLI supports custom providers via `COPILOT_PROVIDER_*` env vars:

| Var | Purpose |
|-----|---------|
| `COPILOT_PROVIDER_NAME` | One of `openai`, `azure-openai`, `anthropic`, `ollama` |
| `COPILOT_PROVIDER_API_KEY` | Provider API key |
| `COPILOT_PROVIDER_BASE_URL` | Override endpoint (Azure / self-hosted Ollama) |
| `COPILOT_PROVIDER_MODEL` | Override model name |

When set, Copilot CLI bypasses GitHub Copilot routing — no Copilot subscription needed, no GH token sent. **Privacy escape hatch.**

Also: `COPILOT_OFFLINE=true` forces local-only operation (Ollama provider).

## Telemetry disclosure

Per GitHub Copilot Product Terms, Copilot CLI collects:

- Prompts you send
- Responses you receive
- Tool calls executed
- Anonymized usage metrics

There is no documented opt-out flag for Copilot subscription users. To opt out: switch to a BYOK provider via `COPILOT_PROVIDER_*` env.

The Onboarding modal links to this document. The Advanced settings tab surfaces the BYOK editor.

## Required GitHub Copilot subscription

To use Copilot's first-party models (GPT-5, Claude Sonnet 4.5, Gemini 2.5 Pro, o3), an **active GitHub Copilot subscription** is required. The CLI enforces this on first request. BYOK mode does not require a Copilot subscription.

If running inside an org, the org policy "Copilot CLI" must be enabled. That is an org-admin op — CpltUI cannot enable it.

## Forgejo CI auth (separate concern)

The CI handshake job (`.forgejo/workflows/handshake.yml`) authenticates the smoke test via env `COPILOT_GITHUB_TOKEN` injected as a Forgejo Action secret. Master sets the secret manually (admin op — see Master CLAUDE.md).
