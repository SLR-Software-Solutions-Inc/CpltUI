<script lang="ts">
  interface Props {
    value?: string;
    placeholder?: string;
    type?: 'text' | 'password' | 'email' | 'number';
    disabled?: boolean;
    mono?: boolean;
    ariaLabel?: string;
  }

  let {
    value = $bindable(''),
    placeholder,
    type = 'text',
    disabled = false,
    mono = false,
    ariaLabel,
  }: Props = $props();
</script>

<input
  class="input"
  class:mono
  {type}
  {placeholder}
  {disabled}
  bind:value
  aria-label={ariaLabel}
/>

<style>
  .input {
    width: 100%;
    padding: 8px 12px;
    background: var(--bg-1);
    border: 1px solid var(--line-2);
    border-radius: var(--r-md);
    color: var(--fg);
    font-size: 12.5px;
    transition: all var(--motion-hover);
    font-family: var(--sans);
  }
  .input.mono {
    font-family: var(--mono);
    color: var(--fg-4);
  }
  .input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
    outline: none;
  }
  .input:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }
  .input::placeholder {
    color: var(--fg-4);
  }
</style>
