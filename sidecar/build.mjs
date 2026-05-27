// Cross-platform esbuild driver. Mirrors ClawdUI/sidecar/build.mjs.
import { build } from 'esbuild';

await build({
  entryPoints: ['index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: 'dist/index.js',
  external: ['fsevents', 'better-sqlite3'],
  banner: {
    js: 'import { createRequire as __createRequire } from "module"; const require = __createRequire(import.meta.url);',
  },
  logLevel: 'info',
});
