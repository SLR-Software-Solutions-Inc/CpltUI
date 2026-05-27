// Typed Tauri IPC wrappers for CpltUI.
// Conforms to docs/IPC_CONTRACT.md.

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

// ── Outbound (Frontend → Sidecar) ────────────────────────────────────────
export type Inbound =
  | { type: 'ping' }
  | {
      type: 'session_new';
      cwd?: string;
      model?: string;
      agent?: string;
      addDirs?: string[];
      allowAllTools?: boolean;
      mcpServers?: Array<Record<string, unknown>>;
      systemPrompt?: string;
      harnessEnabled?: boolean;
    }
  | {
      type: 'session_prompt';
      sessionId: string;
      content: Array<
        | { type: 'text'; text: string }
        | { type: 'image'; mimeType: string; data: string }
      >;
    }
  | { type: 'session_cancel'; sessionId: string }
  | { type: 'session_resume'; sessionId: string; cwd: string; model?: string }
  | { type: 'refresh_history' }
  | {
      type: 'permission_response';
      requestId: string;
      optionId?: string;
      cancelled?: boolean;
    }
  | { type: 'set_model'; sessionId: string; model: string }
  | { type: 'authenticate'; methodId?: string }
  | { type: 'end_session'; sessionId: string };

// ── Inbound (Sidecar → Frontend) ─────────────────────────────────────────
export type SessionUpdateBody =
  | { sessionUpdate: 'agent_message_chunk'; content: { type: 'text'; text: string } }
  | { sessionUpdate: 'user_message_chunk'; content: { type: 'text'; text: string } }
  | {
      sessionUpdate: 'tool_call';
      toolCallId: string;
      title?: string;
      status?: string;
      rawInput?: unknown;
    }
  | {
      sessionUpdate: 'tool_call_update';
      toolCallId: string;
      status?: string;
      content?: unknown;
    }
  | {
      sessionUpdate: 'plan';
      entries: Array<{ content: string; priority: string; status: string }>;
    }
  | {
      sessionUpdate: 'available_commands_update';
      availableCommands: Array<{ name: string; description?: string }>;
    }
  | { sessionUpdate: 'current_mode_update'; currentModeId: string };

export type SidecarEvt =
  | { type: 'pong' }
  | {
      type: 'ready';
      protocolVersion: number;
      agentCapabilities: Record<string, unknown>;
      authInfo: unknown;
      authMethods: Array<{ id: string; name?: string }>;
    }
  | {
      type: 'auth_required';
      methods: Array<{ id: string; name?: string }>;
      hint?: string;
    }
  | { type: 'auth_succeeded' }
  | {
      type: 'session_started';
      sessionId: string;
      cwd: string;
      model: string | null;
      harnessActive?: boolean;
      harnessVersion?: string;
    }
  | { type: 'harness_seeded'; sessionId: string; version: string }
  | { type: 'harness_info'; text: string; version: string }
  | { type: 'orchestrator_iter'; sessionId: string; iter: number; bound: number }
  | {
      type: 'orchestrator_review';
      sessionId: string;
      iter: number;
      verdicts: { A: 'APPROVE' | 'REJECT'; B: 'APPROVE' | 'REJECT'; C: 'APPROVE' | 'REJECT' };
      consensus: 'APPROVE' | 'REJECT';
    }
  | { type: 'orchestrator_complete'; sessionId: string; iter: number }
  | { type: 'orchestrator_loop_exceeded'; sessionId: string; iter: number; bound: number }
  | {
      type: 'session_history';
      sessions: Array<{
        id: string;
        cwd: string;
        repository: string | null;
        branch: string | null;
        summary: string;
        createdAt: string;
        updatedAt: string;
      }>;
    }
  | {
      type: 'fs_write_diff';
      path: string;
      isNew: boolean;
      additions: number;
      deletions: number;
      patch: string;
      truncated: boolean;
      truncatedAt: number | null;
      bytes: number;
    }
  | { type: 'session_update'; sessionId: string; update: SessionUpdateBody }
  | {
      type: 'session_turn_complete';
      sessionId: string;
      stopReason?: string;
    }
  | {
      type: 'permission_request';
      requestId: string;
      sessionId: string;
      toolCall: Record<string, unknown>;
      options: Array<{ optionId: string; kind: string; name?: string }>;
    }
  | { type: 'session_ended'; sessionId: string }
  | { type: 'copilot_stderr'; line: string }
  | {
      type: 'environment';
      mcpServers: Array<{ name: string; type: string; command?: string; url?: string; enabled: boolean }>;
      models: Array<{ id: string; name: string; provider: string; contextWindow: number; premiumMultiplier: number }>;
      copilotHome: string;
      hasSettings: boolean;
    }
  | {
      type: 'agents_md_chain';
      sessionId: string;
      entries: Array<{ path: string; bytes: number; scope: string }>;
    }
  | { type: 'sidecar_exit'; code: number | null; success: boolean; error?: string }
  | { type: 'error'; code: string; message: string; sessionId?: string };

// ── Wrappers ─────────────────────────────────────────────────────────────
export async function sendToSidecar(msg: Inbound): Promise<void> {
  await invoke('send_to_sidecar', { payload: JSON.stringify(msg) });
}

export function onSidecarEvent(
  handler: (evt: SidecarEvt) => void,
): Promise<UnlistenFn> {
  return listen<SidecarEvt | string>('sidecar-event', (e) => {
    const raw = e.payload;
    const obj: SidecarEvt =
      typeof raw === 'string' ? (JSON.parse(raw) as SidecarEvt) : (raw as SidecarEvt);
    handler(obj);
  });
}

export function onSidecarStderr(
  handler: (line: string) => void,
): Promise<UnlistenFn> {
  return listen<string>('sidecar-stderr', (e) => handler(e.payload));
}
