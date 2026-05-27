<script lang="ts">
  interface Option {
    value: string;
    label: string;
  }

  interface Props {
    value?: string;
    options: Option[];
    ariaLabel?: string;
  }

  let { value = $bindable(''), options, ariaLabel }: Props = $props();
</script>

<div class="select-wrap">
  <select bind:value aria-label={ariaLabel}>
    {#each options as opt (opt.value)}
      <option value={opt.value}>{opt.label}</option>
    {/each}
  </select>
  <span class="chev">▾</span>
</div>

<style>
  .select-wrap {
    position: relative;
    display: block;
  }
  select {
    appearance: none;
    -webkit-appearance: none;
    width: 100%;
    padding: 9px 32px 9px 12px;
    background: var(--bg-1);
    border: 1px solid var(--line-2);
    border-radius: var(--r-md);
    color: var(--fg);
    font-size: 12.5px;
    cursor: pointer;
    transition: all var(--motion-hover);
    font-family: var(--sans);
  }
  select:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
    outline: none;
  }
  .chev {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--fg-4);
    pointer-events: none;
    font-size: 10px;
  }
</style>
