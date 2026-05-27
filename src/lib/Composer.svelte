<script lang="ts">
  import type { SlashCommand } from './types';
  import { dropdownPop } from './design-system/motion';
  import { listCwdFiles, fuzzyFilter, type FileItem } from './file-picker';

  interface Props {
    value?: string;
    slashCommands: SlashCommand[];
    repoLabel?: string;
    cwd?: string;
    planMode?: boolean;
    onSend?: (text: string, fileChips: FileItem[]) => void;
    onStop?: () => void;
    onTogglePlan?: (on: boolean) => void;
  }

  let {
    value = $bindable(''),
    slashCommands,
    repoLabel = 'no session',
    cwd = '',
    planMode = $bindable(false),
    onSend,
    onStop,
    onTogglePlan,
  }: Props = $props();

  let textareaEl: HTMLTextAreaElement | null = $state(null);
  let slashOpen = $state(false);
  let slashIdx = $state(0);
  let slashFilter = $state('');
  let atOpen = $state(false);
  let atIdx = $state(0);
  let atFilter = $state('');
  let allFiles = $state<FileItem[]>([]);
  let chips = $state<FileItem[]>([]);
  let dragHover = $state(false);

  const filteredSlash = $derived(
    slashFilter
      ? slashCommands.filter((s) => s.cmd.toLowerCase().includes(slashFilter.toLowerCase()))
      : slashCommands,
  );
  const filteredFiles = $derived(fuzzyFilter(allFiles, atFilter, 30));

  $effect(() => {
    // refresh file list when cwd changes (real resolved path only)
    if (cwd && !cwd.startsWith('~')) {
      void listCwdFiles(cwd).then((items) => (allFiles = items));
    } else {
      allFiles = [];
    }
  });

  function addChip(f: FileItem) {
    if (chips.some((c) => c.path === f.path)) return;
    chips = [...chips, f];
  }
  function removeChip(path: string) {
    chips = chips.filter((c) => c.path !== path);
  }
  function pickAt(i: number) {
    const f = filteredFiles[i];
    if (!f) return;
    addChip(f);
    // remove the @query from the textarea
    value = value.replace(/@\S*$/, '').trim();
    atOpen = false;
    textareaEl?.focus();
    if (textareaEl) autoSize(textareaEl);
  }

  function autoSize(t: HTMLTextAreaElement) {
    t.style.height = 'auto';
    t.style.height = Math.min(t.scrollHeight, 240) + 'px';
  }

  function onInput(e: Event) {
    const t = e.target as HTMLTextAreaElement;
    value = t.value;
    autoSize(t);
    const cursor = t.selectionStart;
    const before = value.slice(0, cursor);
    const ms = before.match(/\/([\w-]*)$/);
    const ma = before.match(/@([\w./-]*)$/);
    if (ma) {
      atOpen = true;
      atFilter = ma[1];
      atIdx = 0;
      slashOpen = false;
    } else if (ms) {
      slashOpen = true;
      slashFilter = ms[1];
      slashIdx = 0;
      atOpen = false;
    } else {
      slashOpen = false;
      atOpen = false;
    }
  }

  function pickSlash(i: number) {
    const s = filteredSlash[i];
    if (!s) return;
    value = value.replace(/\/[\w-]*$/, '') + s.cmd + ' ';
    slashOpen = false;
    textareaEl?.focus();
    autoSize(textareaEl!);
  }

  function onKey(e: KeyboardEvent) {
    if (atOpen && filteredFiles.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); atIdx = (atIdx + 1) % filteredFiles.length; return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); atIdx = (atIdx - 1 + filteredFiles.length) % filteredFiles.length; return; }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); pickAt(atIdx); return; }
      if (e.key === 'Escape') { atOpen = false; return; }
    }
    if (slashOpen && filteredSlash.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        slashIdx = (slashIdx + 1) % filteredSlash.length;
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        slashIdx = (slashIdx - 1 + filteredSlash.length) % filteredSlash.length;
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        pickSlash(slashIdx);
        return;
      }
      if (e.key === 'Escape') {
        slashOpen = false;
        return;
      }
    }
    // Enter → submit; Shift+Enter → newline; Cmd+Enter also submits (legacy)
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      submit();
      return;
    }
    if (e.shiftKey && e.key === 'Tab') {
      e.preventDefault();
      planMode = !planMode;
      onTogglePlan?.(planMode);
    }
  }

  function submit() {
    const text = value.trim();
    if (!text && chips.length === 0) return;
    onSend?.(text, chips);
    value = '';
    chips = [];
    if (textareaEl) autoSize(textareaEl);
  }

  function onDragOver(e: DragEvent) {
    if (e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault();
      dragHover = true;
    }
  }
  function onDragLeave() {
    dragHover = false;
  }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragHover = false;
    const files = e.dataTransfer?.files;
    if (!files) return;
    for (const f of files) {
      // Browser File API doesn't expose absolute path; Tauri webview may.
      // The `path` is non-standard; fall back to name only.
      const anyF = f as unknown as { path?: string };
      const path = anyF.path || f.name;
      addChip({ path, rel: f.name, name: f.name, size: f.size });
    }
  }
</script>

<div class="composer" class:plan-on={planMode}>
  <div class="composer-bar">
    <button
      class="seg"
      class:on={!planMode}
      onclick={() => {
        planMode = false;
        onTogglePlan?.(false);
      }}
      title="Ask / Execute (default)"
    >Ask</button>
    <button
      class="seg"
      class:on={planMode}
      onclick={() => {
        planMode = true;
        onTogglePlan?.(true);
      }}
      title="Plan mode — checklist before execution (Shift+Tab)"
    >Plan</button>
    <span class="bar-spacer"></span>
    <span class="hint">{repoLabel} · ⏎ send · ⇧⏎ newline · ⇧⇥ plan · / slash · @ file</span>
  </div>

  {#if chips.length > 0}
    <div class="chip-row">
      {#each chips as f (f.path)}
        <span class="chip" title={f.path}>
          <span class="chip-name">@{f.rel || f.name}</span>
          <button class="chip-x" onclick={() => removeChip(f.path)} aria-label="Remove">×</button>
        </span>
      {/each}
    </div>
  {/if}

  <div
    class="composer-input-wrap"
    class:drag-hover={dragHover}
    ondragover={onDragOver}
    ondragleave={onDragLeave}
    ondrop={onDrop}
    role="textbox"
    tabindex="-1"
  >
    <textarea
      bind:this={textareaEl}
      class="composer-input"
      bind:value
      oninput={onInput}
      onkeydown={onKey}
      placeholder={dragHover ? 'Drop files to attach…' : 'Message Copilot…'}
      rows="1"
      aria-label="Message Copilot"
    ></textarea>

    {#if atOpen && filteredFiles.length > 0}
      <div class="picker-pop" transition:dropdownPop>
        <div class="picker-head">Files in {repoLabel}</div>
        <div class="picker-list">
          {#each filteredFiles as f, i (f.path)}
            <button
              class="picker-row"
              class:on={i === atIdx}
              onclick={() => pickAt(i)}
              onmouseenter={() => (atIdx = i)}
            >
              <code class="picker-key" style="min-width:auto;color:var(--fg);font-weight:600">{f.name}</code>
              <span class="picker-desc">{f.rel}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    {#if slashOpen && filteredSlash.length > 0}
      <div class="picker-pop" transition:dropdownPop>
        <div class="picker-head">Slash commands</div>
        <div class="picker-list">
          {#each filteredSlash as s, i (s.cmd)}
            <button
              class="picker-row"
              class:on={i === slashIdx}
              onclick={() => pickSlash(i)}
              onmouseenter={() => (slashIdx = i)}
            >
              <code class="picker-key">{s.cmd}</code>
              <span class="picker-desc">{s.desc}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="composer-foot">
      <button class="send" onclick={submit} disabled={!value.trim() && chips.length === 0}>
        Send <span class="kbd">↵</span>
      </button>
      <button class="stop" onclick={() => onStop?.()} title="Cancel current turn">Stop</button>
    </div>
  </div>
</div>

<style>
  .composer {
    border-top: 1px solid var(--line);
    background: linear-gradient(180deg, rgba(124, 92, 255, 0.04), transparent 40%);
    padding: 12px 16px 16px;
  }
  .composer-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }
  .seg {
    background: var(--bg-2);
    color: var(--fg-3);
    border: 1px solid var(--line);
    padding: 4px 12px;
    font-size: 11.5px;
    font-weight: 600;
    border-radius: 999px;
    cursor: pointer;
    transition: all var(--motion-hover);
  }
  .seg.on {
    background: linear-gradient(135deg, rgba(124, 92, 255, 0.25), rgba(74, 216, 199, 0.18));
    color: var(--fg);
    border-color: var(--aurora-1);
    box-shadow: 0 0 14px rgba(124, 92, 255, 0.25);
  }
  .bar-spacer { flex: 1; }
  .hint {
    font-size: 11px;
    color: var(--fg-4);
    font-family: var(--mono);
  }
  .composer-input-wrap {
    position: relative;
    border: 1px solid var(--line-2);
    background: var(--bg-2);
    border-radius: var(--r-md);
    overflow: hidden;
    transition: border-color var(--motion-hover), box-shadow var(--motion-hover);
  }
  .composer-input-wrap:focus-within {
    border-color: var(--aurora-1);
    box-shadow: 0 0 0 1px var(--aurora-1), 0 0 24px rgba(124, 92, 255, 0.2);
  }
  .composer-input-wrap.drag-hover {
    border-color: var(--aurora-3);
    background: rgba(74,216,199,.06);
    box-shadow: 0 0 0 2px var(--aurora-3), 0 0 32px rgba(74,216,199,.3);
  }
  .chip-row {
    display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px;
  }
  .chip {
    display: inline-flex; align-items: center; gap: 6px;
    background: var(--bg-2); border: 1px solid var(--aurora-1);
    color: var(--fg-2); padding: 3px 4px 3px 10px; border-radius: 999px;
    font-family: var(--mono); font-size: 11.5px;
    box-shadow: 0 0 12px rgba(124,92,255,.18);
  }
  .chip-name { max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chip-x {
    width: 18px; height: 18px; border-radius: 50%;
    background: var(--bg-3); border: 0; color: var(--fg-3);
    font-size: 13px; line-height: 1; cursor: pointer; padding: 0;
    display: inline-flex; align-items: center; justify-content: center;
  }
  .chip-x:hover { background: var(--err); color: #fff; }
  .composer-input {
    width: 100%;
    background: none;
    border: 0;
    color: var(--fg);
    font-family: inherit;
    font-size: 14px;
    line-height: 1.55;
    padding: 14px 16px 8px;
    resize: none;
    outline: none;
    min-height: 44px;
    max-height: 240px;
  }
  .composer-input::placeholder { color: var(--fg-4); }

  .composer-foot {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    padding: 6px 10px 10px;
  }
  .send {
    background: linear-gradient(135deg, #7c5cff, #5b8cff 60%, #4ad8c7);
    color: #08090c;
    border: 0;
    padding: 7px 14px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 12.5px;
    cursor: pointer;
    box-shadow: 0 0 18px rgba(124, 92, 255, 0.3);
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .send:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    box-shadow: none;
  }
  .send .kbd {
    font-family: var(--mono);
    font-size: 10.5px;
    background: rgba(8, 9, 12, 0.25);
    padding: 1px 6px;
    border-radius: 4px;
  }
  .stop {
    background: var(--bg-3);
    color: var(--fg-2);
    border: 1px solid var(--line);
    padding: 7px 12px;
    border-radius: 8px;
    font-size: 12px;
    cursor: pointer;
  }
  .stop:hover {
    color: var(--err);
    border-color: rgba(255, 123, 114, 0.4);
  }

  .picker-pop {
    position: absolute;
    bottom: 100%;
    left: 0;
    right: 0;
    margin-bottom: 6px;
    background: var(--bg-1);
    border: 1px solid var(--line-2);
    border-radius: var(--r-md);
    box-shadow: 0 20px 48px rgba(0, 0, 0, 0.5);
    max-height: 320px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    z-index: 10;
  }
  .picker-head {
    padding: 8px 12px;
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--fg-4);
    background: var(--bg-2);
    border-bottom: 1px solid var(--line);
    font-weight: 600;
  }
  .picker-list { overflow-y: auto; }
  .picker-row {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 7px 12px;
    background: none;
    border: 0;
    text-align: left;
    cursor: pointer;
    width: 100%;
  }
  .picker-row.on {
    background: var(--bg-2);
  }
  .picker-key {
    font-family: var(--mono);
    color: var(--aurora-3);
    font-size: 12.5px;
    min-width: 130px;
  }
  .picker-desc { color: var(--fg-3); font-size: 12px; }
</style>
