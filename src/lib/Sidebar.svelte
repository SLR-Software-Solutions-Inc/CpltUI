<script lang="ts">
  import type { RepoGroup, Session } from './types';
  import { app } from './state.svelte';

  interface Props {
    groups: RepoGroup[];
    activeSessionId?: string | null;
    onSelect?: (s: Session) => void;
    onNewSession?: () => void;
    onResume?: (id: string, cwd: string) => void;
  }

  let {
    groups,
    activeSessionId = null,
    onSelect,
    onNewSession,
    onResume,
  }: Props = $props();

  function relTime(iso: string): string {
    const d = Date.now() - Date.parse(iso);
    if (!Number.isFinite(d) || d < 0) return iso;
    if (d < 60_000) return 'just now';
    if (d < 3_600_000) return Math.floor(d / 60_000) + 'm';
    if (d < 86_400_000) return Math.floor(d / 3_600_000) + 'h';
    if (d < 7 * 86_400_000) return Math.floor(d / 86_400_000) + 'd';
    return new Date(iso).toLocaleDateString();
  }

  const totalSessions = $derived(groups.reduce((n, g) => n + g.sessions.length, 0));
</script>

<aside class="sidebar">
  <div class="sb-head">
    <div class="brand">
      <div class="brand-mark"></div>
      <span>CpltUI</span>
      <small>v0.1</small>
    </div>
  </div>

  <button class="sb-new" onclick={() => onNewSession?.()} aria-label="New session">
    <span class="plus">+</span>
    <span>New session</span>
    <span class="kbd">⌘N</span>
  </button>

  <div class="sb-section">
    <span>Sessions</span>
    <span class="count">{totalSessions}</span>
  </div>

  <div class="sb-list">
    {#each groups as group (group.name)}
      <div class="repo-group">
        <div class="repo-head">
          <span class="repo-dot"></span>
          <span class="repo-name">{group.name}</span>
          <span class="branch">{group.branch}</span>
          <span class="chev">▾</span>
        </div>
        {#each group.sessions as session (session.id)}
          {@const isActive = session.id === activeSessionId || (!!session.active && !activeSessionId)}
          <button
            class="session"
            class:active={isActive}
            onclick={() => onSelect?.(session)}
            aria-current={isActive ? 'true' : undefined}
          >
            <span class="session-title">
              <span class="session-status s-{session.status}"></span>
              <span class="truncate">{session.title}</span>
            </span>
            <span class="session-meta">
              <span>#{session.meta?.split(' · ')[0] ?? ''}</span>
              <span class="dot"></span>
              <span>{session.meta?.split(' · ').slice(1).join(' · ') ?? ''}</span>
            </span>
          </button>
        {/each}
      </div>
    {/each}
  </div>

  {#if app.sessionHistory.length > 0}
    <div class="sb-section">
      <span>History</span>
      <span class="count">{app.sessionHistory.length}</span>
    </div>
    <div class="sb-list">
      {#each app.sessionHistory.slice(0, 12) as h (h.id)}
        <button class="session" onclick={() => onResume?.(h.id, h.cwd)} title={h.cwd}>
          <span class="session-title">
            <span class="session-status s-idle"></span>
            <span class="truncate">{h.summary}</span>
          </span>
          <span class="session-meta">
            <span>{h.cwd.split('/').filter(Boolean).pop() ?? '—'}</span>
            <span class="dot"></span>
            <span>{relTime(h.updatedAt)}</span>
          </span>
        </button>
      {/each}
    </div>
  {/if}

  <div class="sb-foot">
    <div class="env-row">
      <span class="env-lbl">copilot</span>
      <span class="env-val">{app.copilotVersion || '—'}</span>
    </div>
    <div class="env-row">
      <span class="env-lbl">conn</span>
      <span class="env-val conn-{app.connectionState}">{app.connectionState}</span>
    </div>
    {#if app.copilotHome}
      <div class="env-row" title={app.copilotHome}>
        <span class="env-lbl">home</span>
        <span class="env-val truncate">{app.copilotHome.replace('/Users/narender', '~')}</span>
      </div>
    {/if}
  </div>
</aside>

<style>
  .sidebar {
    background: rgba(12, 14, 19, 0.5);
    border-right: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    height: 100%;
  }
  .sb-head {
    padding: 16px 14px 10px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 13px;
    letter-spacing: -0.2px;
  }
  .brand-mark {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    background: linear-gradient(135deg, var(--aurora-1) 0%, var(--aurora-2) 50%, var(--aurora-3) 100%);
    position: relative;
    box-shadow: 0 0 18px rgba(124, 92, 255, 0.4);
  }
  .brand-mark::after {
    content: '';
    position: absolute;
    inset: 4px;
    border-radius: 3px;
    background: var(--bg-0);
    opacity: 0.5;
  }
  .brand small {
    color: var(--fg-4);
    font-weight: 400;
    font-size: 11px;
    font-family: var(--mono);
  }
  .sb-new {
    margin: 8px 14px 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: linear-gradient(180deg, rgba(124, 92, 255, 0.12), rgba(124, 92, 255, 0.04));
    border: 1px solid var(--accent-line);
    border-radius: var(--r-md);
    color: var(--fg);
    font-weight: 500;
    transition: all var(--motion-toggle);
  }
  .sb-new:hover {
    background: linear-gradient(180deg, rgba(124, 92, 255, 0.2), rgba(124, 92, 255, 0.08));
    box-shadow: var(--glow);
  }
  .plus {
    width: 14px;
    height: 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.06);
    font-size: 14px;
    line-height: 1;
  }
  .kbd {
    margin-left: auto;
    font-family: var(--mono);
    font-size: 10px;
    color: var(--fg-3);
    border: 1px solid var(--line-2);
    padding: 1px 5px;
    border-radius: 3px;
  }
  .sb-section {
    padding: 14px 14px 6px;
    font-size: 10.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.7px;
    color: var(--fg-4);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .sb-section .count {
    margin-left: auto;
    font-weight: 500;
    color: var(--fg-4);
    background: var(--bg-2);
    padding: 1px 6px;
    border-radius: var(--r-pill);
    font-size: 10px;
    letter-spacing: 0;
    text-transform: none;
  }
  .sb-list {
    flex: 1;
    overflow-y: auto;
    padding: 0 8px 8px;
  }
  .repo-group {
    margin-bottom: 6px;
  }
  .repo-head {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    font-size: 11px;
    color: var(--fg-3);
    font-weight: 500;
  }
  .repo-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--aurora-3);
    box-shadow: 0 0 8px rgba(74, 216, 199, 0.6);
  }
  .branch {
    color: var(--fg-4);
    font-family: var(--mono);
    font-size: 10.5px;
  }
  .repo-head .chev {
    margin-left: auto;
    color: var(--fg-4);
    font-size: 10px;
  }
  .session {
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 8px 10px 8px 22px;
    border-radius: var(--r-md);
    cursor: pointer;
    position: relative;
    margin: 1px 0;
    transition: background var(--motion-hover);
    color: var(--fg);
    font-family: inherit;
  }
  .session:hover {
    background: var(--bg-2);
  }
  .session.active {
    background: linear-gradient(90deg, rgba(124, 92, 255, 0.14), rgba(124, 92, 255, 0.03));
  }
  .session.active::before {
    content: '';
    position: absolute;
    left: 8px;
    top: 10px;
    bottom: 10px;
    width: 2px;
    border-radius: 2px;
    background: linear-gradient(180deg, var(--aurora-1), var(--aurora-3));
    box-shadow: 0 0 10px var(--aurora-1);
  }
  .session-title {
    font-size: 12.5px;
    color: var(--fg);
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .truncate {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
    flex: 1;
  }
  .session-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 10.5px;
    color: var(--fg-4);
    font-family: var(--mono);
  }
  .session-meta .dot {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: currentColor;
  }
  .session-status {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .s-running {
    background: var(--aurora-3);
    box-shadow: 0 0 6px var(--aurora-3);
    animation: pulse 1.8s ease-in-out infinite;
  }
  .s-awaiting {
    background: var(--warn);
    box-shadow: 0 0 6px var(--warn);
  }
  .s-idle {
    background: var(--fg-4);
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
  .sb-foot {
    border-top: 1px solid var(--line);
    padding: 10px 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-family: var(--mono);
    font-size: 11px;
  }
  .env-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    color: var(--fg-3);
  }
  .env-lbl { color: var(--fg-4); text-transform: uppercase; letter-spacing: .5px; font-size: 9.5px; }
  .env-val { color: var(--fg-2); text-align: right; max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .conn-connected { color: var(--ok); }
  .conn-connecting { color: var(--warn); }
  .conn-disconnected { color: var(--err); }
  .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
