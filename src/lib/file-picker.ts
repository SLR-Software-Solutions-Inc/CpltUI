// File picker — walks the session cwd shallowly, respects common ignore dirs,
// returns a flat list for fuzzy filtering.

import { readDir, BaseDirectory } from '@tauri-apps/plugin-fs';

const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.svelte-kit',
  '.vite',
  'dist',
  'build',
  'target',
  '.next',
  '.turbo',
  '.cache',
  '.DS_Store',
]);

const IGNORE_FILES = new Set(['.DS_Store', 'Thumbs.db']);

export interface FileItem {
  /** Absolute path on disk */
  path: string;
  /** Path relative to the cwd root */
  rel: string;
  /** Just the basename */
  name: string;
  /** Bytes — best-effort, undefined if not available cheaply */
  size?: number;
}

const MAX_DEPTH = 4;
const MAX_FILES = 800;

async function walk(root: string, cur: string, out: FileItem[], depth: number): Promise<void> {
  if (out.length >= MAX_FILES) return;
  if (depth > MAX_DEPTH) return;
  let entries: Awaited<ReturnType<typeof readDir>> = [];
  try {
    entries = await readDir(cur);
  } catch {
    return;
  }
  for (const e of entries) {
    if (out.length >= MAX_FILES) return;
    const name = e.name ?? '';
    if (!name || name.startsWith('.git')) continue;
    if (e.isDirectory) {
      if (IGNORE_DIRS.has(name)) continue;
      await walk(root, `${cur}/${name}`, out, depth + 1);
    } else if (e.isFile) {
      if (IGNORE_FILES.has(name)) continue;
      const full = `${cur}/${name}`;
      out.push({
        path: full,
        rel: full.startsWith(root) ? full.slice(root.length + 1) : full,
        name,
      });
    }
  }
}

let cache: { root: string; items: FileItem[]; cachedAt: number } | null = null;
const CACHE_TTL_MS = 15_000;

export async function listCwdFiles(cwd: string): Promise<FileItem[]> {
  if (!cwd || cwd.startsWith('~')) return [];
  const now = Date.now();
  if (cache && cache.root === cwd && now - cache.cachedAt < CACHE_TTL_MS) return cache.items;
  const out: FileItem[] = [];
  await walk(cwd, cwd, out, 0);
  cache = { root: cwd, items: out, cachedAt: now };
  return out;
}

export function fuzzyFilter(items: FileItem[], query: string, limit = 50): FileItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items.slice(0, limit);
  const scored: Array<{ item: FileItem; score: number }> = [];
  for (const it of items) {
    const rel = it.rel.toLowerCase();
    const name = it.name.toLowerCase();
    let score = 0;
    if (name === q) score = 1000;
    else if (name.startsWith(q)) score = 500;
    else if (name.includes(q)) score = 250;
    else if (rel.includes(q)) score = 100;
    else {
      // subsequence match
      let i = 0;
      for (const ch of rel) {
        if (ch === q[i]) i++;
        if (i === q.length) break;
      }
      if (i === q.length) score = 10;
    }
    if (score > 0) scored.push({ item: it, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.item);
}
