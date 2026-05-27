<script lang="ts">
  import { app } from './state.svelte';
  import type { PaletteAction } from './types';

  interface Props {
    open: boolean;
    actions: PaletteAction[];
    onClose?: () => void;
  }

  let { open = $bindable(false), actions, onClose }: Props = $props();

  let query = $state('');
  let idx = $state(0);
  let inputEl: HTMLInputElement | null = $state(null);

  const filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const base = [
      ...actions,
      // Live slash commands from Copilot
      ...app.availableCommands.map((c) => ({
        id: 'slash-' + c.name,
        title: '/' + c.name,
        section: 'slash',
        kbd: '',
        run: () => {},
      })),
      // Live model swap actions
      ...app.models.map((m) => ({
        id: 'model-' + m.id,
        title: `Switch to ${m.name}`,
        section: 'model',
        kbd: m.provider,
        run: () => {},
      })),
      // Resume recent sessions
      ...app.sessionHistory.slice(0, 8).map((h) => ({
        id: 'resume-' + h.id,
        title: `Resume: ${h.summary}`,
        section: 'history',
        kbd: h.cwd.split('/').pop() ?? '',
        run: () => {},
      })),
    ];
    if (!q) return base.slice(0, 50);
    return base
      .filter((a) => a.title.toLowerCase().includes(q) || a.section.includes(q))
      .slice(0, 50);
  });

  $effect(() => {
    if (open) {
      setTimeout(() => inputEl?.focus(), 0);
      query = '';
      idx = 0;
    }
  });

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') { onClose?.(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(idx + 1, filtered.length - 1); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(idx - 1, 0); return; }
    if (e.key === 'Enter') { e.preventDefault(); run(idx); return; }
  }

  function run(i: number) {
    const a = filtered[i];
    if (!a) return;
    void a.run();
    onClose?.();
  }
</script>

{#if open}
  <div
    class="pal-overlay"
    role="dialog"
    aria-modal="true"
    onclick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    onkeydown={(e) => { if (e.key === 'Escape') onClose?.(); }}
    tabindex="-1"
  >
    <div class="pal" onkeydown={onKey} role="presentation">
      <input
        bind:this={inputEl}
        class="pal-input"
        type="text"
        placeholder="Type a command, /slash, model, or session…"
        bind:value={query}
        spellcheck="false"
      />
      <div class="pal-list">
        {#each filtered as a, i (a.id)}
          <button
            class="pal-row"
            class:on={i === idx}
            onclick={() => run(i)}
            onmouseenter={() => (idx = i)}
          >
            <span class="pal-section">{a.section}</span>
            <span class="pal-title">{a.title}</span>
            {#if a.kbd}<span class="pal-kbd">{a.kbd}</span>{/if}
          </button>
        {/each}
        {#if filtered.length === 0}
          <div class="pal-empty">no matches</div>
        {/if}
      </div>
      <div class="pal-foot">↑↓ navigate · ⏎ run · esc close</div>
    </div>
  </div>
{/if}

<style>
  .pal-overlay {
    position: fixed; inset: 0; z-index: 950;
    display: flex; align-items: flex-start; justify-content: center;
    padding-top: 12vh;
    background: rgba(8,9,12,.55); backdrop-filter: blur(10px);
  }
  .pal {
    width: min(620px, 92vw);
    background: linear-gradient(180deg, #11141b, #0c0e13);
    border: 1px solid #262c39;
    border-radius: 14px;
    box-shadow: 0 30px 60px rgba(0,0,0,.6), 0 0 0 1px rgba(124,92,255,.18);
    overflow: hidden;
    display: flex; flex-direction: column;
    max-height: 70vh;
  }
  .pal-input {
    background: none; border: 0; padding: 14px 18px;
    font-family: inherit; font-size: 14.5px; color: var(--fg);
    border-bottom: 1px solid var(--line); outline: none;
  }
  .pal-input::placeholder { color: var(--fg-4); }
  .pal-list { overflow-y: auto; flex: 1; padding: 4px 0; }
  .pal-row {
    display: grid; grid-template-columns: 80px 1fr auto;
    align-items: center; gap: 10px;
    padding: 7px 14px; background: none; border: 0; width: 100%;
    text-align: left; cursor: pointer; color: var(--fg-2);
    font-size: 13px;
  }
  .pal-row.on { background: var(--bg-2); color: var(--fg); }
  .pal-row.on .pal-section { color: var(--aurora-3); }
  .pal-section {
    font-family: var(--mono); font-size: 10.5px; color: var(--fg-4);
    text-transform: uppercase; letter-spacing: .5px;
  }
  .pal-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pal-kbd {
    font-family: var(--mono); font-size: 10.5px; color: var(--fg-4);
    background: var(--bg-3); padding: 1px 6px; border-radius: 4px;
  }
  .pal-empty { padding: 24px; text-align: center; color: var(--fg-4); font-size: 13px; }
  .pal-foot {
    padding: 8px 14px; border-top: 1px solid var(--line);
    font-family: var(--mono); font-size: 10.5px; color: var(--fg-4);
  }
</style>
