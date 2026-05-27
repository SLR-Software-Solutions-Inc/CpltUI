<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    label: string;
    hint?: string;
    children: Snippet;
  }

  let { label, hint, children }: Props = $props();
</script>

<div class="field">
  <div class="label" role="presentation">{label}</div>
  {@render children()}
  {#if hint}
    <div class="hint">{hint}</div>
  {/if}
</div>

<style>
  .field {
    margin-bottom: 20px;
  }
  .label {
    display: block;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--fg-2);
    margin-bottom: 6px;
  }
  .hint {
    font-size: 11px;
    color: var(--fg-4);
    margin-top: 6px;
  }
  .hint :global(code) {
    font-family: var(--mono);
    color: var(--aurora-3);
  }
</style>
