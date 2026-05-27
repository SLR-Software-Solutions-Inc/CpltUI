<script lang="ts">
  import type { HudState } from './types';
  import { formatTokens } from './format';

  interface Props {
    state: HudState;
  }

  let { state }: Props = $props();
</script>

<div class="hud-mini" role="status" aria-label="Token and premium usage">
  <div class="item" title="Input tokens — estimated locally (char/4). Real numbers require ACP usage events which Copilot does not currently emit.">
    <span class="arrow-up">↑</span>
    <span>{formatTokens(state.inputTokens)}</span>
    <span class="est">~</span>
  </div>
  <div class="item" title="Output tokens — estimated locally (char/4)">
    <span class="arrow-dn">↓</span>
    <span>{formatTokens(state.outputTokens)}</span>
    <span class="est">~</span>
  </div>
  <div class="item" title="Premium requests counted per assistant turn (no usage breakdown — use /usage slash for real numbers)">
    <span class="premium">◆</span>
    <span>{state.premiumReqs} req</span>
  </div>
</div>

<style>
  .hud-mini {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 5px 12px;
    background: var(--bg-2);
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    font-family: var(--mono);
    font-size: 11px;
    color: var(--fg-3);
  }
  .item {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .arrow-up {
    color: var(--aurora-3);
  }
  .arrow-dn {
    color: var(--aurora-2);
  }
  .muted {
    color: var(--fg-4);
  }
  .premium {
    color: var(--warn);
  }
  .est {
    color: var(--fg-4);
    font-size: 9.5px;
    margin-left: 2px;
  }
  .mult {
    background: linear-gradient(135deg, var(--aurora-1), var(--aurora-2));
    color: #fff;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 600;
  }
  .mult.x2 {
    background: linear-gradient(135deg, var(--warn), #e89a3a);
    color: #1a1300;
  }
</style>
