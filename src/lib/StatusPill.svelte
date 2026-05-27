<script lang="ts">
  import Pill from './design-system/primitives/Pill.svelte';

  interface Props {
    state?: 'connected' | 'connecting' | 'disconnected' | 'error';
  }

  let { state = 'connected' }: Props = $props();

  const config = $derived.by(() => {
    switch (state) {
      case 'connected':
        return { tone: 'ok' as const, label: 'Live', pulse: true };
      case 'connecting':
        return { tone: 'warn' as const, label: 'Connecting', pulse: true };
      case 'disconnected':
        return { tone: 'neutral' as const, label: 'Offline', pulse: false };
      case 'error':
        return { tone: 'err' as const, label: 'Error', pulse: false };
    }
  });
</script>

<Pill tone={config.tone} pulse={config.pulse}>{config.label}</Pill>
