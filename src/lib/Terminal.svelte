<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { Terminal } from '@xterm/xterm';
  import { FitAddon } from '@xterm/addon-fit';
  import '@xterm/xterm/css/xterm.css';

  interface Props {
    cwd?: string;
    shell?: string;
    open?: boolean;
  }

  let { cwd = '', shell = '', open = true }: Props = $props();

  let containerEl: HTMLDivElement | null = $state(null);
  let term: Terminal | null = null;
  let fit: FitAddon | null = null;
  let ptyId: string | null = null;
  let dataUnlisten: UnlistenFn | null = null;

  async function start() {
    if (!containerEl) return;
    if (term) return;

    term = new Terminal({
      fontFamily: 'JetBrains Mono, ui-monospace, Menlo, monospace',
      fontSize: 12.5,
      lineHeight: 1.25,
      theme: {
        background: '#0c0e13',
        foreground: '#e8ecf3',
        cursor: '#4ad8c7',
        cursorAccent: '#08090c',
        selectionBackground: 'rgba(124,92,255,.3)',
        black: '#11141b',
        red: '#ff7b72',
        green: '#56d364',
        yellow: '#ffa657',
        blue: '#5b8cff',
        magenta: '#7c5cff',
        cyan: '#4ad8c7',
        white: '#e8ecf3',
        brightBlack: '#525a6c',
        brightRed: '#ff9590',
        brightGreen: '#88f5ad',
        brightYellow: '#ffc488',
        brightBlue: '#79c0ff',
        brightMagenta: '#a48dff',
        brightCyan: '#88f5e0',
        brightWhite: '#ffffff',
      },
      allowTransparency: true,
      convertEol: true,
    });
    fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerEl);
    fit.fit();

    const rows = term.rows;
    const cols = term.cols;

    try {
      ptyId = (await invoke('pty_spawn', {
        rows,
        cols,
        cwd: cwd || undefined,
        shell: shell || undefined,
      })) as string;
    } catch (e) {
      term.write(`\r\n\x1b[31mPTY spawn failed: ${(e as Error).message}\x1b[0m\r\n`);
      return;
    }

    dataUnlisten = await listen<string>(`pty-data:${ptyId}`, (e) => {
      term?.write(e.payload);
    });

    term.onData((d) => {
      if (!ptyId) return;
      void invoke('pty_write', { id: ptyId, data: d });
    });

    term.onResize(({ cols, rows }) => {
      if (!ptyId) return;
      void invoke('pty_resize', { id: ptyId, rows, cols });
    });

    // Resize on window resize
    const ro = new ResizeObserver(() => fit?.fit());
    if (containerEl) ro.observe(containerEl);
  }

  async function stop() {
    if (dataUnlisten) {
      dataUnlisten();
      dataUnlisten = null;
    }
    if (ptyId) {
      try {
        await invoke('pty_kill', { id: ptyId });
      } catch {
        /* ignore */
      }
      ptyId = null;
    }
    term?.dispose();
    term = null;
    fit = null;
  }

  onMount(() => {
    if (open) void start();
  });

  $effect(() => {
    if (open && !term) void start();
    if (!open && term) void stop();
  });

  onDestroy(() => {
    void stop();
  });
</script>

<div class="term-wrap" class:hidden={!open}>
  <div class="term-bar">
    <span class="term-title">terminal</span>
    <span class="term-cwd" title={cwd}>{cwd ? cwd.replace('/Users/narender', '~') : '(home)'}</span>
  </div>
  <div class="term-host" bind:this={containerEl}></div>
</div>

<style>
  .term-wrap {
    display: flex;
    flex-direction: column;
    background: #0c0e13;
    border-top: 1px solid var(--line);
    height: 280px;
    min-height: 120px;
  }
  .term-wrap.hidden { display: none; }
  .term-bar {
    display: flex; align-items: center; gap: 12px;
    padding: 6px 14px;
    background: var(--bg-2);
    border-bottom: 1px solid var(--line);
    font-family: var(--mono);
    font-size: 11px;
    color: var(--fg-3);
  }
  .term-title {
    text-transform: uppercase; letter-spacing: .5px; font-weight: 700;
    color: var(--fg-4); font-size: 9.5px;
  }
  .term-cwd { color: var(--aurora-3); }
  .term-host {
    flex: 1; overflow: hidden;
    padding: 6px 8px 4px;
  }
  .term-host :global(.xterm) { height: 100%; }
  .term-host :global(.xterm-viewport) { background: transparent !important; }
</style>
