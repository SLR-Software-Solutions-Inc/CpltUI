// Forward ACP session/update notifications to the host as `session_update`
// events per docs/IPC_CONTRACT.md. Additionally feeds agent text chunks
// into the orchestrator parser so the host can mechanically track the
// Master Harness loop (ITER N/5, REVIEW verdicts, DECISION).

import type { SessionNotification } from '@zed-industries/agent-client-protocol';
import type { Emit } from '../index.ts';
import { feedChunk as feedOrchestrator } from './orchestratorParser.ts';

export interface SessionMetaLite {
  harnessActive: boolean;
  iterCount: number;
  completed: boolean;
}

export function handleSessionUpdate(
  n: SessionNotification,
  emit: Emit,
  meta?: SessionMetaLite,
): void {
  emit({
    type: 'session_update',
    sessionId: n.sessionId,
    update: n.update,
  });

  // Orchestrator parsing — only if harness is active for this session
  if (meta?.harnessActive) {
    const u = n.update as { sessionUpdate?: string; content?: { type?: string; text?: string } };
    if (u.sessionUpdate === 'agent_message_chunk' && u.content?.type === 'text' && u.content.text) {
      const r = feedOrchestrator(n.sessionId, u.content.text, emit);
      meta.iterCount = Math.max(meta.iterCount, r.iter);
      meta.completed = r.complete || meta.completed;
    }
  }
}
