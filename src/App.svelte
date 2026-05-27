<script lang="ts">
  import { onMount } from 'svelte';
  import type { UnlistenFn } from '@tauri-apps/api/event';

  import Sidebar from './lib/Sidebar.svelte';
  import ChatPane from './lib/ChatPane.svelte';
  import SettingsPanel from './lib/SettingsPanel.svelte';
  import Onboarding from './lib/Onboarding.svelte';
  import CommandPalette from './lib/CommandPalette.svelte';
  import FileTree from './lib/FileTree.svelte';
  import EditorPane from './lib/EditorPane.svelte';
  import type { PaletteAction } from './lib/types';

  import { loadSettings, saveSettings, type Settings } from './lib/settings';
  import { formatTokens, pct } from './lib/format';
  import { sendToSidecar, onSidecarEvent, type SidecarEvt } from './lib/ipc';
  import { app, dispatchSidecarEvent } from './lib/state.svelte';

  // ── Local UI-only state ────────────────────────────────────────────────
  let settings = $state<Settings>(loadSettings());
  $effect(() => {
    saveSettings(settings);
  });
  let showSettings = $state(false);
  let railTab = $state<'context' | 'files' | 'slash' | 'mcp'>('context');
  let composerPlan = $state<boolean>(false);
  let paletteOpen = $state(false);
  let editorPath = $state<string | null>(null);

  // Derived from real store
  const currentSession = $derived(app.current);
  const messages = $derived(currentSession?.messages ?? []);
  const hud = $derived(
    currentSession?.hud ?? {
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      premiumReqs: 0,
      modelMultiplier: 1,
      contextUsed: 0,
      contextMax: 200_000,
    },
  );
  const liveSlash = $derived(
    app.availableCommands.map((c) => ({ cmd: '/' + c.name, desc: c.description ?? '' })),
  );
  const activeModel = $derived(
    app.models.find((m) => m.id === settings.modelId)?.name ?? (currentSession?.model ?? 'default'),
  );
  const currentAgentsMd = $derived(
    currentSession ? app.agentsMdBySession.get(currentSession.id) ?? [] : [],
  );
  const contextPct = $derived(pct(hud.contextUsed, hud.contextMax));

  // Build sidebar groups from real sessions; group by cwd basename.
  const sessionGroups = $derived.by(() => {
    const groups = new Map<string, { name: string; branch: string; sessions: Array<{ id: string; title: string; status: 'running' | 'idle'; repo: string; branch: string; meta: string }> }>();
    for (const s of app.sessions) {
      const repoName = s.cwd.split('/').filter(Boolean).pop() ?? 'workspace';
      if (!groups.has(repoName)) {
        groups.set(repoName, { name: repoName, branch: 'main', sessions: [] });
      }
      groups.get(repoName)!.sessions.push({
        id: s.id,
        title: s.messages.find((m) => m.kind === 'user' && m.text)?.text?.slice(0, 60) ?? 'New session',
        status: s.status === 'streaming' ? 'running' : 'idle',
        repo: repoName,
        branch: 'main',
        meta: `${s.messages.length} msgs · ${s.model ?? 'default'}`,
      });
    }
    return [...groups.values()];
  });

  // ── Tauri IPC ──────────────────────────────────────────────────────────
  let unlisten: UnlistenFn | null = null;

  onMount(() => {
    (async () => {
      try {
        unlisten = await onSidecarEvent(dispatchSidecarEvent);
        app.connectionState = 'connected';
        await sendToSidecar({ type: 'ping' });
      } catch {
        app.connectionState = 'disconnected';
        app.authState = 'ready';
      }
    })();
    return () => unlisten?.();
  });

  // ── Actions ────────────────────────────────────────────────────────────
  async function startSession(): Promise<void> {
    try {
      await sendToSidecar({
        type: 'session_new',
        cwd: settings.cwd,
        model: settings.modelId,
        allowAllTools: settings.permissionMode === 'allow-session',
        systemPrompt: settings.systemPrompt,
        harnessEnabled: settings.harnessEnabled,
      });
    } catch (e) {
      console.error('session_new failed', e);
    }
  }

  async function sendPrompt(
    text: string,
    fileChips: Array<{ path: string; rel: string; name: string }> = [],
  ): Promise<void> {
    if (!text.trim() && fileChips.length === 0) return;
    if (!app.currentSessionId) {
      await startSession();
      await new Promise((r) => setTimeout(r, 100));
    }
    const sid = app.currentSessionId;
    if (!sid) {
      console.warn('no session after start_session');
      return;
    }
    const visibleText =
      fileChips.length > 0
        ? `${text}${text ? '\n\n' : ''}Attached files:\n${fileChips.map((c) => `- ${c.rel || c.name}`).join('\n')}`
        : text;
    app.appendUserMessage(sid, visibleText);
    const content: Array<Record<string, unknown>> = [];
    if (text) content.push({ type: 'text', text });
    for (const c of fileChips) {
      content.push({
        type: 'resource_link',
        uri: c.path.startsWith('file://') ? c.path : `file://${c.path}`,
        name: c.name,
        mimeType: 'text/plain',
      });
    }
    if (content.length === 0) content.push({ type: 'text', text: visibleText });
    try {
      await sendToSidecar({
        type: 'session_prompt',
        sessionId: sid,
        content: content as Array<{ type: 'text'; text: string } | { type: 'image'; mimeType: string; data: string }>,
      });
    } catch (e) {
      app.setError('send_failed', e instanceof Error ? e.message : String(e));
    }
  }

  async function cancelTurn(): Promise<void> {
    if (app.currentSessionId) {
      await sendToSidecar({ type: 'session_cancel', sessionId: app.currentSessionId });
    }
  }

  async function respondPermission(optionId: string): Promise<void> {
    const p = app.pendingPermission;
    if (!p) return;
    await sendToSidecar({
      type: 'permission_response',
      requestId: p.requestId,
      optionId,
    });
    app.setPermissionRequest(null);
  }

  async function applySettings(): Promise<void> {
    showSettings = false;
    if (app.currentSessionId) {
      await sendToSidecar({ type: 'end_session', sessionId: app.currentSessionId });
    }
    await startSession();
  }

  function selectSession(id: string): void {
    app.setCurrent(id);
  }

  function updateSettings(patch: Partial<Settings>): void {
    settings = { ...settings, ...patch };
    // live model switch — also update the current session in store for immediate UI feedback
    if (patch.modelId) {
      if (app.currentSessionId && app.current) {
        app.current.model = patch.modelId;
        void sendToSidecar({
          type: 'set_model',
          sessionId: app.currentSessionId,
          model: patch.modelId,
        });
      }
    }
  }

  const paletteActions = $derived<PaletteAction[]>([
    { id: 'new-session', title: 'New session', section: 'session', kbd: '⌘N', run: () => void startSession() },
    { id: 'settings', title: 'Open settings', section: 'app', kbd: '⌘,', run: () => (showSettings = true) },
    {
      id: 'cancel', title: 'Cancel current turn', section: 'session', kbd: '⌘.',
      run: () => void cancelTurn(),
    },
    { id: 'toggle-plan', title: `Plan mode: ${composerPlan ? 'on → off' : 'off → on'}`, section: 'session', kbd: '⇧⇥', run: () => (composerPlan = !composerPlan) },
    { id: 'refresh-history', title: 'Refresh session history', section: 'app', run: () => void sendToSidecar({ type: 'refresh_history' }) },
    { id: 'reset-harness', title: 'Restore default harness', section: 'app', run: () => updateSettings({ systemPrompt: app.harnessDefaultText }) },
  ]);

  // Keyboard
  function onKeydown(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key === ',') {
      e.preventDefault();
      showSettings = !showSettings;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      paletteOpen = !paletteOpen;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
      e.preventDefault();
      void startSession();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === '.') {
      e.preventDefault();
      void cancelTurn();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<CommandPalette
  bind:open={paletteOpen}
  actions={paletteActions}
  onClose={() => (paletteOpen = false)}
/>

<Onboarding
  open={app.authState === 'required'}
  methods={app.authMethods}
  hint={app.authHint}
  verificationUri={app.authVerificationUri}
  userCode={app.authUserCode}
  onAuthenticate={() => (app.authState = 'checking')}
  onDismiss={() => app.setAuthReady()}
/>

{#if app.pendingPermission}
  <div class="perm-overlay" role="dialog" aria-modal="true">
    <div class="perm-card">
      <div class="perm-title">{app.pendingPermission.title}</div>
      <div class="perm-actions">
        {#each app.pendingPermission.options as opt (opt.optionId)}
          <button class="perm-btn perm-{opt.kind}" onclick={() => respondPermission(opt.optionId)}>
            {opt.name ?? opt.optionId}
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}

{#if app.lastError}
  <div class="err-toast" role="status" onclick={() => (app.lastError = null)}>
    <strong>{app.lastError.code}</strong> {app.lastError.message}
  </div>
{/if}

<div class="app" class:editor-open={editorPath}>
  <Sidebar
    groups={sessionGroups}
    activeSessionId={app.currentSessionId}
    onSelect={(s) => selectSession(s.id)}
    onNewSession={startSession}
    onResume={(id, cwd) => {
      void sendToSidecar({ type: 'session_resume', sessionId: id, cwd, model: settings.modelId });
    }}
  />

  {#if editorPath}
    <EditorPane path={editorPath} onClose={() => (editorPath = null)} />
  {/if}

  <ChatPane
    messages={messages as never[]}
    {hud}
    slashCommands={liveSlash}
    repo={currentSession?.cwd.split('/').filter(Boolean).pop() ?? 'no session'}
    branch={'main'}
    cwd={currentSession?.cwd ?? ''}
    model={activeModel}
    agent={currentSession?.agent ?? 'General-Purpose'}
    bind:planMode={composerPlan}
    onSend={(t, chips) => sendPrompt(t, chips as Array<{ path: string; rel: string; name: string }>)}
    onStop={() => void cancelTurn()}
    onOpenSettings={() => (showSettings = true)}
    onPickModel={(id) => updateSettings({ modelId: id })}
  />

  <aside class="rail">
    <div class="rail-tabs" role="tablist">
      {#each ['context', 'files', 'slash', 'mcp'] as t (t)}
        <button
          class="rail-tab"
          class:on={railTab === t}
          onclick={() => (railTab = t as typeof railTab)}
          role="tab"
          aria-selected={railTab === t}
        >
          {t === 'context' ? 'Context' : t === 'files' ? 'Files' : t === 'slash' ? 'Slash' : 'MCP'}
        </button>
      {/each}
    </div>

    <div class="rail-body">
      {#if railTab === 'context'}
        <div class="rail-h">Token usage · this turn</div>
        <div class="token-block">
          <div class="token-row">
            <span class="lbl">Context window</span>
            <span class="v">{formatTokens(hud.contextUsed)} / {formatTokens(hud.contextMax)}</span>
          </div>
          <div class="token-meter">
            <div class="fl" style:width="{contextPct}%"></div>
          </div>
          <div class="token-sub">
            <span>↑ {formatTokens(hud.inputTokens)} input</span>
            <span>↓ {formatTokens(hud.outputTokens)} output</span>
          </div>
        </div>

        <div class="rail-h">AGENTS.md chain <span class="live">[live]</span></div>
        {#if currentAgentsMd.length === 0}
          <div class="empty-row">no AGENTS.md in chain</div>
        {:else}
          {#each currentAgentsMd as a (a.path)}
            <div class="mcp-card">
              <span class="health"></span>
              <span class="nm" title={a.path}>{a.path.replace('/Users/narender', '~')}</span>
              <span class="tools">{(a.bytes / 1024).toFixed(1)} KB</span>
            </div>
          {/each}
        {/if}

        <div class="rail-h">Premium requests</div>
        <div class="prem-real">
          <div class="prem-row">
            <span class="prem-lbl">session</span>
            <span class="prem-val">{hud.premiumReqs}</span>
          </div>
          <div class="prem-hint">
            Real quota is tracked by Copilot — open <code>/usage</code> in the chat to see monthly totals.
          </div>
        </div>
      {:else if railTab === 'files'}
        <FileTree
          cwd={currentSession?.cwd ?? ''}
          onPick={(f) => {
            // Click opens in EditorPane; shift-click would chip instead (TODO)
            editorPath = f.path;
          }}
        />
      {:else if railTab === 'slash'}
        <div class="rail-h">Slash commands <span class="live">[live · {app.availableCommands.length}]</span></div>
        {#if liveSlash.length === 0}
          <div class="empty-row">waiting for session…</div>
        {:else}
          {#each liveSlash as s (s.cmd)}
            <div class="slash-item">
              <code>{s.cmd}</code>
              <span class="desc">{s.desc}</span>
            </div>
          {/each}
        {/if}
      {:else}
        <div class="rail-h">MCP servers <span class="live">[live]</span></div>
        {#if app.mcpServers.length === 0}
          <div class="empty-row">none configured at {app.copilotHome || '~/.copilot'}/mcp-config.json</div>
        {:else}
          {#each app.mcpServers as s (s.name)}
            <div class="mcp-card">
              <span class="health" class:a-warn={!s.enabled}></span>
              <span class="nm">{s.name}</span>
              <span class="tools">{s.type}</span>
            </div>
          {/each}
        {/if}
      {/if}
    </div>

    <div class="rail-footer">
      <span class="cpv">copilot v{app.copilotVersion || '—'}</span>
      <span class="conn conn-{app.connectionState}">{app.connectionState}</span>
    </div>
  </aside>
</div>

{#if showSettings}
  <SettingsPanel
    {settings}
    onClose={() => (showSettings = false)}
    onUpdate={updateSettings}
    onApply={applySettings}
  />
{/if}

<style>
  .app {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: 280px 1fr 320px;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
  }
  .app.editor-open {
    grid-template-columns: 240px 1fr 460px 320px;
  }

  .rail {
    border-left: 1px solid var(--line);
    background: rgba(12, 14, 19, 0.5);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .rail-tabs {
    display: flex;
    padding: 14px 14px 0;
    gap: 2px;
    border-bottom: 1px solid var(--line);
  }
  .rail-tab {
    padding: 7px 12px;
    font-size: 11.5px;
    color: var(--fg-3);
    border-radius: 6px 6px 0 0;
    font-weight: 500;
    position: relative;
    background: none;
    border: none;
    cursor: pointer;
    transition: color var(--motion-hover);
  }
  .rail-tab.on {
    color: var(--fg);
    background: var(--bg-2);
  }
  .rail-tab.on::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: -1px;
    height: 2px;
    background: linear-gradient(90deg, var(--aurora-1), var(--aurora-3));
    border-radius: 2px;
    box-shadow: 0 0 8px var(--aurora-1);
  }
  .rail-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px 14px;
  }
  .rail-footer {
    padding: 8px 14px;
    border-top: 1px solid var(--line);
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    color: var(--fg-3);
    font-family: var(--mono);
  }
  .conn { padding: 1px 8px; border-radius: 999px; border: 1px solid var(--line); }
  .conn-connected { color: var(--ok); border-color: rgba(86,211,100,.4); }
  .conn-connecting { color: var(--warn); border-color: rgba(255,166,87,.4); }
  .conn-disconnected { color: var(--err); border-color: rgba(255,123,114,.4); }

  .rail-h {
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: .8px;
    color: var(--fg-3);
    margin: 18px 0 8px;
    font-weight: 600;
  }
  .rail-h:first-child { margin-top: 4px; }
  .prem-real {
    background: var(--bg-2);
    border-radius: var(--r-md);
    padding: 10px 12px;
  }
  .prem-row { display: flex; justify-content: space-between; font-size: 12px; color: var(--fg-2); }
  .prem-val { font-family: var(--mono); color: var(--fg); font-size: 18px; }
  .prem-lbl { color: var(--fg-3); align-self: center; }
  .prem-hint {
    margin-top: 8px; font-size: 10.5px; color: var(--fg-4); line-height: 1.5;
  }
  .prem-hint code {
    background: var(--bg-3); padding: 1px 5px; border-radius: 4px;
    font-family: var(--mono); color: var(--aurora-3); font-size: 10.5px;
  }
  .empty-row {
    color: var(--fg-4);
    font-size: 11px;
    font-style: italic;
    padding: 8px 10px;
    background: rgba(38,44,57,.25);
    border-radius: var(--r-sm);
  }
  .live {
    color: var(--ok);
    font-weight: 600;
    text-transform: none;
    letter-spacing: 0;
    font-family: var(--mono);
    font-size: 9.5px;
  }
  .token-block { background: var(--bg-2); border-radius: var(--r-md); padding: 10px 12px; }
  .token-row { display: flex; justify-content: space-between; font-size: 12px; color: var(--fg-2); }
  .token-row .v { font-family: var(--mono); color: var(--fg); }
  .token-meter { height: 4px; background: var(--bg-3); border-radius: 2px; margin: 8px 0; overflow: hidden; }
  .token-meter .fl { height: 100%; background: linear-gradient(90deg, var(--aurora-1), var(--aurora-3)); }
  .token-sub { display: flex; gap: 12px; font-size: 11px; color: var(--fg-3); font-family: var(--mono); }
  .mcp-card {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 10px; background: var(--bg-2); border: 1px solid var(--line);
    border-radius: var(--r-sm); margin-bottom: 6px;
  }
  .mcp-card .health { width: 6px; height: 6px; border-radius: 50%; background: var(--ok); }
  .mcp-card .health.a-warn { background: var(--warn); }
  .mcp-card .health.a-err { background: var(--err); }
  .mcp-card .nm { flex: 1; font-size: 12px; color: var(--fg-2); }
  .mcp-card .tools { font-size: 11px; color: var(--fg-3); font-family: var(--mono); }
  .slash-item {
    display: flex; gap: 8px; padding: 6px 8px; border-radius: var(--r-sm);
    font-size: 12px; color: var(--fg-2); cursor: pointer;
    transition: background var(--motion-hover);
  }
  .slash-item:hover { background: var(--bg-2); }
  .slash-item code { font-family: var(--mono); color: var(--aurora-3); font-size: 12px; width: 100px; flex-shrink: 0; }
  .slash-item .desc { color: var(--fg-4); font-size: 11px; }

  @media (max-width: 1100px) {
    .app { grid-template-columns: 260px 1fr; }
    .rail { display: none; }
  }

  .perm-overlay {
    position: fixed; inset: 0; z-index: 900; display: grid; place-items: center;
    background: rgba(8,9,12,.62); backdrop-filter: blur(8px);
  }
  .perm-card {
    background: linear-gradient(180deg, #11141b, #0c0e13);
    border: 1px solid #262c39; border-radius: 14px; padding: 20px 22px;
    width: min(460px,100%); box-shadow: 0 20px 48px rgba(0,0,0,.5);
  }
  .perm-title { font-size: 15px; font-weight: 600; color: var(--fg); margin-bottom: 14px; }
  .perm-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .perm-btn {
    background: var(--bg-2); border: 1px solid var(--line-2); color: var(--fg-2);
    padding: 8px 12px; border-radius: 8px; font-family: inherit; font-size: 13px;
    font-weight: 500; cursor: pointer; transition: all 120ms ease;
  }
  .perm-btn:hover { color: var(--fg); border-color: var(--aurora-1); }
  .perm-allow_always { background: linear-gradient(135deg, #7c5cff, #4ad8c7); color: #08090c; border: 0; }
  .perm-reject_always { color: #ff7b72; border-color: rgba(255,123,114,.4); }

  .err-toast {
    position: fixed; bottom: 24px; right: 24px; z-index: 950;
    background: rgba(255,123,114,.12); border: 1px solid rgba(255,123,114,.4);
    color: #ffb4ad; padding: 10px 14px; border-radius: 10px;
    font-size: 12px; max-width: 420px; cursor: pointer;
    font-family: var(--mono);
  }
  .err-toast strong { color: #ff7b72; margin-right: 8px; }
</style>
