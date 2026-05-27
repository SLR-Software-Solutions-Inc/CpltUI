// Read Copilot's local session sqlite store (~/.copilot/session-store.db) so
// the UI can offer "Resume previous session". Read-only; we never mutate.

import { join } from 'node:path';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import Database from 'better-sqlite3';

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
  const path = dbPath();
  if (!existsSync(path)) return [];
  let db: Database.Database | null = null;
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
