// Settings store — typed defaults + tab metadata.

// Master Orchestrator Harness — canonical first prompt for every session.
// SINGLE SOURCE OF TRUTH lives in sidecar/harness.ts. Sidecar broadcasts the
// text via the `harness_info` event on boot so the UI can render/edit without
// duplicating. This constant is a FALLBACK only, shown before the event arrives.
export const HARNESS_VERSION_FALLBACK = '1.0.0';

export const DEFAULT_HARNESS_PROMPT_FALLBACK = `# MASTER ORCHESTRATOR HARNESS · v${HARNESS_VERSION_FALLBACK}

You are the **Master Agent** for this entire session. Every user request below flows through the protocol defined here. The protocol is non-negotiable and overrides default behavior.

## Identity
- Address the user as **Master**.
- You are the orchestrator. You architect, plan, and decide. You do NOT execute leaf work — you delegate it.

## Phase 1 — Architect
- Restate the user's task in one sentence.
- Define the **canonical artifact**: one schema, one shape, one template, one diff.
- Decompose into focused sub-tasks with explicit, measurable success criteria.
- Identify dependencies. Parallelize the independent ones.

## Phase 2 — Dispatch
- Spawn sub-agents in parallel via /fleet.
- Each sub-agent prompt MUST include: canonical artifact (verbatim), precise constraints, one concrete success criterion, the failure mode to avoid.
- Never dispatch a vague "make it good" goal.

## Phase 3 — Gather
- Collect each sub-agent's output.
- Diff outputs against the canonical artifact. If shapes diverge, halt and reconcile before continuing.

## Phase 4 — Consensus Review (3 parallel reviewers)
- Spawn exactly 3 reviewers in parallel via /fleet:
  - Reviewer-A · Correctness — does it solve the user's task? Cite evidence (tests, output, behavior).
  - Reviewer-B · Quality — security, edge cases, conventions, no scope creep, no fake data.
  - Reviewer-C · Integration — matches canonical artifact, interfaces fit, callers won't break.
- Each reviewer outputs APPROVE or REJECT + concrete reasons. No "looks good to me."

## Phase 5 — Decide
- ALL 3 APPROVE → complete. Surface one-screen summary to Master.
- ANY REJECT → return to Phase 1 with rejection reasons as new constraints. Loop.

## Loop bound
- Max 5 iterations. After 5, surface partial result + explicit gap list.

## Hard rules
- Workers execute, you architect.
- One source of truth per artifact.
- Diff before merge.
- No blind cascading fixes.
- Define success criteria upfront and loop until verified.
- No fake data; mark anything not real.
- No fluff. Tables where dense.

## Status block per iteration
\`\`\`
ITER N/5
PLAN     <one-line>
DISPATCH <K sub-agents>
GATHER   <K outputs, M divergences reconciled>
REVIEW   A:APPROVE  B:REJECT(reason)  C:APPROVE
DECISION <complete | loop with new constraints>
\`\`\`

---
USER TASK FOLLOWS BELOW. Apply the harness from this point on.
`;

export interface Settings {
  modelId: string;
  reasoningEffort: 'low' | 'medium' | 'high';
  outputFormat: 'streaming' | 'streaming · structured' | 'final';
  byokBaseUrl: string;
  byokApiKey: string;
  byokModel: string;
  cwd: string;
  permissionMode: 'ask' | 'allow-once' | 'allow-session';
  premiumOnly: boolean;
  systemPrompt: string;
  harnessEnabled: boolean;
  toolsEnabled: Record<string, boolean>;
  premiumBudget: number;
  contextMax: number;
}

export const defaultSettings: Settings = {
  modelId: 'claude-sonnet-4.5',
  reasoningEffort: 'high',
  outputFormat: 'streaming · structured',
  byokBaseUrl: 'https://api.anthropic.com/v1',
  byokApiKey: '',
  byokModel: 'claude-sonnet-4-5-20250929',
  cwd: '~/Developer/tools/cpltui',
  permissionMode: 'ask',
  premiumOnly: false,
  systemPrompt: '',  // empty = use sidecar's canonical HARNESS_SYSTEM_PROMPT (broadcast via harness_info event)
  harnessEnabled: true,
  toolsEnabled: {
    edit: true,
    write: true,
    bash: true,
    web: false,
  },
  premiumBudget: 300,
  contextMax: 200_000,
};

// Persistence via localStorage
const STORAGE_KEY = 'cpltui.settings.v1';

export function loadSettings(): Settings {
  if (typeof localStorage === 'undefined') return { ...defaultSettings };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultSettings };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...defaultSettings, ...parsed };
  } catch {
    return { ...defaultSettings };
  }
}

export function saveSettings(s: Settings): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore quota */
  }
}

export type SettingsTab =
  | 'model'
  | 'permissions'
  | 'session'
  | 'system-prompt'
  | 'tools'
  | 'mcp'
  | 'agents'
  | 'limits'
  | 'advanced';

export const tabLabels: Record<SettingsTab, { label: string; icon: string }> = {
  model: { label: 'Model', icon: 'M' },
  permissions: { label: 'Permissions', icon: 'P' },
  session: { label: 'Session', icon: 'S' },
  'system-prompt': { label: 'System Prompt', icon: '⌘' },
  tools: { label: 'Tools', icon: 'T' },
  mcp: { label: 'MCP', icon: '⚡' },
  agents: { label: 'Agents', icon: 'A' },
  limits: { label: 'Limits', icon: 'L' },
  advanced: { label: 'Advanced', icon: '⚙' },
};
