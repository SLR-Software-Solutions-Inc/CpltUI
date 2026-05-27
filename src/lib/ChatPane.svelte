<script lang="ts">
  import type { HudState, SlashCommand } from './types';
  import type { Msg } from './state.svelte';
  import { app } from './state.svelte';
  import Composer from './Composer.svelte';
  import MessageBlock from './MessageBlock.svelte';
  import HUD from './HUD.svelte';
  import RepoChip from './RepoChip.svelte';
  import EmptyState from './EmptyState.svelte';
  import Terminal from './Terminal.svelte';
  import Button from './design-system/primitives/Button.svelte';

  let termOpen = $state(false);

  interface Props {
    messages: Msg[];
    hud: HudState;
    slashCommands: SlashCommand[];
    repo: string;
    branch: string;
    model: string;
    agent: string;
    cwd?: string;
    planMode?: boolean;
    onSend?: (text: string, chips: unknown[]) => void;
    onStop?: () => void;
    onTogglePlan?: (on: boolean) => void;
    onOpenSettings?: () => void;
    onPickModel?: (id: string) => void;
  }

  let {
    messages,
    hud,
    slashCommands,
    repo,
    branch,
    model,
    agent,
    cwd = '',
    planMode = $bindable(false),
    onSend,
    onStop,
    onTogglePlan,
    onOpenSettings,
    onPickModel,
  }: Props = $props();

  let modelOpen = $state(false);
  function toggleModel() { modelOpen = !modelOpen; }
  // Orchestrator state for current session — drives the live harness badge
  const orchState = $derived(
    app.currentSessionId ? app.orchestratorBySession.get(app.currentSessionId) ?? null : null,
  );
  function pickModel(id: string) {
    onPickModel?.(id);
    modelOpen = false;
  }
  function onDocClick(e: MouseEvent) {
    if (!(e.target as HTMLElement).closest('.model-picker')) modelOpen = false;
  }

  let messagesEl: HTMLDivElement | null = $state(null);

  $effect(() => {
    void messages.length;
    queueMicrotask(() => {
      if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  });
</script>

<svelte:window onclick={onDocClick} />

<main class="chat">
  <header class="chat-header">
    <RepoChip {repo} {branch} />

    <div class="picker model-picker">
      <button class="picker-btn" onclick={toggleModel} aria-haspopup="listbox" aria-expanded={modelOpen}>
        <span class="label">Model</span>
        <span class="val">{model}</span>
        <span class="chev" class:open={modelOpen}>▾</span>
      </button>
      {#if modelOpen}
        <div class="model-pop" role="listbox">
          {#if app.models.length === 0}
            <div class="pop-empty">no models loaded yet</div>
          {:else}
            {#each app.models as m (m.id)}
              <button
                class="pop-row"
                class:on={m.name === model || m.id === model}
                onclick={() => pickModel(m.id)}
                role="option"
                aria-selected={m.name === model}
              >
                <div class="pop-main">
                  <span class="pop-name">{m.name}</span>
                  <span class="pop-mult">{m.premiumMultiplier}×</span>
                </div>
                <div class="pop-sub">{m.provider} · {(m.contextWindow / 1000).toFixed(0)}k ctx</div>
              </button>
            {/each}
          {/if}
          <div class="pop-foot">click to apply live · or use /model in chat</div>
        </div>
      {/if}
    </div>

    <div class="picker static" title="Agent is set at session-spawn time (see Settings → Agents)">
      <span class="label">Agent</span>
      <span class="val">{agent}</span>
    </div>

    {#if orchState}
      <div
        class="orch-badge"
        class:orch-complete={orchState.complete}
        class:orch-exceeded={orchState.loopExceeded}
        title={orchState.lastReview
          ? `Reviewers — A:${orchState.lastReview.A}  B:${orchState.lastReview.B}  C:${orchState.lastReview.C}`
          : 'Master orchestrator harness — waiting for first ITER status block'}
      >
        <span class="orch-lbl">HARNESS</span>
        <span class="orch-iter">{orchState.iter}/{orchState.bound}</span>
        {#if orchState.lastReview}
          <span class="orch-rev">
            <span class={orchState.lastReview.A === 'APPROVE' ? 'rv-ok' : 'rv-bad'}>A</span>
            <span class={orchState.lastReview.B === 'APPROVE' ? 'rv-ok' : 'rv-bad'}>B</span>
            <span class={orchState.lastReview.C === 'APPROVE' ? 'rv-ok' : 'rv-bad'}>C</span>
          </span>
        {/if}
        {#if orchState.complete}<span class="orch-tag">✓ done</span>{/if}
        {#if orchState.loopExceeded}<span class="orch-tag orch-tag-warn">! loop &gt;{orchState.bound}</span>{/if}
      </div>
    {/if}

    <div class="header-spacer"></div>

    <HUD state={hud} />

    <Button
      variant="icon"
      title={termOpen ? 'Hide terminal' : 'Show terminal'}
      onclick={() => (termOpen = !termOpen)}
      ariaLabel="Terminal"
    >
      <span class:on={termOpen} style:color={termOpen ? 'var(--aurora-3)' : undefined}>▤</span>
    </Button>
    <Button variant="icon" title="Settings" onclick={() => onOpenSettings?.()} ariaLabel="Settings">
      <span>⚙</span>
    </Button>
    <Button variant="icon" title="History" ariaLabel="History">
      <span>⟲</span>
    </Button>
  </header>

  <div class="messages" bind:this={messagesEl} role="log" aria-live="polite">
    {#if messages.length === 0}
      <EmptyState />
    {:else}
      <div class="msg-wrap">
        {#each messages as msg (msg.id)}
          <MessageBlock message={msg} />
        {/each}
      </div>
    {/if}
  </div>

  <Composer
    {slashCommands}
    repoLabel={repo}
    {cwd}
    bind:planMode
    {onSend}
    {onStop}
    {onTogglePlan}
  />

  {#if termOpen}
    <Terminal {cwd} open={termOpen} />
  {/if}
</main>

<style>
  .chat {
    display: flex;
    flex-direction: column;
    background: var(--bg-0);
    overflow: hidden;
    position: relative;
    height: 100%;
    min-height: 0;
  }
  .chat-header {
    padding: 14px 22px;
    border-bottom: 1px solid var(--line);
    background: rgba(8, 9, 12, 0.6);
    backdrop-filter: blur(12px);
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .picker {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    background: var(--bg-2);
    border: 1px solid var(--line-2);
    border-radius: var(--r-md);
    font-size: 12px;
    color: var(--fg-2);
    cursor: pointer;
    transition: all var(--motion-hover);
  }
  .picker:hover {
    background: var(--bg-3);
    border-color: var(--line-3);
  }
  .label {
    color: var(--fg-4);
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .val {
    color: var(--fg);
    font-weight: 500;
  }
  .chev {
    color: var(--fg-4);
    font-size: 9px;
    margin-left: 2px;
    transition: transform 120ms ease;
  }
  .chev.open { transform: rotate(180deg); color: var(--aurora-3); }
  .picker.static { cursor: default; }
  .picker.static:hover { background: var(--bg-2); border-color: var(--line-2); }
  .model-picker { position: relative; padding: 0; background: none; border: none; }
  .picker-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 5px 10px; background: var(--bg-2); border: 1px solid var(--line-2);
    border-radius: var(--r-md); font-size: 12px; color: var(--fg-2);
    cursor: pointer; transition: all var(--motion-hover);
    font-family: inherit;
  }
  .picker-btn:hover { background: var(--bg-3); border-color: var(--line-3); }
  .model-pop {
    position: absolute; top: 100%; left: 0; margin-top: 6px;
    background: var(--bg-1); border: 1px solid var(--line-2);
    border-radius: var(--r-md); box-shadow: 0 20px 48px rgba(0,0,0,.6);
    min-width: 280px; z-index: 50; overflow: hidden;
  }
  .pop-row {
    display: flex; flex-direction: column; gap: 2px;
    padding: 8px 12px; background: none; border: 0; width: 100%;
    text-align: left; cursor: pointer; color: var(--fg);
    border-bottom: 1px solid rgba(38,44,57,.4);
  }
  .pop-row:last-of-type { border-bottom: 0; }
  .pop-row:hover { background: var(--bg-2); }
  .pop-row.on { background: linear-gradient(90deg, rgba(124,92,255,.12), transparent); }
  .pop-main { display: flex; justify-content: space-between; align-items: baseline; }
  .pop-name { font-size: 13px; font-weight: 600; }
  .pop-mult {
    background: var(--bg-3); border: 1px solid var(--line); padding: 1px 6px;
    border-radius: 999px; font-family: var(--mono); font-size: 10px; color: var(--fg-3);
  }
  .pop-sub { font-size: 11px; color: var(--fg-4); font-family: var(--mono); }
  .pop-foot { padding: 6px 12px; font-size: 10.5px; color: var(--fg-4); border-top: 1px solid var(--line); font-family: var(--mono); }
  .pop-empty { padding: 14px; color: var(--fg-4); font-size: 12px; text-align: center; }
  .header-spacer {
    flex: 1;
  }
  .orch-badge {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 4px 10px;
    background: linear-gradient(135deg, rgba(124,92,255,.18), rgba(74,216,199,.10));
    border: 1px solid rgba(124,92,255,.35);
    border-radius: 999px;
    font-family: var(--mono);
    font-size: 10.5px;
    color: var(--fg-2);
  }
  .orch-badge.orch-complete { background: linear-gradient(135deg, rgba(86,211,100,.22), rgba(74,216,199,.10)); border-color: rgba(86,211,100,.5); }
  .orch-badge.orch-exceeded { background: linear-gradient(135deg, rgba(255,166,87,.22), rgba(255,123,114,.10)); border-color: rgba(255,166,87,.5); }
  .orch-lbl { color: var(--fg-4); text-transform: uppercase; letter-spacing: .6px; font-size: 9.5px; font-weight: 700; }
  .orch-iter { color: var(--fg); font-weight: 700; }
  .orch-rev { display: inline-flex; gap: 3px; padding-left: 4px; border-left: 1px solid rgba(255,255,255,.1); }
  .orch-rev span { padding: 0 4px; border-radius: 4px; font-weight: 700; }
  .rv-ok { color: #08090c; background: var(--ok); }
  .rv-bad { color: #fff; background: var(--err); }
  .orch-tag { padding: 0 6px; border-radius: 4px; background: rgba(86,211,100,.25); color: var(--ok); font-weight: 600; }
  .orch-tag-warn { background: rgba(255,166,87,.25); color: var(--warn); }
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 24px 0;
    min-height: 0;
  }
  .msg-wrap {
    max-width: 780px;
    margin: 0 auto;
    padding: 0 22px;
  }
</style>
