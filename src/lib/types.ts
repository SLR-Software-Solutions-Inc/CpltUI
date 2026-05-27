// Shared frontend type definitions.

export type Role = 'system' | 'user' | 'assistant' | 'tool';
export type SessionStatus = 'running' | 'awaiting' | 'idle';
export type ToolStatus = 'ok' | 'run' | 'err';
export type IssueKind = 'pr-open' | 'pr-draft' | 'pr-merged' | 'issue-open' | 'issue-closed';

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  author?: string;
  model?: string;
  tool?: ToolCall;
  plan?: PlanItem[];
  permission?: PermissionPrompt;
}

export interface ToolCall {
  id: string;
  name: string;
  arg: string;
  status: ToolStatus;
  diff?: DiffLine[];
}

export interface DiffLine {
  ln: number;
  text: string;
  kind?: 'add' | 'del' | 'ctx';
}

export interface PlanItem {
  id: string;
  step: string;
  text: string;
  done: boolean;
}

export interface PermissionPrompt {
  tool: string;
  target: string;
  summary: string;
}

export interface Session {
  id: string;
  title: string;
  status: SessionStatus;
  repo: string;
  branch: string;
  active?: boolean;
  meta?: string;
}

export interface RepoGroup {
  name: string;
  branch: string;
  sessions: Session[];
}

export interface PickerItem {
  number: number;
  title: string;
  kind: IssueKind;
  meta: string;
}

export interface Agent {
  id: string;
  name: string;
  desc: string;
}

export interface SlashCommand {
  cmd: string;
  desc: string;
}

export interface McpServer {
  name: string;
  toolCount: number;
  health: 'ok' | 'warn' | 'err';
}

export interface Model {
  id: string;
  name: string;
  provider: string;
  context: string;
  multiplier: 1 | 2;
  desc: string;
}

export interface HudState {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  premiumReqs: number;
  modelMultiplier: 1 | 2;
  contextUsed: number;
  contextMax: number;
}

export interface PaletteAction {
  id: string;
  title: string;
  section: string;
  kbd?: string;
  run: () => void | Promise<void>;
}

export interface SidecarEvent {
  type: string;
  [key: string]: unknown;
}
