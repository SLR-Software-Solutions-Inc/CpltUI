// fs/read_text_file + fs/write_text_file handlers — invoked by Copilot ACP
// because we advertised `fs.readTextFile=true` / `fs.writeTextFile=true` in
// initialize.
//
// writeTextFile additionally computes a unified diff (old vs new) and emits
// a `fs_write_diff` event so the UI can render a DiffCard before the user
// sees the file change land.

import { promises as fs } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import * as Diff from 'diff';
import type {
  ReadTextFileRequest,
  ReadTextFileResponse,
  WriteTextFileRequest,
  WriteTextFileResponse,
} from '@zed-industries/agent-client-protocol';
import type { Emit } from '../index.ts';

function safePath(p: string): string {
  if (!isAbsolute(p)) throw new Error(`fs path must be absolute: ${p}`);
  return resolve(p);
}

export async function readTextFile(
  req: ReadTextFileRequest,
): Promise<ReadTextFileResponse> {
  const path = safePath(req.path);
  let content = await fs.readFile(path, 'utf8');
  if (typeof req.line === 'number' || typeof req.limit === 'number') {
    const lines = content.split('\n');
    const start = (req.line ?? 1) - 1;
    const end = req.limit ? start + req.limit : lines.length;
    content = lines.slice(start, end).join('\n');
  }
  return { content };
}

const MAX_DIFF_LINES = 240;

export function makeWriteTextFile(emit: Emit) {
  return async function writeTextFile(
    req: WriteTextFileRequest,
  ): Promise<WriteTextFileResponse> {
    const path = safePath(req.path);
    let oldText = '';
    let isNew = false;
    try {
      oldText = await fs.readFile(path, 'utf8');
    } catch {
      isNew = true;
    }
    const newText = req.content;

    // Compute unified diff
    const patch = Diff.createTwoFilesPatch(
      isNew ? '/dev/null' : path,
      path,
      oldText,
      newText,
      '',
      '',
      { context: 3 },
    );
    const allLines = patch.split('\n');
    const truncated = allLines.length > MAX_DIFF_LINES;
    const lines = truncated ? allLines.slice(0, MAX_DIFF_LINES) : allLines;

    let additions = 0;
    let deletions = 0;
    for (const ln of allLines) {
      if (ln.startsWith('+') && !ln.startsWith('+++')) additions++;
      else if (ln.startsWith('-') && !ln.startsWith('---')) deletions++;
    }

    // Emit before write so UI can show pending state
    emit({
      type: 'fs_write_diff',
      path,
      isNew,
      additions,
      deletions,
      patch: lines.join('\n'),
      truncated,
      truncatedAt: truncated ? MAX_DIFF_LINES : null,
      bytes: newText.length,
    });

    await fs.writeFile(path, newText, 'utf8');
    return {};
  };
}
