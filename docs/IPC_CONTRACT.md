# CpltUI IPC contract (frozen)

Master-defined contract between Frontend (Svelte) ↔ Rust (Tauri) ↔ Node sidecar ↔ Copilot CLI (ACP).
Workers must conform to this exactly. Do not invent new event shapes.

## Layer map

```
Frontend (Svelte)
   ↓  invoke("send_to_sidecar", payload: string)        ↑  listen("sidecar-event", payload: object)
Rust (Tauri) — passes JSON strings unchanged in both directions
   ↓  child.stdin write JSON line                        ↑  child.stdout read JSON line
Node sidecar
   ↓  ACP JSON-RPC over stdio                            ↑  ACP notifications + responses
copilot --acp (v1.0.54)
```

## Frontend → Sidecar (inbound messages)

All `send_to_sidecar` payloads are JSON objects with a `type` discriminator. Sidecar dispatches by `type`.

| type | fields | effect |
|---|---|---|
| `ping` | — | sidecar replies with `{type:"pong"}` event |
| `session_new` | `{cwd?:string, model?:string, agent?:string, addDirs?:string[], allowAllTools?:boolean, mcpConfig?:object}` | sidecar calls ACP `session/new`, emits `session_started` |
| `session_prompt` | `{sessionId:string, content:[{type:"text",text:string}\|{type:"image",mimeType:string,data:string}]}` | sidecar calls ACP `session/prompt` |
| `session_cancel` | `{sessionId:string}` | sidecar calls ACP `session/cancel` |
| `permission_response` | `{requestId:string, granted:boolean, scope?:"once"\|"session"\|"always"}` | sidecar replies to pending `session/request_permission` |
| `set_model` | `{sessionId:string, model:string}` | sidecar injects `/model <name>` via ACP `session/prompt` with system marker — or respawns if not supported |
| `end_session` | `{sessionId:string}` | sidecar closes session, emits `session_ended` |

## Sidecar → Frontend (outbound events)

All emitted via `app.emit("sidecar-event", payload)` from Rust. Payload is JSON object with `type` discriminator.

| type | fields | when |
|---|---|---|
| `pong` | — | reply to `ping` |
| `ready` | `{copilotVersion:string, protocolVersion:number, capabilities:object}` | after ACP `initialize` handshake succeeds at sidecar boot |
| `auth_required` | `{method:"device_code"\|"oauth"\|"env", verification_uri?:string, user_code?:string, expires_in?:number}` | sidecar detected unauthenticated state |
| `session_started` | `{sessionId:string, cwd:string, model:string}` | after `session_new` succeeds |
| `session_update` | `{sessionId:string, update:UpdateBody}` | streamed from ACP `session/update` notifications |
| `permission_request` | `{requestId:string, sessionId:string, tool:string, args:object, mode:string}` | from ACP `session/request_permission` |
| `session_ended` | `{sessionId:string, reason?:string}` | session closed |
| `error` | `{sessionId?:string, code:string, message:string}` | any failure |

### UpdateBody variants (inside `session_update.update`)

Direct passthrough of ACP `session/update` notification body — preserve shape:

```ts
type UpdateBody =
  | { kind:"agent_message_chunk"; content:{type:"text",text:string} }
  | { kind:"tool_call"; toolCallId:string; title:string; status:string; rawInput?:object }
  | { kind:"tool_call_update"; toolCallId:string; status:string; content?:any }
  | { kind:"plan"; entries:Array<{content:string, priority:string, status:string}> }
  | { kind:"available_commands_update"; availableCommands:Array<{name:string, description:string}> }
  | { kind:"current_mode_update"; currentModeId:string }
  | { kind:"user_message_chunk"; content:{type:"text",text:string} }
```

## Sidecar boot sequence

1. Sidecar process starts (Rust spawned).
2. Spawn `copilot --acp --no-auto-update` as child with env `COPILOT_AUTO_UPDATE=false`.
3. Send ACP `initialize` request: `{protocolVersion:1, clientCapabilities:{fs:{readTextFile:true,writeTextFile:true}}}`.
4. On `initialize` response, emit `ready` event with `protocolVersion` + `capabilities`.
5. If `authMethods[].length > 0` and no env token: emit `auth_required` event.
6. Idle until frontend sends `session_new`.

## Auth strategy

| Source | Detection | Action |
|---|---|---|
| Env `COPILOT_GITHUB_TOKEN` or `GH_TOKEN` set | Rust reads env before spawn | passthrough — CLI uses it |
| Stored device-code in `~/.copilot/` | CLI auto-detects | passthrough — no UI needed |
| Neither | initialize succeeds but `authMethods` non-empty | emit `auth_required` → frontend opens onboarding modal that shells out to `copilot` with TTY hint |

## Process flags (always on)

```
copilot --acp --no-auto-update
```

Env:
```
COPILOT_AUTO_UPDATE=false
NO_COLOR=1
TERM=dumb
```

## Error codes

| code | meaning |
|---|---|
| `acp_handshake_failed` | initialize threw or wrong protocolVersion |
| `copilot_not_found` | CLI binary missing on PATH |
| `auth_failed` | login flow rejected |
| `session_not_found` | sessionId unknown |
| `acp_internal` | ACP returned an error response |
| `child_crashed` | copilot process exited unexpectedly |
