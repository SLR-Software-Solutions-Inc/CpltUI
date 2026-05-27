#!/usr/bin/env tsx
// smoke-handshake.ts — Asserts copilot --acp speaks ACP v1 with the
// capabilities CpltUI depends on. Exits 0 on PASS, 1 on FAIL.
//
// Usage: npm run smoke:handshake

import { spawn } from 'node:child_process';

interface Assertion {
  name: string;
  ok: boolean;
  actual: unknown;
  expected: unknown;
}

async function run(): Promise<number> {
  const bin = process.env.CPLTUI_COPILOT_BIN ?? 'copilot';

  const child = spawn(bin, ['--acp', '--no-auto-update'], {
    env: {
      ...process.env,
      COPILOT_AUTO_UPDATE: 'false',
      NO_COLOR: '1',
      TERM: 'dumb',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let stderrBuf = '';
  child.stderr.on('data', (c: Buffer) => {
    stderrBuf += c.toString();
  });

  const handshake = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: 1,
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
      },
    },
  };

  child.stdin.write(JSON.stringify(handshake) + '\n');

  const result = await new Promise<{ result?: Record<string, unknown>; error?: unknown } | null>(
    (resolve) => {
      let buf = '';
      const timer = setTimeout(() => resolve(null), 10_000);
      child.stdout.on('data', (chunk: Buffer) => {
        buf += chunk.toString();
        let idx: number;
        while ((idx = buf.indexOf('\n')) !== -1) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (!line) continue;
          try {
            const obj = JSON.parse(line) as { id?: number; result?: Record<string, unknown>; error?: unknown };
            if (obj.id === 1) {
              clearTimeout(timer);
              resolve(obj);
              return;
            }
          } catch {
            /* skip non-JSON */
          }
        }
      });
    },
  );

  try {
    child.kill('SIGTERM');
  } catch {
    /* ignore */
  }

  const assertions: Assertion[] = [];

  if (!result || !result.result) {
    assertions.push({
      name: 'initialize returns a result',
      ok: false,
      actual: result?.error ?? null,
      expected: 'object with result',
    });
  } else {
    const r = result.result as {
      protocolVersion?: number;
      agentCapabilities?: {
        loadSession?: boolean;
        mcpCapabilities?: { http?: boolean; sse?: boolean };
        promptCapabilities?: { image?: boolean; embeddedContext?: boolean };
        sessionCapabilities?: unknown;
      };
      agentInfo?: { name?: string; version?: string };
    };

    assertions.push(
      { name: 'protocolVersion === 1', ok: r.protocolVersion === 1, actual: r.protocolVersion, expected: 1 },
      { name: 'agentCapabilities.loadSession === true', ok: r.agentCapabilities?.loadSession === true, actual: r.agentCapabilities?.loadSession, expected: true },
      { name: 'agentCapabilities.mcpCapabilities.http === true', ok: r.agentCapabilities?.mcpCapabilities?.http === true, actual: r.agentCapabilities?.mcpCapabilities?.http, expected: true },
      { name: 'agentCapabilities.promptCapabilities.embeddedContext === true', ok: r.agentCapabilities?.promptCapabilities?.embeddedContext === true, actual: r.agentCapabilities?.promptCapabilities?.embeddedContext, expected: true },
      { name: 'agentInfo.name === "Copilot"', ok: r.agentInfo?.name === 'Copilot', actual: r.agentInfo?.name, expected: 'Copilot' },
    );
  }

  const passed = assertions.filter((a) => a.ok).length;
  const total = assertions.length;
  const allOk = passed === total;

  console.log(`\n  ACP handshake smoke test — ${bin} --acp`);
  console.log('  ─────────────────────────────────────────────────────');
  for (const a of assertions) {
    const mark = a.ok ? '✓' : '✗';
    console.log(`   ${mark}  ${a.name}`);
    if (!a.ok) console.log(`        actual=${JSON.stringify(a.actual)}  expected=${JSON.stringify(a.expected)}`);
  }
  console.log('  ─────────────────────────────────────────────────────');
  console.log(`  ${allOk ? 'PASS' : 'FAIL'} — ${passed}/${total} assertions\n`);
  if (!allOk && stderrBuf) {
    console.log('  stderr from copilot:');
    console.log('  ' + stderrBuf.split('\n').slice(0, 20).join('\n  '));
  }

  return allOk ? 0 : 1;
}

run()
  .then((code) => process.exit(code))
  .catch((e: Error) => {
    console.error('smoke-handshake threw:', e.message);
    process.exit(2);
  });
