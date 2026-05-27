<script lang="ts">
  import { sendToSidecar } from './ipc';

  interface Props {
    open: boolean;
    methods?: Array<{ id: string; name?: string }>;
    hint?: string;
    verificationUri?: string;
    userCode?: string;
    onAuthenticate?: () => void;
    onDismiss?: () => void;
  }

  let { open, methods = [], hint, verificationUri, userCode, onAuthenticate, onDismiss }: Props = $props();

  async function copyCode() {
    if (!userCode) return;
    try {
      await navigator.clipboard.writeText(userCode);
    } catch {
      /* ignore */
    }
  }

  function openVerify() {
    if (verificationUri) window.open(verificationUri, '_blank');
  }

  let busy = $state(false);
  let lastError = $state<string | null>(null);

  async function start() {
    busy = true;
    lastError = null;
    try {
      await sendToSidecar({ type: 'authenticate', methodId: methods[0]?.id });
      onAuthenticate?.();
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }
</script>

{#if open}
  <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="ob-title">
    <div class="aurora-bg"></div>
    <div class="panel">
      <div class="mark">
        <div class="mark-inner"></div>
      </div>
      <div id="ob-title" class="title">Sign in to GitHub Copilot</div>
      <div class="sub">
        CpltUI uses your <code>copilot</code> CLI authentication.
        Your token never enters this app — the CLI owns it.
      </div>

      {#if verificationUri || userCode}
        <div class="device">
          <div class="device-h">Device code flow</div>
          {#if userCode}
            <div class="code-row">
              <span class="code">{userCode}</span>
              <button class="copy" onclick={copyCode} aria-label="Copy code">Copy</button>
            </div>
          {/if}
          {#if verificationUri}
            <div class="uri-row">
              <span class="uri-label">Visit</span>
              <a href={verificationUri} onclick={(e) => { e.preventDefault(); openVerify(); }}>{verificationUri}</a>
            </div>
          {/if}
        </div>
      {:else if hint}
        <div class="hint">{hint}</div>
      {/if}

      {#if methods.length > 0}
        <ul class="methods">
          {#each methods as m}
            <li><span class="pill">{m.name ?? m.id}</span></li>
          {/each}
        </ul>
      {/if}

      <div class="actions">
        <button class="primary" disabled={busy} onclick={start}>
          {busy ? 'Starting auth…' : 'Sign in with GitHub'}
        </button>
        {#if onDismiss}
          <button class="ghost" onclick={() => onDismiss?.()}>Later</button>
        {/if}
      </div>

      {#if lastError}
        <div class="err">{lastError}</div>
      {/if}

      <div class="footnote">
        Or run <code>copilot</code> in any terminal and complete <code>/login</code>,
        then restart CpltUI. Telemetry note: Copilot collects prompts; see
        <code>docs/AUTH.md</code> for BYOK options.
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: grid;
    place-items: center;
    background: rgba(8, 9, 12, 0.74);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    padding: 24px;
  }
  .aurora-bg {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(800px 500px at 18% -10%, rgba(124, 92, 255, 0.22), transparent 60%),
      radial-gradient(700px 460px at 88% 110%, rgba(74, 216, 199, 0.12), transparent 60%);
  }
  .panel {
    position: relative;
    width: min(520px, 100%);
    background: linear-gradient(180deg, #11141b, #0c0e13);
    border: 1px solid #262c39;
    border-radius: 16px;
    padding: 32px 28px 24px;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(124, 92, 255, 0.12);
  }
  .mark {
    width: 44px;
    height: 44px;
    border-radius: 11px;
    background: linear-gradient(135deg, #7c5cff 0%, #5b8cff 50%, #4ad8c7 100%);
    box-shadow: 0 0 28px rgba(124, 92, 255, 0.45);
    margin-bottom: 18px;
    position: relative;
  }
  .mark-inner {
    position: absolute;
    inset: 8px;
    border-radius: 5px;
    background: #0c0e13;
    opacity: 0.55;
  }
  .title {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: #e8ecf3;
  }
  .sub {
    margin-top: 8px;
    color: #b6bdcc;
    font-size: 14px;
    line-height: 1.55;
  }
  .sub code,
  .footnote code {
    background: #161a23;
    padding: 1px 5px;
    border-radius: 4px;
    font-family: 'JetBrains Mono', ui-monospace, Menlo, monospace;
    font-size: 12px;
    color: #4ad8c7;
  }
  .hint {
    margin-top: 14px;
    padding: 10px 12px;
    border: 1px solid #262c39;
    border-radius: 8px;
    background: #11141b;
    color: #b6bdcc;
    font-size: 13px;
  }
  .device {
    margin-top: 16px;
    padding: 14px 16px;
    border: 1px solid rgba(124, 92, 255, 0.4);
    border-radius: 10px;
    background: linear-gradient(180deg, rgba(124,92,255,.08), rgba(74,216,199,.04));
  }
  .device-h {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: #b6bdcc;
    margin-bottom: 10px;
    font-weight: 600;
  }
  .code-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
  }
  .code {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: #4ad8c7;
    flex: 1;
    background: rgba(0,0,0,.35);
    padding: 8px 14px;
    border-radius: 8px;
    border: 1px solid rgba(74,216,199,.3);
    text-align: center;
  }
  .copy {
    background: var(--bg-2, #11141b);
    color: #e8ecf3;
    border: 1px solid #262c39;
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .copy:hover { border-color: rgba(124,92,255,.6); }
  .uri-row { font-size: 12.5px; color: #b6bdcc; }
  .uri-row .uri-label { color: #7d8597; margin-right: 8px; }
  .uri-row a {
    color: #5b8cff;
    text-decoration: none;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 12px;
  }
  .uri-row a:hover { text-decoration: underline; }
  .methods {
    list-style: none;
    margin: 16px 0 4px;
    padding: 0;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .pill {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 999px;
    background: #161a23;
    border: 1px solid #262c39;
    color: #b6bdcc;
    font-size: 12px;
    font-family: 'JetBrains Mono', ui-monospace, Menlo, monospace;
  }
  .actions {
    display: flex;
    gap: 10px;
    margin-top: 22px;
  }
  button {
    border: 0;
    padding: 10px 16px;
    border-radius: 9px;
    font-family: inherit;
    font-weight: 600;
    font-size: 13.5px;
    cursor: pointer;
    transition: transform 120ms ease, box-shadow 200ms ease;
  }
  button.primary {
    background: linear-gradient(135deg, #7c5cff, #5b8cff 60%, #4ad8c7);
    color: #08090c;
    box-shadow: 0 0 24px rgba(124, 92, 255, 0.35);
  }
  button.primary:hover:not(:disabled) {
    transform: translateY(-1px);
  }
  button.primary:disabled {
    opacity: 0.55;
    cursor: progress;
  }
  button.ghost {
    background: transparent;
    color: #b6bdcc;
    border: 1px solid #262c39;
  }
  button.ghost:hover {
    color: #e8ecf3;
    border-color: #3a4252;
  }
  .err {
    margin-top: 14px;
    color: #ff7b72;
    font-size: 13px;
  }
  .footnote {
    margin-top: 18px;
    color: #7d8597;
    font-size: 12px;
    line-height: 1.55;
    border-top: 1px dashed #262c39;
    padding-top: 14px;
  }
</style>
