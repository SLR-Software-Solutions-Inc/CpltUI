<script lang="ts">
  import { listCwdFiles, type FileItem } from './file-picker';

  interface Props {
    cwd: string;
    onPick?: (f: FileItem) => void;
  }

  let { cwd, onPick }: Props = $props();

  let files = $state<FileItem[]>([]);
  let filter = $state('');
  let collapsed = $state<Set<string>>(new Set());

  $effect(() => {
    if (cwd && !cwd.startsWith('~')) {
      void listCwdFiles(cwd).then((items) => (files = items));
    } else {
      files = [];
    }
  });

  // Group files into a tree by directory
  interface Node {
    name: string;
    path: string; // full
    isDir: boolean;
    children: Node[];
    file?: FileItem;
  }

  const tree = $derived.by(() => {
    const root: Node = { name: '', path: '', isDir: true, children: [] };
    const q = filter.trim().toLowerCase();
    const visible = q
      ? files.filter((f) => f.rel.toLowerCase().includes(q))
      : files;
    for (const f of visible) {
      const parts = f.rel.split('/');
      let cur = root;
      for (let i = 0; i < parts.length; i++) {
        const seg = parts[i];
        const isLast = i === parts.length - 1;
        let child = cur.children.find((c) => c.name === seg && c.isDir === !isLast);
        if (!child) {
          child = {
            name: seg,
            path: cur.path ? `${cur.path}/${seg}` : seg,
            isDir: !isLast,
            children: [],
            file: isLast ? f : undefined,
          };
          cur.children.push(child);
        }
        cur = child;
      }
    }
    // Sort: dirs first, alpha
    const sortNode = (n: Node) => {
      n.children.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      for (const c of n.children) if (c.isDir) sortNode(c);
    };
    sortNode(root);
    return root;
  });

  function toggle(p: string) {
    const next = new Set(collapsed);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    collapsed = next;
  }
</script>

<div class="ft">
  <input
    class="ft-filter"
    placeholder="filter files…"
    bind:value={filter}
    spellcheck="false"
  />

  {#if !cwd || cwd.startsWith('~')}
    <div class="ft-empty">start a session to load files (cwd must resolve)</div>
  {:else if files.length === 0}
    <div class="ft-empty">scanning {cwd.split('/').pop()}…</div>
  {:else}
    <div class="ft-list">
      {@render renderChildren(tree, 0)}
    </div>
    <div class="ft-foot">{files.length} files indexed</div>
  {/if}
</div>

{#snippet renderChildren(node: Node, depth: number)}
  {#each node.children as c (c.path)}
    {#if c.isDir}
      <button
        class="ft-row ft-dir"
        style:padding-left="{8 + depth * 12}px"
        onclick={() => toggle(c.path)}
      >
        <span class="ft-chev" class:open={!collapsed.has(c.path)}>▸</span>
        <span class="ft-name">{c.name}/</span>
      </button>
      {#if !collapsed.has(c.path)}
        {@render renderChildren(c, depth + 1)}
      {/if}
    {:else}
      <button
        class="ft-row ft-file"
        style:padding-left="{20 + depth * 12}px"
        onclick={() => c.file && onPick?.(c.file)}
      >
        <span class="ft-name">{c.name}</span>
      </button>
    {/if}
  {/each}
{/snippet}

<style>
  .ft { display: flex; flex-direction: column; height: 100%; min-height: 0; }
  .ft-filter {
    margin: 8px 0 6px;
    background: var(--bg-2);
    border: 1px solid var(--line);
    color: var(--fg);
    padding: 4px 8px;
    border-radius: var(--r-sm);
    font-family: var(--mono);
    font-size: 11px;
    outline: none;
  }
  .ft-filter:focus { border-color: var(--aurora-1); }
  .ft-list { flex: 1; overflow-y: auto; }
  .ft-row {
    display: flex; align-items: center; gap: 5px;
    background: none; border: 0; width: 100%;
    text-align: left; cursor: pointer; color: var(--fg-2);
    font-family: var(--mono); font-size: 11.5px;
    padding: 2px 8px;
    border-radius: 0;
  }
  .ft-row:hover { background: var(--bg-2); color: var(--fg); }
  .ft-dir { color: var(--fg-3); }
  .ft-dir .ft-name { color: var(--aurora-3); }
  .ft-chev {
    color: var(--fg-4); font-size: 9px; width: 10px; display: inline-block;
    transition: transform 120ms ease;
  }
  .ft-chev.open { transform: rotate(90deg); color: var(--aurora-3); }
  .ft-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ft-empty { color: var(--fg-4); font-size: 11.5px; padding: 12px 4px; font-style: italic; }
  .ft-foot {
    font-size: 10px; color: var(--fg-4); padding: 6px 4px 2px;
    font-family: var(--mono); border-top: 1px solid var(--line); margin-top: 6px;
  }
</style>
