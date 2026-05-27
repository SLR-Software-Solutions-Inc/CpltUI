<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { EditorState, type Extension } from '@codemirror/state';
  import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view';
  import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
  import { bracketMatching, indentOnInput, foldGutter, foldKeymap } from '@codemirror/language';
  import { javascript } from '@codemirror/lang-javascript';
  import { markdown } from '@codemirror/lang-markdown';
  import { json } from '@codemirror/lang-json';
  import { html as langHtml } from '@codemirror/lang-html';
  import { css as langCss } from '@codemirror/lang-css';
  import { rust } from '@codemirror/lang-rust';
  import { python } from '@codemirror/lang-python';
  import { oneDark } from '@codemirror/theme-one-dark';
  import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

  interface Props {
    path?: string;
    onClose?: () => void;
  }

  let { path = '', onClose }: Props = $props();

  let hostEl: HTMLDivElement | null = $state(null);
  let view: EditorView | null = null;
  let dirty = $state(false);
  let saving = $state(false);
  let lastSavedAt = $state<number | null>(null);
  let loadError = $state<string | null>(null);

  function langForPath(p: string): Extension[] {
    const ext = p.split('.').pop()?.toLowerCase() ?? '';
    switch (ext) {
      case 'js':
      case 'jsx':
      case 'mjs':
      case 'cjs':
        return [javascript()];
      case 'ts':
      case 'tsx':
        return [javascript({ typescript: true, jsx: ext === 'tsx' })];
      case 'md':
      case 'markdown':
        return [markdown()];
      case 'json':
      case 'jsonc':
        return [json()];
      case 'html':
      case 'htm':
      case 'svelte':
        return [langHtml()];
      case 'css':
      case 'scss':
        return [langCss()];
      case 'rs':
        return [rust()];
      case 'py':
        return [python()];
      default:
        return [];
    }
  }

  function makeState(content: string, p: string): EditorState {
    return EditorState.create({
      doc: content,
      extensions: [
        lineNumbers(),
        foldGutter(),
        history(),
        drawSelection(),
        highlightActiveLine(),
        bracketMatching(),
        indentOnInput(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap, indentWithTab]),
        oneDark,
        EditorView.theme({
          '&': { height: '100%', fontSize: '12.5px' },
          '.cm-scroller': { fontFamily: 'JetBrains Mono, ui-monospace, Menlo, monospace' },
          '.cm-gutters': { background: 'var(--bg-1)', borderRight: '1px solid var(--line)' },
        }),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) dirty = true;
        }),
        ...langForPath(p),
      ],
    });
  }

  async function loadFile(p: string) {
    loadError = null;
    if (!p) {
      destroyView();
      return;
    }
    try {
      const content = await readTextFile(p);
      destroyView();
      if (!hostEl) return;
      view = new EditorView({
        state: makeState(content, p),
        parent: hostEl,
      });
      dirty = false;
      lastSavedAt = null;
    } catch (e) {
      loadError = (e as Error).message;
    }
  }

  async function save() {
    if (!view || !path) return;
    saving = true;
    try {
      const text = view.state.doc.toString();
      await writeTextFile(path, text);
      dirty = false;
      lastSavedAt = Date.now();
    } catch (e) {
      loadError = (e as Error).message;
    } finally {
      saving = false;
    }
  }

  function destroyView() {
    view?.destroy();
    view = null;
    dirty = false;
  }

  function onKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      void save();
    }
  }

  onMount(() => {
    if (path) void loadFile(path);
  });

  $effect(() => {
    if (path) void loadFile(path);
  });

  onDestroy(() => destroyView());

  const fname = $derived(path ? path.split('/').pop() : '');
  const dirShort = $derived(path ? path.replace(/\/[^/]+$/, '').replace('/Users/narender', '~') : '');
</script>

<div class="ep" onkeydown={onKey} role="region" aria-label="Editor">
  <div class="ep-head">
    <span class="ep-name">{fname || 'no file'}</span>
    <span class="ep-dir" title={path}>{dirShort}</span>
    {#if dirty}<span class="ep-dot" title="Unsaved changes">●</span>{/if}
    {#if lastSavedAt}<span class="ep-saved">saved</span>{/if}
    <span class="ep-spacer"></span>
    <button class="ep-btn" onclick={save} disabled={!dirty || saving} title="Save (Cmd+S)">
      {saving ? 'Saving…' : 'Save'}
    </button>
    <button class="ep-btn ep-close" onclick={() => onClose?.()} aria-label="Close">×</button>
  </div>
  {#if loadError}
    <div class="ep-err">{loadError}</div>
  {/if}
  <div class="ep-host" bind:this={hostEl}></div>
</div>

<style>
  .ep {
    display: flex; flex-direction: column;
    background: var(--bg-1);
    border-right: 1px solid var(--line);
    height: 100%; min-height: 0; overflow: hidden;
  }
  .ep-head {
    display: flex; align-items: center; gap: 10px;
    padding: 7px 12px;
    background: var(--bg-2);
    border-bottom: 1px solid var(--line);
    font-family: var(--mono); font-size: 11.5px;
    color: var(--fg-3);
  }
  .ep-name { color: var(--fg); font-weight: 600; }
  .ep-dir { color: var(--fg-4); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 260px; }
  .ep-dot { color: var(--warn); font-size: 14px; line-height: 1; }
  .ep-saved {
    background: rgba(86,211,100,.16); color: var(--ok);
    padding: 1px 6px; border-radius: 999px; font-size: 9.5px; text-transform: uppercase; letter-spacing: .5px; font-weight: 600;
  }
  .ep-spacer { flex: 1; }
  .ep-btn {
    background: var(--bg-3); color: var(--fg-2);
    border: 1px solid var(--line); padding: 4px 10px;
    border-radius: 6px; font-family: inherit; font-size: 11px; font-weight: 600;
    cursor: pointer;
  }
  .ep-btn:disabled { opacity: .45; cursor: not-allowed; }
  .ep-btn:hover:not(:disabled) { border-color: var(--aurora-1); color: var(--fg); }
  .ep-close { padding: 2px 8px; font-size: 14px; line-height: 1; }
  .ep-err {
    padding: 6px 12px; color: var(--err); font-size: 12px;
    background: rgba(255,123,114,.08); border-bottom: 1px solid rgba(255,123,114,.3);
    font-family: var(--mono);
  }
  .ep-host { flex: 1; min-height: 0; overflow: hidden; }
  .ep-host :global(.cm-editor) { height: 100%; outline: none; }
</style>
