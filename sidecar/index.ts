// CpltUI sidecar — dispatch loop.
//
// Inbound (stdin, one JSON per line): per docs/IPC_CONTRACT.md `InboundMessage`.
// Outbound (stdout, one JSON per line): per docs/IPC_CONTRACT.md `SidecarEvent`.

import * as readline from 'node:readline';
import { promises as fsp } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { AcpClient } from './acpClient.ts';
import { handleSessionUpdate } from './handlers/sessionUpdate.ts';
import {
  awaitPermission,
  resolvePermission,
  type PermissionResponsePayload,
} from './handlers/permission.ts';
import { readTextFile, makeWriteTextFile } from './handlers/fs.ts';
import { discoverEnvironment, walkAgentsMdChain } from './handlers/environment.ts';
import { feedChunk as feedOrchestrator, resetParseState } from './handlers/orchestratorParser.ts';
import { loadSessionHistory } from './handlers/sessionHistory.ts';
import {
  HARNESS_SYSTEM_PROMPT,
  HARNESS_VERSION,
  HARNESS_ENABLED_DEFAULT,
  wrapUserPrompt,
} from './harness.ts';

const HARNESS_LOOP_BOUND = 5;

export type Emit = (event: Record<string, unknown>) => void;

const emit: Emit = (event) => {
  process.stdout.write(JSON.stringify(event) + '\n');
};

const log = (line: string) => {
  process.stderr.write(line + '\n');
};

// ── State ──────────────────────────────────────────────────────────────────
interface SessionMeta {
  sessionId: string;
  cwd: string;
  model?: string;
  harnessActive: boolean;
  // Orchestrator state — only meaningful when harnessActive=true
  harnessSeeded: boolean; // first session/prompt has already received the harness wrap?
  iterCount: number; // last ITER N/5 detected from agent stream
  loopExceeded: boolean; // hit hard stop?
  completed: boolean; // saw DECISION complete?
}
const sessions = new Map<string, SessionMeta>();
let authMethods: Array<{ id: string; name?: string }> = [];
let probeSessionId: string | null = null;

// ── ACP client ─────────────────────────────────────────────────────────────
const acp = new AcpClient(
  {
    onSessionUpdate: (n) => handleSessionUpdate(n, emit, sessions.get(n.sessionId)),
    onPermissionRequest: (req) => awaitPermission(req, emit),
    onReadTextFile: readTextFile,
    onWriteTextFile: makeWriteTextFile(emit),
    onStderrLine: (line) => emit({ type: 'copilot_stderr', line }),
    onExit: (code, signal) =>
      emit({ type: 'error', code: 'child_crashed', message: `copilot exited (code=${code} signal=${signal})` }),
  },
  { cwd: process.cwd() },
);

async function boot(): Promise<void> {
  try {
    const init = await acp.initialize();
    authMethods = (init.authMethods ?? []).map((m) => ({ id: m.id, name: m.name }));
    emit({
      type: 'ready',
      protocolVersion: init.protocolVersion,
      agentCapabilities: init.agentCapabilities,
      authInfo: (init as { agentInfo?: unknown }).agentInfo ?? null,
      authMethods,
    });
    // Broadcast the canonical harness so frontend can render/edit without
    // duplicating the text (single source of truth lives in sidecar/harness.ts)
    emit({ type: 'harness_info', text: HARNESS_SYSTEM_PROMPT, version: HARNESS_VERSION });

    // Real environment discovery
    try {
      const env = await discoverEnvironment();
      emit({
        type: 'environment',
        mcpServers: env.mcpServers,
        models: env.models,
        copilotHome: env.copilotHome,
        hasSettings: env.hasSettings,
      });
    } catch (e) {
      emit({ type: 'error', code: 'env_discover_failed', message: (e as Error).message });
    }

    // Real session history from ~/.copilot/session-store.db
    try {
      const history = loadSessionHistory(50);
      emit({ type: 'session_history', sessions: history });
    } catch (e) {
      emit({ type: 'error', code: 'session_history_failed', message: (e as Error).message });
    }

    // Probe auth lazily: try a session/new — if it fails with auth error,
    // emit auth_required. Cheaper than guessing from env.
    try {
      const probe = await acp.newSession({
        cwd: process.cwd(),
        mcpServers: [],
      } as Parameters<typeof acp.newSession>[0]);
      // success — drop the probe session immediately
      probeSessionId = probe.sessionId;
    } catch (e) {
      const msg = (e as Error).message || '';
      if (/auth/i.test(msg) || /login/i.test(msg) || /401|403/.test(msg)) {
        emit({
          type: 'auth_required',
          methods: authMethods,
          hint: 'Run `copilot` in a terminal and complete /login, or set COPILOT_GITHUB_TOKEN.',
        });
      } else {
        emit({ type: 'error', code: 'session_probe_failed', message: msg });
      }
    }
  } catch (e) {
    emit({
      type: 'error',
      code: 'acp_handshake_failed',
      message: (e as Error).message,
    });
  }
}

// ── Dispatch ───────────────────────────────────────────────────────────────
interface InMsg {
  type: string;
  [k: string]: unknown;
}

async function handle(req: InMsg): Promise<void> {
  switch (req.type) {
    case 'ping':
      emit({ type: 'pong' });
      return;

    case 'session_new': {
      const cwd = (req.cwd as string) ?? process.cwd();
      let sessionId: string;
      if (probeSessionId) {
        // reuse the probe session created during boot
        sessionId = probeSessionId;
        probeSessionId = null;
      } else {
        const res = await acp.newSession({
          cwd,
          mcpServers: (req.mcpServers as unknown[]) ?? [],
        } as Parameters<typeof acp.newSession>[0]);
        sessionId = res.sessionId;
      }
      const harnessActive =
        typeof req.harnessEnabled === 'boolean' ? req.harnessEnabled : HARNESS_ENABLED_DEFAULT;
      sessions.set(sessionId, {
        sessionId,
        cwd,
        model: req.model as string | undefined,
        harnessActive,
        harnessSeeded: false,
        iterCount: 0,
        loopExceeded: false,
        completed: false,
      });
      emit({
        type: 'session_started',
        sessionId,
        cwd,
        model: (req.model as string) ?? null,
        harnessActive,
        harnessVersion: HARNESS_VERSION,
      });
      // Apply per-session slash commands for model + allow-all if requested
      if (req.model) {
        try {
          await acp.setModelViaSlash(sessionId, req.model as string);
        } catch (e) {
          emit({ type: 'error', code: 'set_model_failed', message: (e as Error).message });
        }
      }
      if (req.allowAllTools) {
        try {
          await acp.prompt({
            sessionId,
            prompt: [{ type: 'text', text: '/allow-all on' }],
          });
        } catch (e) {
          emit({ type: 'error', code: 'allow_all_failed', message: (e as Error).message });
        }
      }
      // Seed harness as the first prompt — establishes Master Orchestrator role
      // for the rest of the session. Custom systemPrompt overrides if provided.
      if (harnessActive) {
        const harness =
          typeof req.systemPrompt === 'string' && req.systemPrompt.trim().length > 0
            ? req.systemPrompt
            : HARNESS_SYSTEM_PROMPT;
        try {
          await acp.prompt({
            sessionId,
            prompt: [{ type: 'text', text: harness }],
          });
          emit({ type: 'harness_seeded', sessionId, version: HARNESS_VERSION });
        } catch (e) {
          emit({ type: 'error', code: 'harness_seed_failed', message: (e as Error).message });
        }
      }
      // Emit real AGENTS.md chain for this session
      try {
        const chain = await walkAgentsMdChain(cwd);
        emit({ type: 'agents_md_chain', sessionId, entries: chain });
      } catch (e) {
        emit({ type: 'error', code: 'agents_md_walk_failed', message: (e as Error).message });
      }
      return;
    }

    case 'session_prompt': {
      const sessionId = req.sessionId as string;
      const content = req.content as Array<Record<string, unknown>>;
      const meta = sessions.get(sessionId);
      let outboundContent = content;

      if (meta?.harnessActive && Array.isArray(content) && content.length > 0) {
        // Hard stop: refuse to wrap if iteration cap is exceeded
        if (meta.iterCount >= HARNESS_LOOP_BOUND && !meta.completed) {
          emit({
            type: 'orchestrator_loop_exceeded',
            sessionId,
            iter: meta.iterCount,
            bound: HARNESS_LOOP_BOUND,
          });
          meta.loopExceeded = true;
          // Inject termination directive instead of more orchestration meta
          outboundContent = content.map((block, i) => {
            if (i === 0 && (block as { type?: string }).type === 'text') {
              const original = (block as { text?: string }).text ?? '';
              return {
                ...block,
                text: `STOP. The orchestrator loop has reached the maximum of ${HARNESS_LOOP_BOUND} iterations. Surface a partial result with an explicit gap list. Do NOT loop further.\n\nUser message: ${original}`,
              };
            }
            return block;
          });
        } else if (!meta.harnessSeeded) {
          // First user turn after harness was already seeded as system message.
          // Wrap once to kick off Iteration 1, then never wrap again.
          outboundContent = content.map((block, i) => {
            if (i === 0 && (block as { type?: string }).type === 'text') {
              const original = (block as { text?: string }).text ?? '';
              return { ...block, text: wrapUserPrompt(original) };
            }
            return block;
          });
          meta.harnessSeeded = true;
        }
        // After harnessSeeded, subsequent prompts go raw — the harness is in
        // context, the loop is established, additional wrapping is noise.
      }

      const res = await acp.prompt({
        sessionId,
        prompt: outboundContent as Parameters<typeof acp.prompt>[0]['prompt'],
      });
      emit({ type: 'session_turn_complete', sessionId, stopReason: res.stopReason });
      return;
    }

    case 'session_cancel': {
      const sessionId = req.sessionId as string;
      await acp.cancel(sessionId);
      return;
    }

    case 'permission_response': {
      const ok = resolvePermission(req as unknown as PermissionResponsePayload);
      if (!ok) emit({ type: 'error', code: 'session_not_found', message: `no pending permission for ${(req as PermissionResponsePayload).requestId}` });
      return;
    }

    case 'set_model': {
      const sessionId = req.sessionId as string;
      const model = req.model as string;
      await acp.setModelViaSlash(sessionId, model);
      const s = sessions.get(sessionId);
      if (s) s.model = model;
      return;
    }

    case 'authenticate': {
      const methodId = (req.methodId as string) ?? authMethods[0]?.id;
      if (!methodId) {
        emit({ type: 'error', code: 'auth_failed', message: 'no authMethods advertised' });
        return;
      }
      try {
        await acp.authenticate(methodId);
        emit({ type: 'auth_succeeded' });
      } catch (e) {
        emit({ type: 'error', code: 'auth_failed', message: (e as Error).message });
      }
      return;
    }

    case 'end_session': {
      const sessionId = req.sessionId as string;
      sessions.delete(sessionId);
      resetParseState(sessionId);
      emit({ type: 'session_ended', sessionId });
      return;
    }

    case 'session_resume': {
      const sessionId = req.sessionId as string;
      const cwd = (req.cwd as string) ?? process.cwd();
      try {
        await acp.loadSession({ sessionId, cwd, mcpServers: [] });
        sessions.set(sessionId, {
          sessionId,
          cwd,
          model: req.model as string | undefined,
          harnessActive: false, // resumed sessions: don't re-inject harness
          harnessSeeded: true,
          iterCount: 0,
          loopExceeded: false,
          completed: false,
        });
        emit({
          type: 'session_started',
          sessionId,
          cwd,
          model: (req.model as string) ?? null,
          harnessActive: false,
          harnessVersion: HARNESS_VERSION,
          resumed: true,
        });
        try {
          const chain = await walkAgentsMdChain(cwd);
          emit({ type: 'agents_md_chain', sessionId, entries: chain });
        } catch {
          /* ignore */
        }
      } catch (e) {
        emit({ type: 'error', code: 'session_resume_failed', message: (e as Error).message });
      }
      return;
    }

    case 'refresh_history': {
      try {
        const history = loadSessionHistory(50);
        emit({ type: 'session_history', sessions: history });
      } catch (e) {
        emit({ type: 'error', code: 'session_history_failed', message: (e as Error).message });
      }
      return;
    }

    default:
      emit({ type: 'error', code: 'unknown_message_type', message: `unknown type: ${req.type}` });
  }
}

// ── Stdin loop ─────────────────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin });

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let req: InMsg;
  try {
    req = JSON.parse(trimmed) as InMsg;
  } catch (e) {
    emit({ type: 'error', code: 'parse_error', message: (e as Error).message });
    return;
  }
  handle(req).catch((e: unknown) => {
    emit({
      type: 'error',
      code: 'acp_internal',
      message: e instanceof Error ? e.message : String(e),
    });
  });
});

rl.on('close', () => {
  acp.dispose();
  process.exit(0);
});

process.on('SIGTERM', () => {
  acp.dispose();
  process.exit(0);
});

log(`[cpltui-sidecar] booted pid=${process.pid}`);
void boot();
