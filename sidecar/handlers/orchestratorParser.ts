// Streaming parser for the Master Orchestrator status block + REVIEW verdicts.
//
// The harness prompts the model to emit, per iteration:
//
//   ITER N/5
//   PLAN     ...
//   DISPATCH ...
//   GATHER   ...
//   REVIEW   A:APPROVE  B:REJECT(reason)  C:APPROVE
//   DECISION <complete | loop with new constraints>
//
// We accumulate streamed text per session and detect each line as it lands.
// Emitter calls happen when a NEW match crosses a previously-unseen boundary.

import type { Emit } from '../index.ts';

export type Verdict = 'APPROVE' | 'REJECT';

interface SessionParseState {
  buffer: string;
  lastIterReported: number;
  lastReviewKey: string | null;
  completeReported: boolean;
}

const STATES = new Map<string, SessionParseState>();

const ITER_RE = /\bITER\s+(\d+)\s*\/\s*5\b/gi;
const REVIEW_RE =
  /\bREVIEW\b[^\n]*?A:\s*(APPROVE|REJECT)[^\n]*?B:\s*(APPROVE|REJECT)[^\n]*?C:\s*(APPROVE|REJECT)/gi;
const DECISION_COMPLETE_RE = /\bDECISION\s+complete\b/i;

function getState(sessionId: string): SessionParseState {
  let s = STATES.get(sessionId);
  if (!s) {
    s = { buffer: '', lastIterReported: 0, lastReviewKey: null, completeReported: false };
    STATES.set(sessionId, s);
  }
  return s;
}

export function resetParseState(sessionId: string): void {
  STATES.delete(sessionId);
}

/**
 * Feed a streaming text chunk into the parser. Emits orchestrator events
 * when new ITER / REVIEW / DECISION lines are detected. Returns the latest
 * iteration number seen.
 */
export function feedChunk(
  sessionId: string,
  chunk: string,
  emit: Emit,
): { iter: number; complete: boolean } {
  const s = getState(sessionId);
  s.buffer += chunk;
  // Cap buffer to avoid unbounded growth: keep last 16 KB
  if (s.buffer.length > 16_384) s.buffer = s.buffer.slice(-16_384);

  // ITER detection — emit on monotonic increase
  let highestIter = s.lastIterReported;
  for (const m of s.buffer.matchAll(ITER_RE)) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > highestIter) highestIter = n;
  }
  if (highestIter > s.lastIterReported) {
    s.lastIterReported = highestIter;
    emit({ type: 'orchestrator_iter', sessionId, iter: highestIter, bound: 5 });
  }

  // REVIEW detection — fire once per (iter, verdicts) tuple
  for (const m of s.buffer.matchAll(REVIEW_RE)) {
    const key = `${s.lastIterReported}:${m[1]}:${m[2]}:${m[3]}`;
    if (s.lastReviewKey !== key) {
      s.lastReviewKey = key;
      const verdicts = { A: m[1] as Verdict, B: m[2] as Verdict, C: m[3] as Verdict };
      const approvedAll = verdicts.A === 'APPROVE' && verdicts.B === 'APPROVE' && verdicts.C === 'APPROVE';
      emit({
        type: 'orchestrator_review',
        sessionId,
        iter: s.lastIterReported,
        verdicts,
        consensus: approvedAll ? 'APPROVE' : 'REJECT',
      });
    }
  }

  // DECISION complete
  if (!s.completeReported && DECISION_COMPLETE_RE.test(s.buffer)) {
    s.completeReported = true;
    emit({
      type: 'orchestrator_complete',
      sessionId,
      iter: s.lastIterReported,
    });
  }

  return { iter: s.lastIterReported, complete: s.completeReported };
}
