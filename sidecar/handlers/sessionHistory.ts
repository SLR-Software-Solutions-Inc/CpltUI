// Read Copilot's local session sqlite store (~/.copilot/session-store.db) so
// the UI can offer "Resume previous session". Read-only; we never mutate.
//
// better-sqlite3 is a NATIVE module — shipped only in dev. Production .app
// bundles ship without it (notarization requires every embedded binary be
// codesigned, which we don't yet do for the .node files). When the module
// is missing, this handler silently degrades — UI shows empty history.

import { join } from 'node:path';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

type DbCtor = new (
  path: string,
  opts?: { readonly?: boolean; fileMustExist?: boolean },
) => {
  prepare: (sql: string) => { all: (...args: unknown[]) => unknown[] };
  close: () => void;
};

let Database: DbCtor | null = null;
try {
  Database = require('better-sqlite3') as DbCtor;
} catch {
  /* native binding absent in production bundle — feature disabled */
}

export interface SessionHistoryItem {
  id: string;
  cwd: string;
  repository: string | null;
  branch: string | null;
  summary: string;
  createdAt: string;
  updatedAt: string;
}

function dbPath(): string {
  const home = process.env.COPILOT_HOME || join(homedir(), '.copilot');
  return join(home, 'session-store.db');
}

export function loadSessionHistory(limit = 50): SessionHistoryItem[] {
  if (!Database) return [];
  const path = dbPath();
  if (!existsSync(path)) return [];
  let db: ReturnType<DbCtor> | null = null;
  try {
    db = new Database(path, { readonly: true, fileMustExist: true });
    const rows = db
      .prepare(
        `SELECT id, cwd, repository, branch, summary, created_at, updated_at
         FROM sessions
         ORDER BY datetime(updated_at) DESC
         LIMIT ?`,
      )
      .all(limit) as Array<{
        id: string;
        cwd: string | null;
        repository: string | null;
        branch: string | null;
        summary: string | null;
        created_at: string;
        updated_at: string;
      }>;
    return rows.map((r) => ({
      id: r.id,
      cwd: r.cwd ?? '',
      repository: r.repository,
      branch: r.branch,
      summary: r.summary ?? '(no title)',
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  } catch {
    return [];
  } finally {
    db?.close();
  }
}
