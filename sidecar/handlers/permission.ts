// Bridge ACP session/request_permission ↔ frontend.
//
// ACP sends a request that we must respond to. The host UI surfaces a modal,
// then sends back a `permission_response` message. We resolve the matching
// pending promise.

import { randomUUID } from 'node:crypto';
import type {
  RequestPermissionRequest,
  RequestPermissionResponse,
} from '@zed-industries/agent-client-protocol';
import type { Emit } from '../index.ts';

type Resolver = (resp: RequestPermissionResponse) => void;

const pending = new Map<string, Resolver>();

export function awaitPermission(
  req: RequestPermissionRequest,
  emit: Emit,
): Promise<RequestPermissionResponse> {
  return new Promise((resolve) => {
    const requestId = randomUUID();
    pending.set(requestId, resolve);
    emit({
      type: 'permission_request',
      requestId,
      sessionId: req.sessionId,
      toolCall: req.toolCall,
      options: req.options,
    });
  });
}

export interface PermissionResponsePayload {
  requestId: string;
  optionId?: string;
  cancelled?: boolean;
}

export function resolvePermission(payload: PermissionResponsePayload): boolean {
  const resolver = pending.get(payload.requestId);
  if (!resolver) return false;
  pending.delete(payload.requestId);
  if (payload.cancelled) {
    resolver({ outcome: { outcome: 'cancelled' } });
  } else {
    resolver({
      outcome: { outcome: 'selected', optionId: payload.optionId ?? 'allow_once' },
    });
  }
  return true;
}
