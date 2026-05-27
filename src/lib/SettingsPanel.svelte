<script lang="ts">
  import type { Settings, SettingsTab } from './settings';
  import { tabLabels, DEFAULT_HARNESS_PROMPT_FALLBACK } from './settings';
  import { app } from './state.svelte';
  import FieldControl from './FieldControl.svelte';
  import Input from './design-system/primitives/Input.svelte';
  import Select from './design-system/primitives/Select.svelte';
  import { modalFade } from './design-system/motion';

  const models = $derived(app.models);
  const mcpServers = $derived(app.mcpServers);
  const harnessDefault = $derived(app.harnessDefaultText || DEFAULT_HARNESS_PROMPT_FALLBACK);
  const harnessVersion = $derived(app.harnessVersion || 'fallback');

  interface Props {
    settings: Settings;
    onClose?: () => void;
    onUpdate?: (patch: Partial<Settings>) => void;
    onApply?: () => void;
  }

  let { settings, onClose, onUpdate, onApply }: Props = $props();

  let tab = $state<SettingsTab>('model');

  const tabs: SettingsTab[] = [
    'model',
    'permissions',
    'session',
    'system-prompt',
    'tools',
    'mcp',
    'agents',
    'limits',
    'advanced',
  ];

  function update<K extends keyof Settings>(key: K, val: Settings[K]) {
    onUpdate?.({ [key]: val } as Partial<Settings>);
  }

  function onOverlayKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose?.();
  }
</script>

<svelte:window onkeydown={onOverlayKey} />

<div
  class="modal-overlay"
  role="dialog"
  aria-modal="true"
  aria-label="Settings"
  transition:modalFade
  onclick={(e) => {
    if (e.target === e.currentTarget) onClose?.();
  }}
  onkeydown={(e) => e.key === 'Escape' && onClose?.()}
  tabindex="-1"
>
  <div class="modal">
    <aside class="modal-side">
      <h3>Settings</h3>
      {#each tabs as t (t)}
        <button class="modal-tab" class:on={tab === t} onclick={() => (tab = t)}>
          <span class="ic">{tabLabels[t].icon}</span>
          {tabLabels[t].label}
        </button>
      {/each}
    </aside>

    <section class="modal-main">
      <div class="modal-head">
        <div>
          <h2>{tabLabels[tab].label}</h2>
          <div class="sub">
            {#if tab === 'model'}Pick the model and provider for this session.{/if}
            {#if tab === 'permissions'}Control which tools require approval.{/if}
            {#if tab === 'session'}Working directory, history, naming.{/if}
            {#if tab === 'system-prompt'}Override the agent's system prompt.{/if}
            {#if tab === 'tools'}Enable or disable individual tools.{/if}
            {#if tab === 'mcp'}Manage MCP servers and tool exposure.{/if}
            {#if tab === 'agents'}Configure available agents.{/if}
            {#if tab === 'limits'}Budgets, context window, premium quota.{/if}
            {#if tab === 'advanced'}Logging, telemetry, experiments.{/if}
          </div>
        </div>
        <div class="modal-actions">
          {#if onApply}
            <button class="apply-btn" onclick={() => onApply?.()}>Apply &amp; restart</button>
          {/if}
          <button class="modal-close" onclick={() => onClose?.()} aria-label="Close">✕</button>
        </div>
      </div>

      <div class="modal-body">
        {#if tab === 'model'}
          <FieldControl label="Active model (click to apply live via /model)">
            <div class="model-grid">
              {#each models as m (m.id)}
                <button
                  class="model-card"
                  class:on={settings.modelId === m.id}
                  onclick={() => update('modelId', m.id)}
                  aria-pressed={settings.modelId === m.id}
                >
                  <div class="row">
                    <span class="nm">{m.name}</span>
                    <span class="mult x{m.premiumMultiplier}">{m.premiumMultiplier}×</span>
                  </div>
                  <div class="desc">{m.provider} · {(m.contextWindow / 1000).toFixed(0)}k ctx</div>
                </button>
              {/each}
              {#if models.length === 0}
                <div class="empty">waiting for sidecar environment event…</div>
              {/if}
            </div>
          </FieldControl>

          <FieldControl
            label="Reasoning effort"
            hint="Higher = more deliberate, more premium requests."
          >
            <div class="seg-row">
              {#each ['low', 'medium', 'high'] as level (level)}
                <button
                  class="seg-btn"
                  class:on={settings.reasoningEffort === level}
                  onclick={() => update('reasoningEffort', level as Settings['reasoningEffort'])}
                >
                  {level}
                </button>
              {/each}
            </div>
          </FieldControl>

          <FieldControl
            label="Custom provider (BYOK)"
            hint="BYOK overrides hosted models. Tokens billed to your provider."
          >
            <div class="kv-grid">
              <Input value="COPILOT_PROVIDER_BASE_URL" disabled mono />
              <Input bind:value={settings.byokBaseUrl} placeholder="https://api.anthropic.com/v1" />
              <Input value="COPILOT_PROVIDER_API_KEY" disabled mono />
              <Input bind:value={settings.byokApiKey} type="password" placeholder="sk-…" />
              <Input value="COPILOT_PROVIDER_MODEL" disabled mono />
              <Input bind:value={settings.byokModel} placeholder="claude-sonnet-4-5-20250929" />
            </div>
          </FieldControl>

          <FieldControl label="Output format">
            <Select
              value={settings.outputFormat}
              options={[
                { value: 'streaming', label: 'streaming' },
                { value: 'streaming · structured', label: 'streaming · structured' },
                { value: 'final', label: 'final' },
              ]}
            />
          </FieldControl>
        {:else if tab === 'permissions'}
          <FieldControl label="Default permission mode">
            <div class="seg-row">
              {#each ['ask', 'allow-once', 'allow-session'] as m (m)}
                <button
                  class="seg-btn"
                  class:on={settings.permissionMode === m}
                  onclick={() => update('permissionMode', m as Settings['permissionMode'])}
                >
                  {m}
                </button>
              {/each}
            </div>
          </FieldControl>
          <FieldControl label="Premium-only models">
            <label class="toggle">
              <input
                type="checkbox"
                checked={settings.premiumOnly}
                onchange={(e) => update('premiumOnly', (e.target as HTMLInputElement).checked)}
              />
              Block requests that would exceed monthly premium quota
            </label>
          </FieldControl>
        {:else if tab === 'session'}
          <FieldControl label="Working directory">
            <Input bind:value={settings.cwd} />
          </FieldControl>
        {:else if tab === 'system-prompt'}
          <FieldControl label="Master Orchestrator Harness · injected as first message of every session">
            <textarea
              class="ta"
              bind:value={settings.systemPrompt}
              placeholder={harnessDefault}
              rows="20"
              spellcheck="false"
            ></textarea>
          </FieldControl>
          <FieldControl label="Harness enabled (wrap every user prompt with orchestration meta-instructions)">
            <label class="toggle">
              <input
                type="checkbox"
                checked={settings.harnessEnabled}
                onchange={(e) => update('harnessEnabled', (e.target as HTMLInputElement).checked)}
              />
              Wrap user prompts with the 5-phase orchestrator loop (Architect → Dispatch → Gather → 3-Reviewer Consensus → Decide)
            </label>
          </FieldControl>
          <FieldControl label="Restore default harness">
            <button
              type="button"
              onclick={() => update('systemPrompt', harnessDefault)}
              style="background:var(--bg-3);color:var(--fg-2);border:1px solid var(--line);padding:6px 12px;border-radius:8px;font-family:inherit;font-size:12px;cursor:pointer"
            >Reset to canonical harness (v{harnessVersion})</button>
          </FieldControl>
        {:else if tab === 'tools'}
          <FieldControl label="Enabled tools">
            <div class="tool-list">
              {#each Object.entries(settings.toolsEnabled) as [name, on] (name)}
                <label class="toggle">
                  <input
                    type="checkbox"
                    checked={on}
                    onchange={(e) =>
                      update('toolsEnabled', {
                        ...settings.toolsEnabled,
                        [name]: (e.target as HTMLInputElement).checked,
                      })}
                  />
                  <code>{name}</code>
                </label>
              {/each}
            </div>
          </FieldControl>
        {:else if tab === 'mcp'}
          <FieldControl label="MCP servers">
            <div class="mcp-list">
              {#each mcpServers as s (s.name)}
                <div class="mcp-row">
                  <span class="health"></span>
                  <span class="nm">{s.name}</span>
                  <span class="tools">{s.toolCount} tools</span>
                </div>
              {/each}
            </div>
          </FieldControl>
        {:else if tab === 'agents'}
          <FieldControl label="Available agents">
            <div class="mcp-list">
              <div class="mcp-row">
                <span class="health"></span>
                <span class="nm">General-Purpose</span>
                <span class="tools">default · all skills</span>
              </div>
              <div class="mcp-row">
                <span class="health"></span>
                <span class="nm">Explore</span>
                <span class="tools">read-only · codebase research</span>
              </div>
              <div class="mcp-row">
                <span class="health"></span>
                <span class="nm">Researcher</span>
                <span class="tools">/research · deep GH + web</span>
              </div>
              <div class="mcp-row">
                <span class="health"></span>
                <span class="nm">Rubber-Duck</span>
                <span class="tools">/rubber-duck · critique</span>
              </div>
            </div>
          </FieldControl>
          <FieldControl label="Live slash commands">
            <div class="mcp-list">
              {#each app.availableCommands as s (s.name)}
                <div class="mcp-row">
                  <code>/{s.name}</code>
                  <span class="tools">{s.description ?? ''}</span>
                </div>
              {/each}
              {#if app.availableCommands.length === 0}
                <div class="mcp-row"><span class="tools">no session yet — start one to populate</span></div>
              {/if}
            </div>
          </FieldControl>
        {:else if tab === 'limits'}
          <FieldControl label="Monthly premium budget">
            <Input
              type="number"
              value={String(settings.premiumBudget)}
            />
          </FieldControl>
          <FieldControl label="Context window cap">
            <Input
              type="number"
              value={String(settings.contextMax)}
            />
          </FieldControl>
        {:else if tab === 'advanced'}
          <FieldControl label="Logging">
            <label class="toggle">
              <input type="checkbox" /> Verbose ACP transcripts
            </label>
          </FieldControl>
          <FieldControl label="Telemetry">
            <label class="toggle">
              <input type="checkbox" /> Anonymous usage stats
            </label>
          </FieldControl>
        {/if}
      </div>
    </section>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(4, 5, 8, 0.65);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .modal {
    width: 920px;
    max-width: 92vw;
    height: 640px;
    max-height: 88vh;
    background: linear-gradient(180deg, var(--bg-2), var(--bg-1));
    border: 1px solid var(--line-2);
    border-radius: var(--r-xl);
    box-shadow: var(--sh-3), 0 0 0 1px rgba(124, 92, 255, 0.1);
    display: flex;
    overflow: hidden;
    position: relative;
  }
  .modal::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--aurora-1), var(--aurora-3), transparent);
    opacity: 0.6;
  }
  .modal-side {
    width: 200px;
    background: var(--bg-1);
    border-right: 1px solid var(--line);
    padding: 18px 10px;
    display: flex;
    flex-direction: column;
  }
  .modal-side h3 {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--fg-4);
    padding: 0 8px;
    margin-bottom: 8px;
  }
  .modal-tab {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 7px 10px;
    border-radius: var(--r-md);
    font-size: 12.5px;
    color: var(--fg-3);
    cursor: pointer;
    margin: 1px 0;
    background: none;
    border: none;
    text-align: left;
    transition: all var(--motion-hover);
  }
  .modal-tab:hover {
    background: var(--bg-2);
    color: var(--fg-2);
  }
  .modal-tab.on {
    background: linear-gradient(90deg, rgba(124, 92, 255, 0.16), rgba(124, 92, 255, 0.04));
    color: var(--fg);
    position: relative;
  }
  .modal-tab.on::before {
    content: '';
    position: absolute;
    left: -3px;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 14px;
    background: linear-gradient(180deg, var(--aurora-1), var(--aurora-3));
    border-radius: 2px;
    box-shadow: 0 0 8px var(--aurora-1);
  }
  .modal-tab .ic {
    width: 14px;
    text-align: center;
    color: var(--fg-4);
    font-family: var(--mono);
    font-size: 10px;
  }
  .modal-tab.on .ic {
    color: var(--aurora-3);
  }
  .modal-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .modal-head {
    padding: 18px 24px;
    border-bottom: 1px solid var(--line);
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .modal-head h2 {
    font-size: 16px;
    font-weight: 600;
    color: var(--fg);
  }
  .modal-head .sub {
    font-size: 12px;
    color: var(--fg-4);
    margin-top: 2px;
  }
  .modal-actions {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .apply-btn {
    background: linear-gradient(135deg, #7c5cff, #5b8cff 60%, #4ad8c7);
    color: #08090c;
    border: 0;
    padding: 7px 14px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 12.5px;
    cursor: pointer;
    box-shadow: 0 0 20px rgba(124, 92, 255, 0.3);
  }
  .apply-btn:hover { transform: translateY(-1px); }
  .modal-close {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    color: var(--fg-3);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    cursor: pointer;
  }
  .modal-close:hover {
    background: var(--bg-3);
    color: var(--fg);
  }
  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
  }

  .model-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .model-card {
    text-align: left;
    padding: 12px;
    border: 1px solid var(--line-2);
    border-radius: var(--r-md);
    background: var(--bg-1);
    cursor: pointer;
    transition: all var(--motion-toggle);
    color: var(--fg);
  }
  .model-card.on {
    border-color: var(--accent);
    background: linear-gradient(180deg, rgba(124, 92, 255, 0.08), rgba(124, 92, 255, 0.02));
    box-shadow: 0 0 0 1px var(--accent-line);
  }
  .model-card:hover {
    border-color: var(--line-3);
  }
  .model-card .row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }
  .model-card .nm {
    font-weight: 600;
    color: var(--fg);
    font-size: 12.5px;
  }
  .model-card .mult {
    margin-left: auto;
    font-family: var(--mono);
    font-size: 10px;
    padding: 1px 5px;
    border-radius: 3px;
    background: var(--bg-3);
    color: var(--fg-3);
  }
  .model-card .mult.x1 {
    background: rgba(74, 216, 199, 0.15);
    color: var(--aurora-3);
  }
  .model-card .mult.x2 {
    background: rgba(255, 180, 84, 0.15);
    color: var(--warn);
  }
  .model-card .desc {
    font-size: 11px;
    color: var(--fg-4);
  }
  .kv-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .seg-row {
    display: inline-flex;
    background: var(--bg-2);
    border: 1px solid var(--line-2);
    border-radius: var(--r-md);
    padding: 2px;
    font-size: 11.5px;
  }
  .seg-btn {
    padding: 5px 12px;
    border-radius: 5px;
    color: var(--fg-3);
    background: none;
    border: none;
    cursor: pointer;
    text-transform: capitalize;
    transition: all var(--motion-toggle);
  }
  .seg-btn.on {
    background: linear-gradient(180deg, var(--aurora-1), #5e44e8);
    color: #fff;
  }
  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 12.5px;
    color: var(--fg-2);
    cursor: pointer;
  }
  .toggle input {
    accent-color: var(--aurora-1);
  }
  .ta {
    width: 100%;
    background: var(--bg-1);
    border: 1px solid var(--line-2);
    border-radius: var(--r-md);
    color: var(--fg);
    font-family: var(--mono);
    font-size: 12px;
    padding: 10px 12px;
    resize: vertical;
    min-height: 160px;
    outline: none;
  }
  .ta:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  .tool-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .mcp-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .mcp-row {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--bg-2);
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    padding: 10px 12px;
  }
  .mcp-row .health {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--aurora-3);
    box-shadow: 0 0 6px var(--aurora-3);
  }
  .mcp-row .nm {
    font-size: 12px;
    color: var(--fg);
    font-weight: 500;
  }
  .mcp-row .tools {
    font-size: 10.5px;
    color: var(--fg-4);
    font-family: var(--mono);
    margin-left: auto;
  }
  .mcp-row code {
    font-family: var(--mono);
    color: var(--aurora-3);
    font-size: 12px;
    width: 80px;
  }
</style>
