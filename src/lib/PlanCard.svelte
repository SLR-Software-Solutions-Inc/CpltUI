<script lang="ts">
  import type { PlanItem } from './types';
  import Button from './design-system/primitives/Button.svelte';

  interface Props {
    items: PlanItem[];
    title?: string;
    estimate?: string;
    onApprove?: () => void;
    onEdit?: () => void;
    onCancel?: () => void;
  }

  let {
    items,
    title = 'Plan',
    estimate,
    onApprove,
    onEdit,
    onCancel,
  }: Props = $props();

  const doneCount = $derived(items.filter((i) => i.done).length);
  const computedEst = $derived(estimate ?? `${doneCount} / ${items.length} done`);
</script>

<div class="plan-card" role="region" aria-label="Agent plan">
  <div class="plan-head">
    <span class="badge">PLAN</span>
    <span class="title">{title}</span>
    <span class="est">{computedEst}</span>
  </div>
  <div class="plan-items">
    {#each items as item (item.id)}
      <div class="plan-item">
        <div class="plan-check" class:done={item.done}>{item.done ? '✓' : '·'}</div>
        <span class="step">{item.step}</span>
        <span class="text">{item.text}</span>
      </div>
    {/each}
  </div>
  <div class="plan-actions">
    <Button variant="primary" onclick={() => onApprove?.()}>
      Approve &amp; execute <span class="kbd">⏎</span>
    </Button>
    <Button variant="ghost" onclick={() => onEdit?.()}>Edit plan</Button>
    <Button variant="ghost" onclick={() => onCancel?.()}>Cancel</Button>
  </div>
</div>

<style>
  .plan-card {
    border: 1px solid var(--accent-line);
    border-radius: var(--r-lg);
    background: linear-gradient(180deg, rgba(124, 92, 255, 0.07), rgba(124, 92, 255, 0.02));
    margin: 10px 0;
    overflow: hidden;
    box-shadow: var(--glow);
  }
  .plan-head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--accent-line);
  }
  .badge {
    padding: 2px 8px;
    border-radius: var(--r-pill);
    background: linear-gradient(135deg, var(--aurora-1), var(--aurora-4));
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
  }
  .title {
    font-weight: 600;
    color: var(--fg);
    font-size: 13px;
  }
  .est {
    margin-left: auto;
    font-size: 11px;
    color: var(--fg-3);
    font-family: var(--mono);
  }
  .plan-items {
    padding: 8px 16px 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .plan-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 6px 0;
    font-size: 12.5px;
    color: var(--fg-2);
  }
  .plan-check {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    border: 1.5px solid var(--line-3);
    flex-shrink: 0;
    margin-top: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: #fff;
    background: transparent;
  }
  .plan-check.done {
    background: linear-gradient(135deg, var(--aurora-3), var(--aurora-2));
    border-color: transparent;
  }
  .step {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--fg-4);
    margin-right: 4px;
  }
  .text {
    flex: 1;
  }
  .plan-actions {
    padding: 0 16px 16px;
    display: flex;
    gap: 8px;
  }
  .kbd {
    font-family: var(--mono);
    font-size: 10px;
    color: rgba(255, 255, 255, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.2);
    padding: 0 4px;
    border-radius: 3px;
  }
</style>
