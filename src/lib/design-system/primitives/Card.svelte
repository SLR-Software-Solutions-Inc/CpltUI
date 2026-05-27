<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    glow?: boolean;
    padding?: string;
    accent?: 'aurora' | 'warn' | 'none';
    children: Snippet;
  }

  let { glow = false, padding = '12px', accent = 'none', children }: Props = $props();
</script>

<div class="card a-{accent}" class:glow style:padding>
  {@render children()}
</div>

<style>
  .card {
    border: 1px solid var(--line-2);
    border-radius: var(--r-lg);
    background: var(--bg-1);
    transition: border-color var(--motion-hover);
  }
  .card.glow {
    box-shadow: var(--glow);
  }
  .a-aurora {
    border-color: var(--accent-line);
    background: linear-gradient(180deg, rgba(124, 92, 255, 0.07), rgba(124, 92, 255, 0.02));
  }
  .a-warn {
    border-color: rgba(255, 180, 84, 0.3);
    background: linear-gradient(180deg, rgba(255, 180, 84, 0.05), rgba(255, 180, 84, 0.01));
  }
</style>
