<script lang="ts">
  interface Shortcut {
    keys: string[];
    desc: string;
  }

  const shortcuts: Shortcut[] = [
    { keys: ['⌘', 'N'], desc: 'New session' },
    { keys: ['⌘', ','], desc: 'Settings' },
    { keys: ['⌘', '⏎'], desc: 'Send prompt' },
    { keys: ['⇧', '⇥'], desc: 'Toggle plan mode' },
    { keys: ['/'], desc: 'Slash command autocomplete' },
  ];
</script>

<div class="empty">
  <pre class="empty-mark">  ╭───────────────────────╮
  │   ░▒▓ CpltUI ▓▒░   │
  │                       │
  │    ▲ ▲ ▲ ▲ ▲ ▲ ▲     │
  │   ▲ ◆ ◆ ◆ ◆ ◆ ▲      │
  │    ▽ ▽ ▽ ▽ ▽ ▽ ▽     │
  ╰───────────────────────╯</pre>
  <div class="empty-h">Nothing here <span class="gradient">yet</span>.</div>
  <div class="empty-sub">Click <span class="cmd">+ New session</span> in the sidebar or hit <span class="cmd">⌘N</span> to begin.</div>
  <div class="empty-keys">
    {#each shortcuts as s, i (i)}
      <div class="k">
        {#each s.keys as key (key)}<span>{key}</span>{/each}
      </div>
      <div class="d">{s.desc}</div>
    {/each}
  </div>
</div>

<style>
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 22px;
    text-align: center;
  }
  .empty-mark {
    font-family: var(--mono);
    font-size: 11px;
    line-height: 1.25;
    color: var(--aurora-1);
    text-align: center;
    white-space: pre;
    margin-bottom: 24px;
    text-shadow: 0 0 20px rgba(124, 92, 255, 0.4);
  }
  .empty-h {
    font-size: 24px;
    font-weight: 600;
    color: var(--fg);
    margin-bottom: 8px;
    letter-spacing: -0.5px;
  }
  .gradient {
    background: linear-gradient(135deg, var(--aurora-1), var(--aurora-3));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .empty-sub {
    font-size: 13px;
    color: var(--fg-3);
    margin-bottom: 28px;
  }
  .empty-keys {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 10px 18px;
    font-size: 12px;
    max-width: 380px;
    margin: 0 auto;
    text-align: left;
  }
  .k {
    font-family: var(--mono);
    font-size: 11px;
    display: flex;
    gap: 3px;
    justify-content: flex-end;
  }
  .k span {
    border: 1px solid var(--line-2);
    background: var(--bg-2);
    padding: 1px 6px;
    border-radius: 4px;
    color: var(--fg-2);
  }
  .d {
    color: var(--fg-3);
  }
</style>
