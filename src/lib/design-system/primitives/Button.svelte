<script lang="ts">
  import type { Snippet } from 'svelte';

  type Variant = 'primary' | 'secondary' | 'ghost' | 'warn' | 'danger-ghost' | 'icon';
  type Size = 'sm' | 'md';

  interface Props {
    variant?: Variant;
    size?: Size;
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    title?: string;
    ariaLabel?: string;
    onclick?: (e: MouseEvent) => void;
    children: Snippet;
  }

  let {
    variant = 'secondary',
    size = 'md',
    type = 'button',
    disabled = false,
    title,
    ariaLabel,
    onclick,
    children,
  }: Props = $props();
</script>

<button
  {type}
  {disabled}
  {title}
  aria-label={ariaLabel}
  class="btn v-{variant} s-{size}"
  {onclick}
>
  {@render children()}
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: var(--r-md);
    font-size: 12px;
    font-weight: 500;
    transition: all var(--motion-toggle);
    border: 1px solid transparent;
    color: var(--fg);
    background: transparent;
    cursor: pointer;
    line-height: 1;
  }
  .btn:focus-visible {
    box-shadow: 0 0 0 3px var(--accent-soft);
    outline: none;
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .s-sm {
    padding: 5px 10px;
    font-size: 11.5px;
  }
  .v-primary {
    background: linear-gradient(180deg, var(--aurora-1), #5e44e8);
    color: #fff;
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.1) inset,
      0 4px 16px rgba(124, 92, 255, 0.35);
  }
  .v-primary:hover {
    filter: brightness(1.1);
  }
  .v-secondary {
    background: var(--bg-2);
    color: var(--fg-2);
    border-color: var(--line-2);
  }
  .v-secondary:hover {
    background: var(--bg-3);
    color: var(--fg);
  }
  .v-ghost {
    background: var(--bg-2);
    color: var(--fg-2);
    border-color: var(--line-2);
  }
  .v-ghost:hover {
    background: var(--bg-3);
    color: var(--fg);
  }
  .v-warn {
    background: linear-gradient(180deg, var(--warn), #e89a3a);
    color: #1a1300;
    font-weight: 600;
  }
  .v-danger-ghost {
    color: var(--err);
    border-color: rgba(255, 107, 138, 0.3);
  }
  .v-danger-ghost:hover {
    background: rgba(255, 107, 138, 0.08);
  }
  .v-icon {
    width: 30px;
    height: 30px;
    padding: 0;
    justify-content: center;
    color: var(--fg-3);
  }
  .v-icon:hover {
    background: var(--bg-2);
    color: var(--fg);
  }
</style>
