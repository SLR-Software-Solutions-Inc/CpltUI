// Canonical app state store. Single source of truth.
// All components read from `app` import; only the App.svelte dispatcher mutates it.
//
// Svelte 5 runes inside a class — values exposed are reactive via the export.

import type { SessionUpdateBody, SidecarEvt } from './ipc';

export type MsgKind = 'user' | 'assistant' | 'tool_call' | 'plan' | 'system' | 'fs_write';

export interface FsWriteView {
  path: string;
  isNew: boolean;
  additions: number;
  deletions: number;
  patch: string;
  truncated: boolean;
  bytes: number;
}

export interface ToolCallView {
  toolCallId: string;
  title: string;
  status: string;
  rawInput?: unknown;
  outputs: Array<{ kind: 'text' | 'diff' | 'json'; content: string }>;
}

export interface PlanEntry {
  content: string;
  priority: string;
  status: string;
}

export interface Msg {
  id: string;
  kind: MsgKind;
  createdAt: number;
  text?: string; // user / assistant / system
  tool?: ToolCallView; // tool_call
  plan?: PlanEntry[]; // plan
  fsWrite?: FsWriteView; // fs_write
  streaming?: boolean; // assistant: still receiving chunks
}

export interface HudView {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  premiumReqs: number;
  modelMultiplier: number;
  contextUsed: number;
  contextMax: number;
}

export interface LiveSession {
  id: string;
  cwd: string;
  model: string | null;
  agent: string | null;
  status: 'idle' | 'streaming' | 'closed' | 'error';
  messages: Msg[];
  hud: HudView;
  createdAt: number;
}

export interface PendingPermission {
  requestId: string;
  sessionId: string;
  title: string;
  options: Array<{ optionId: string; kind: string; name?: string }>;
}

const emptyHud = (mult: number = 1): HudView => ({
  inputTokens: 0,
  outputTokens: 0,
  costUsd: 0,
  premiumReqs: 0,
  modelMultiplier: mult,
  contextUsed: 0,
  contextMax: 200_000,
});

class AppState {
  sessions = $state<LiveSession[]>([]);
  currentSessionId = $state<string | null>(null);
  availableCommands = $state<Array<{ name: string; description?: string }>>([]);
  authState = $state<'checking' | 'required' | 'ready'>('checking');
  authMethods = $state<Array<{ id: string; name?: string }>>([]);
  authHint = $state<string | undefined>(undefined);
  authVerificationUri = $state<string | undefined>(undefined);
  authUserCode = $state<string | undefined>(undefined);
  pendingPermission = $state<PendingPermission | null>(null);
  connectionState = $state<'connecting' | 'connected' | 'disconnected'>('connecting');
  copilotVersion = $state<string>('');
  agentCapabilities = $state<Record<string, unknown>>({});
  planMode = $state<boolean>(false);
  stderrBuffer = $state<string[]>([]);
  lastError = $state<{ code: string; message: string } | null>(null);
  mcpServers = $state<Array<{ name: string; type: string; command?: string; url?: string; enabled: boolean }>>([]);
  models = $state<Array<{ id: string; name: string; provider: string; contextWindow: number; premiumMultiplier: number }>>([]);
  copilotHome = $state<string>('');
  agentsMdBySession = $state<Map<string, Array<{ path: string; bytes: number; scope: string }>>>(new Map());
  // Harness canonical text broadcast by sidecar on boot
  harnessDefaultText = $state<string>('');
  harnessVersion = $state<string>('');
  sessionHistory = $state<
    Array<{
      id: string;
      cwd: string;
      repository: string | null;
      branch: string | null;
      summary: string;
      createdAt: string;
      updatedAt: string;
    }>
  >([]);
  // Per-session orchestrator state
  orchestratorBySession = $state<
    Map<
      string,
      {
        iter: number;
        bound: number;
        lastReview: { A: 'APPROVE' | 'REJECT'; B: 'APPROVE' | 'REJECT'; C: 'APPROVE' | 'REJECT' } | null;
        consensus: 'APPROVE' | 'REJECT' | null;
        complete: boolean;
        loopExceeded: boolean;
      }
    >
  >(new Map());

  current = $derived<LiveSession | null>(
    this.currentSessionId
      ? this.sessions.find((s) => s.id === this.currentSessionId) ?? null
      : null,
  );

  ensureSession(id: string, cwd: string, model: string | null, agent: string | null = null): LiveSession {
    let s = this.sessions.find((x) => x.id === id);
    if (s) return s;
    s = {
      id,
      cwd,
      model,
      agent,
      status: 'idle',
      messages: [],
      hud: emptyHud(),
      createdAt: Date.now(),
    };
    this.sessions = [...this.sessions, s];
    return s;
  }

  setCurrent(id: string | null) {
    this.currentSessionId = id;
  }

  appendUserMessage(sessionId: string, text: string): void {
    const s = this.sessions.find((x) => x.id === sessionId);
    if (!s) return;
    s.messages = [
      ...s.messages,
      { id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, kind: 'user', createdAt: Date.now(), text },
    ];
    s.hud = { ...s.hud, inputTokens: s.hud.inputTokens + Math.ceil(text.length / 4) };
    this.sessions = [...this.sessions];
  }

  // Apply ACP session/update notification.
  applyUpdate(sessionId: string, update: SessionUpdateBody): void {
    const s = this.sessions.find((x) => x.id === sessionId);
    if (!s) return;

    switch (update.sessionUpdate) {
      case 'agent_message_chunk': {
        const last = s.messages[s.messages.length - 1];
        if (last && last.kind === 'assistant' && last.streaming) {
          last.text = (last.text ?? '') + update.content.text;
        } else {
          s.messages = [
            ...s.messages,
            {
              id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              kind: 'assistant',
              createdAt: Date.now(),
              text: update.content.text,
              streaming: true,
            },
          ];
        }
        s.status = 'streaming';
        s.hud = { ...s.hud, outputTokens: s.hud.outputTokens + Math.ceil(update.content.text.length / 4) };
        break;
      }
      case 'user_message_chunk':
        // sometimes echoed back — only render if not already present
        break;
      case 'tool_call': {
        const view: ToolCallView = {
          toolCallId: update.toolCallId,
          title: update.title ?? update.toolCallId,
          status: update.status ?? 'pending',
          rawInput: update.rawInput,
          outputs: [],
        };
        s.messages = [
          ...s.messages,
          {
            id: `t-${update.toolCallId}`,
            kind: 'tool_call',
            createdAt: Date.now(),
            tool: view,
          },
        ];
        break;
      }
      case 'tool_call_update': {
        const m = s.messages.find((x) => x.kind === 'tool_call' && x.tool?.toolCallId === update.toolCallId);
        if (m && m.tool) {
          if (update.status) m.tool.status = update.status;
          if (update.content !== undefined) {
            const text = typeof update.content === 'string' ? update.content : JSON.stringify(update.content);
            m.tool.outputs = [...m.tool.outputs, { kind: 'text', content: text }];
          }
        }
        break;
      }
      case 'plan': {
        // replace existing plan (ACP semantics: plan re-emits cumulative state)
        const existing = s.messages.find((x) => x.kind === 'plan');
        if (existing) {
          existing.plan = update.entries;
        } else {
          s.messages = [
            ...s.messages,
            {
              id: `p-${Date.now()}`,
              kind: 'plan',
              createdAt: Date.now(),
              plan: update.entries,
            },
          ];
        }
        break;
      }
      case 'available_commands_update':
        this.availableCommands = update.availableCommands;
        break;
      case 'current_mode_update':
        this.planMode = update.currentModeId === 'plan';
        break;
    }

    // force outer array re-trigger
    this.sessions = [...this.sessions];
  }

  finishTurn(sessionId: string): void {
    const s = this.sessions.find((x) => x.id === sessionId);
    if (!s) return;
    const last = s.messages[s.messages.length - 1];
    if (last && last.kind === 'assistant' && last.streaming) {
      last.streaming = false;
    }
    s.status = 'idle';
    s.hud = { ...s.hud, premiumReqs: s.hud.premiumReqs + 1 };
    this.sessions = [...this.sessions];
  }

  endSession(sessionId: string): void {
    const s = this.sessions.find((x) => x.id === sessionId);
    if (s) s.status = 'closed';
    this.sessions = [...this.sessions];
    if (this.currentSessionId === sessionId) this.currentSessionId = null;
  }

  setAuthRequired(methods: Array<{ id: string; name?: string }>, hint?: string): void {
    this.authMethods = methods;
    this.authHint = hint;
    this.authState = 'required';
  }

  setAuthReady(): void {
    this.authState = 'ready';
    this.authVerificationUri = undefined;
    this.authUserCode = undefined;
  }

  // Heuristic: scan copilot stderr for device-flow lines.
  // Copilot CLI prints lines like:
  //   "First copy your one-time code: ABCD-1234"
  //   "Then visit: https://github.com/login/device"
  ingestStderr(line: string): void {
    this.stderrBuffer = [...this.stderrBuffer.slice(-40), line];
    const codeMatch = line.match(/\b([A-Z0-9]{4}-[A-Z0-9]{4})\b/);
    if (codeMatch) this.authUserCode = codeMatch[1];
    const uriMatch = line.match(/https?:\/\/[^\s]+/);
    if (uriMatch && /github\.com\/login\/device/.test(uriMatch[0])) {
      this.authVerificationUri = uriMatch[0];
    }
  }

  setPermissionRequest(p: PendingPermission | null): void {
    this.pendingPermission = p;
  }

  setError(code: string, message: string): void {
    this.lastError = { code, message };
  }
}

export const app = new AppState();

// Top-level dispatcher — Apps call this for each SidecarEvt.
export function dispatchSidecarEvent(evt: SidecarEvt): void {
  switch (evt.type) {
    case 'pong':
      return;
    case 'ready':
      app.copilotVersion =
        (evt.authInfo as { version?: string })?.version ?? '';
      app.agentCapabilities = evt.agentCapabilities;
      if ((evt.authMethods?.length ?? 0) === 0) app.setAuthReady();
      else app.authState = 'checking';
      return;
    case 'auth_required':
      app.setAuthRequired(evt.methods, evt.hint);
      return;
    case 'auth_succeeded':
      app.setAuthReady();
      return;
    case 'session_started':
      app.ensureSession(evt.sessionId, evt.cwd, evt.model);
      if (!app.currentSessionId) app.setCurrent(evt.sessionId);
      return;
    case 'session_update':
      app.applyUpdate(evt.sessionId, evt.update);
      return;
    case 'session_turn_complete':
      app.finishTurn(evt.sessionId);
      return;
    case 'permission_request':
      app.setPermissionRequest({
        requestId: evt.requestId,
        sessionId: evt.sessionId,
        title:
          typeof (evt.toolCall as { title?: string }).title === 'string'
            ? ((evt.toolCall as { title?: string }).title as string)
            : 'Tool requests permission',
        options: evt.options,
      });
      return;
    case 'session_ended':
      app.endSession(evt.sessionId);
      return;
    case 'copilot_stderr':
      app.ingestStderr(evt.line);
      return;
    case 'environment':
      app.mcpServers = evt.mcpServers;
      app.models = evt.models;
      app.copilotHome = evt.copilotHome;
      return;
    case 'agents_md_chain': {
      const m = new Map(app.agentsMdBySession);
      m.set(evt.sessionId, evt.entries);
      app.agentsMdBySession = m;
      return;
    }
    case 'session_history':
      app.sessionHistory = evt.sessions;
      return;
    case 'harness_info':
      app.harnessDefaultText = evt.text;
      app.harnessVersion = evt.version;
      return;
    case 'orchestrator_iter': {
      const m = new Map(app.orchestratorBySession);
      const cur = m.get(evt.sessionId) ?? {
        iter: 0,
        bound: 5,
        lastReview: null,
        consensus: null,
        complete: false,
        loopExceeded: false,
      };
      m.set(evt.sessionId, { ...cur, iter: evt.iter, bound: evt.bound });
      app.orchestratorBySession = m;
      return;
    }
    case 'orchestrator_review': {
      const m = new Map(app.orchestratorBySession);
      const cur = m.get(evt.sessionId) ?? {
        iter: evt.iter,
        bound: 5,
        lastReview: null,
        consensus: null,
        complete: false,
        loopExceeded: false,
      };
      m.set(evt.sessionId, { ...cur, lastReview: evt.verdicts, consensus: evt.consensus });
      app.orchestratorBySession = m;
      return;
    }
    case 'orchestrator_complete': {
      const m = new Map(app.orchestratorBySession);
      const cur = m.get(evt.sessionId);
      if (cur) m.set(evt.sessionId, { ...cur, complete: true });
      app.orchestratorBySession = m;
      return;
    }
    case 'fs_write_diff': {
      // Attribute to current session, render as a message
      const sid = app.currentSessionId;
      if (!sid) return;
      const s = app.sessions.find((x) => x.id === sid);
      if (!s) return;
      s.messages = [
        ...s.messages,
        {
          id: `fs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          kind: 'fs_write',
          createdAt: Date.now(),
          fsWrite: {
            path: evt.path,
            isNew: evt.isNew,
            additions: evt.additions,
            deletions: evt.deletions,
            patch: evt.patch,
            truncated: evt.truncated,
            bytes: evt.bytes,
          },
        },
      ];
      app.sessions = [...app.sessions];
      return;
    }
    case 'orchestrator_loop_exceeded': {
      const m = new Map(app.orchestratorBySession);
      const cur = m.get(evt.sessionId);
      if (cur) m.set(evt.sessionId, { ...cur, loopExceeded: true });
      app.orchestratorBySession = m;
      return;
    }
    case 'sidecar_exit':
      app.connectionState = 'disconnected';
      app.setError(
        'sidecar_exit',
        `Sidecar exited (code=${evt.code ?? '?'}${evt.error ? ', error=' + evt.error : ''}). Reload window (⌘R) to reconnect.`,
      );
      return;
    case 'error':
      app.setError(evt.code, evt.message);
      return;
  }
}
