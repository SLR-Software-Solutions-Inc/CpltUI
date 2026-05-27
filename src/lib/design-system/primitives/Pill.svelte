<script lang="ts">
  import type { Snippet } from 'svelte';

  type Tone = 'ok' | 'warn' | 'err' | 'info' | 'neutral' | 'aurora';

  interface Props {
    tone?: Tone;
    dot?: boolean;
    pulse?: boolean;
    children: Snippet;
  }

  let { tone = 'neutral', dot = true, pulse = false, children }: Props = $props();
</script>

<span class="pill t-{tone}">
  {#if dot}<span class="dot" class:pulse></span>{/if}
  {@render children()}
</span>

<style>
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 2px 8px;
    border-radius: var(--r-pill);
    font-size: 10.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border: 1px solid var(--line-2);
    background: var(--bg-2);
    color: var(--fg-3);
    line-height: 1.4;
  }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    box-shadow: 0 0 6px currentColor;
  }
  .dot.pulse {
    animation: pulse 1.8s ease-in-out infinite;
  }
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }
  .t-ok {
    color: var(--ok);
    background: rgba(74, 216, 199, 0.12);
    border-color: rgba(74, 216, 199, 0.3);
  }
  .t-warn {
    color: var(--warn);
    background: rgba(255, 180, 84, 0.15);
    border-color: rgba(255, 180, 84, 0.3);
  }
  .t-err {
    color: var(--err);
    background: rgba(255, 107, 138, 0.12);
    border-color: rgba(255, 107, 138, 0.3);
  }
  .t-info {
    color: var(--info);
    background: rgba(91, 140, 255, 0.12);
    border-color: rgba(91, 140, 255, 0.3);
  }
  .t-aurora {
    color: #fff;
    background: linear-gradient(135deg, var(--aurora-1), var(--aurora-4));
    border-color: transparent;
  }
</style>
