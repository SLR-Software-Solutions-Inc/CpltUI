// Environment discovery — reads real Copilot config + cwd AGENTS.md chain.

import { promises as fsp } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export interface McpServerInfo {
  name: string;
  type: string; // "stdio" | "http" | "sse"
  command?: string;
  url?: string;
  enabled: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  premiumMultiplier: number;
}

export interface CopilotEnvironment {
  mcpServers: McpServerInfo[];
  models: ModelInfo[];
  copilotHome: string;
  hasSettings: boolean;
}

// Documented stable Copilot model catalog (v1.0.54+). Premium multipliers
// are GitHub's published rates. These are real product identifiers, not mock.
const KNOWN_MODELS: ModelInfo[] = [
  { id: 'claude-sonnet-4.5', name: 'Claude Sonnet 4.5', provider: 'Anthropic', contextWindow: 200_000, premiumMultiplier: 1 },
  { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'Anthropic', contextWindow: 200_000, premiumMultiplier: 1 },
  { id: 'gpt-5', name: 'GPT-5', provider: 'OpenAI', contextWindow: 272_000, premiumMultiplier: 1 },
  { id: 'gpt-5-mini', name: 'GPT-5 mini', provider: 'OpenAI', contextWindow: 272_000, premiumMultiplier: 0 },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google', contextWindow: 1_000_000, premiumMultiplier: 1 },
  { id: 'o3', name: 'o3', provider: 'OpenAI', contextWindow: 128_000, premiumMultiplier: 1 },
];

export async function discoverEnvironment(): Promise<CopilotEnvironment> {
  const home = process.env.COPILOT_HOME || join(homedir(), '.copilot');
  const result: CopilotEnvironment = {
    mcpServers: [],
    models: KNOWN_MODELS,
    copilotHome: home,
    hasSettings: false,
  };

  // mcp-config.json
  try {
    const mcpPath = join(home, 'mcp-config.json');
    const raw = await fsp.readFile(mcpPath, 'utf8');
    const cfg = JSON.parse(raw) as { mcpServers?: Record<string, { command?: string; url?: string; type?: string; disabled?: boolean }> };
    if (cfg.mcpServers) {
      for (const [name, def] of Object.entries(cfg.mcpServers)) {
        result.mcpServers.push({
          name,
          type: def.type ?? (def.url ? 'http' : 'stdio'),
          command: def.command,
          url: def.url,
          enabled: def.disabled !== true,
        });
      }
    }
  } catch {
    /* file optional */
  }

  // settings.json existence
  try {
    await fsp.access(join(home, 'settings.json'));
    result.hasSettings = true;
  } catch {
    /* optional */
  }

  return result;
}

export interface AgentsMdEntry {
  path: string;
  bytes: number;
  scope: 'cwd' | 'parent' | 'home' | 'global';
}

export async function walkAgentsMdChain(cwd: string): Promise<AgentsMdEntry[]> {
  const entries: AgentsMdEntry[] = [];
  const seen = new Set<string>();
  let dir = cwd;
  let depth = 0;

  while (depth < 8) {
    const p = join(dir, 'AGENTS.md');
    if (!seen.has(p)) {
      seen.add(p);
      try {
        const st = await fsp.stat(p);
        if (st.isFile()) {
          entries.push({
            path: p,
            bytes: st.size,
            scope: depth === 0 ? 'cwd' : 'parent',
          });
        }
      } catch {
        /* not present at this level */
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
    depth++;
  }

  // Home-level
  const homePath = join(homedir(), 'AGENTS.md');
  if (!seen.has(homePath)) {
    try {
      const st = await fsp.stat(homePath);
      if (st.isFile()) {
        entries.push({ path: homePath, bytes: st.size, scope: 'home' });
      }
    } catch {
      /* optional */
    }
  }

  return entries;
}
