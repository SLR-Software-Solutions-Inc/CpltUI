<script lang="ts">
  interface Props {
    code: string;
    lang?: string;
  }
  let { code, lang = '' }: Props = $props();
  let copied = $state(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      /* ignore */
    }
  }
</script>

<div class="cb">
  <div class="cb-head">
    <span class="cb-lang">{lang || 'plain'}</span>
    <button class="cb-copy" onclick={copy} aria-label="Copy code">
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  </div>
  <pre><code>{code}</code></pre>
</div>

<style>
  .cb {
    background: var(--bg-0);
    border: 1px solid var(--line);
    border-radius: var(--r-sm);
    margin: 8px 0;
    overflow: hidden;
  }
  .cb-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 10px;
    background: var(--bg-2);
    border-bottom: 1px solid var(--line);
  }
  .cb-lang {
    font-family: var(--mono);
    font-size: 10.5px;
    color: var(--fg-4);
    text-transform: lowercase;
  }
  .cb-copy {
    background: none;
    border: 0;
    color: var(--fg-3);
    font-family: inherit;
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 4px;
    cursor: pointer;
  }
  .cb-copy:hover {
    background: var(--bg-3);
    color: var(--aurora-3);
  }
  pre {
    margin: 0;
    padding: 12px;
    overflow-x: auto;
  }
  code {
    font-family: var(--mono);
    font-size: 12.5px;
    color: var(--fg);
    white-space: pre;
  }
</style>
