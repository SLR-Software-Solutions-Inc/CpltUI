<script lang="ts">
  import type { Msg } from './state.svelte';
  import PlanCard from './PlanCard.svelte';
  import CodeBlock from './CodeBlock.svelte';
  import { formatRelative } from './format';
  import { marked } from 'marked';

  marked.setOptions({ gfm: true, breaks: true });

  interface Props {
    message: Msg;
    onPlanAction?: (msgId: string, action: 'approve' | 'edit' | 'cancel') => void;
  }

  let { message, onPlanAction }: Props = $props();

  const isAssistant = $derived(message.kind === 'assistant');
  const isUser = $derived(message.kind === 'user');
  const isTool = $derived(message.kind === 'tool_call');
  const isPlan = $derived(message.kind === 'plan');
  const isSystem = $derived(message.kind === 'system');
  const isFsWrite = $derived(message.kind === 'fs_write');
  const time = $derived(formatRelative(message.createdAt));

  // Split text into prose + code-fence blocks (CodeBlock component handles fences).
  function renderBlocks(text: string): Array<{ type: 'code' | 'md'; lang?: string; body: string }> {
    const parts: Array<{ type: 'code' | 'md'; lang?: string; body: string }> = [];
    const re = /```(\w+)?\n?([\s\S]*?)```/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parts.push({ type: 'md', body: text.slice(last, m.index) });
      parts.push({ type: 'code', lang: m[1] ?? '', body: m[2] ?? '' });
      last = re.lastIndex;
    }
    if (last < text.length) parts.push({ type: 'md', body: text.slice(last) });
    if (parts.length === 0) parts.push({ type: 'md', body: text });
    return parts;
  }

  function md(s: string): string {
    return marked.parse(s, { async: false }) as string;
  }
</script>

<div
  class="msg"
  class:msg-user={isUser}
  class:msg-assistant={isAssistant}
  class:msg-tool={isTool}
  class:msg-plan={isPlan}
  class:msg-system={isSystem}
>
  {#if isUser}
    <div class="msg-avatar avatar-user">U</div>
  {:else if isAssistant}
    <div class="msg-avatar avatar-asst">✦</div>
  {:else if isTool}
    <div class="msg-avatar avatar-tool">⌘</div>
  {:else if isPlan}
    <div class="msg-avatar avatar-plan">▸</div>
  {:else if isFsWrite}
    <div class="msg-avatar avatar-fs">✎</div>
  {:else}
    <div class="msg-avatar avatar-sys">!</div>
  {/if}

  <div class="msg-body">
    <div class="msg-author">
      <span class="name">{isUser ? 'You' : isAssistant ? 'Copilot' : isTool ? 'tool' : isPlan ? 'plan' : isFsWrite ? 'file write' : 'system'}</span>
      <span class="time">{time}</span>
      {#if isAssistant && message.streaming}
        <span class="streaming">▌</span>
      {/if}
    </div>

    {#if (isUser || isAssistant || isSystem) && message.text}
      <div class="msg-content">
        {#each renderBlocks(message.text) as block, i (i)}
          {#if block.type === 'code'}
            <CodeBlock code={block.body} lang={block.lang} />
          {:else}
            <div class="md">{@html md(block.body)}</div>
          {/if}
        {/each}
      </div>
    {/if}

    {#if isTool && message.tool}
      <div class="tool-card">
        <div class="tool-head">
          <span class="tool-name">{message.tool.title}</span>
          <span class="tool-status t-{message.tool.status}">{message.tool.status}</span>
        </div>
        {#if message.tool.rawInput}
          <div class="tool-body">
            <pre><code>{JSON.stringify(message.tool.rawInput, null, 2)}</code></pre>
          </div>
        {/if}
        {#each message.tool.outputs as out, i (i)}
          <div class="tool-output">
            <pre><code>{out.content}</code></pre>
          </div>
        {/each}
      </div>
    {/if}

    {#if isFsWrite && message.fsWrite}
      <div class="fs-card">
        <div class="fs-head">
          <span class="fs-path" title={message.fsWrite.path}>{message.fsWrite.path.replace('/Users/narender', '~')}</span>
          {#if message.fsWrite.isNew}<span class="fs-tag fs-new">new</span>{/if}
          <span class="fs-stat fs-add">+{message.fsWrite.additions}</span>
          <span class="fs-stat fs-del">−{message.fsWrite.deletions}</span>
          <span class="fs-bytes">{(message.fsWrite.bytes / 1024).toFixed(1)} KB</span>
        </div>
        <pre class="fs-diff"><code>{#each message.fsWrite.patch.split('\n') as line, i (i)}<span class={line.startsWith('+') && !line.startsWith('+++') ? 'd-add' : line.startsWith('-') && !line.startsWith('---') ? 'd-del' : line.startsWith('@@') ? 'd-hunk' : 'd-ctx'}>{line}{'\n'}</span>{/each}</code></pre>
        {#if message.fsWrite.truncated}
          <div class="fs-trunc">… diff truncated for display</div>
        {/if}
      </div>
    {/if}

    {#if isPlan && message.plan}
      <PlanCard
        items={message.plan.map((p, i) => ({ id: String(i), step: p.priority, text: p.content, done: p.status === 'completed' }))}
        onApprove={() => onPlanAction?.(message.id, 'approve')}
        onEdit={() => onPlanAction?.(message.id, 'edit')}
        onCancel={() => onPlanAction?.(message.id, 'cancel')}
      />
    {/if}
  </div>
</div>

<style>
  .msg {
    display: grid;
    grid-template-columns: 28px 1fr;
    gap: 12px;
    padding: 14px 0;
    border-bottom: 1px dashed rgba(38, 44, 57, .5);
  }
  .msg:last-child { border-bottom: 0; }

  .msg-avatar {
    width: 28px; height: 28px; border-radius: 8px;
    display: grid; place-items: center;
    font-size: 13px; font-weight: 600;
    background: var(--bg-2); border: 1px solid var(--line);
    color: var(--fg-2);
  }
  .avatar-asst {
    background: linear-gradient(135deg, #7c5cff 0%, #5b8cff 50%, #4ad8c7 100%);
    color: #08090c; border: 0;
    box-shadow: 0 0 16px rgba(124,92,255,.35);
  }
  .avatar-user { background: var(--bg-3); }
  .avatar-tool { color: var(--aurora-3); }
  .avatar-plan { color: var(--warn); }
  .avatar-sys  { color: var(--err); }
  .avatar-fs   { color: var(--ok); }

  .fs-card {
    background: var(--bg-2); border: 1px solid var(--line);
    border-radius: var(--r-md); margin-top: 8px; overflow: hidden;
  }
  .fs-head {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 12px;
    background: rgba(86,211,100,.06);
    border-bottom: 1px solid var(--line);
    font-family: var(--mono); font-size: 12px;
  }
  .fs-path { color: var(--fg); font-weight: 600; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fs-tag { padding: 1px 6px; border-radius: 4px; font-size: 9.5px; text-transform: uppercase; letter-spacing: .5px; font-weight: 700; }
  .fs-new { background: rgba(86,211,100,.2); color: var(--ok); border: 1px solid rgba(86,211,100,.4); }
  .fs-stat { font-size: 11px; font-weight: 600; padding: 1px 6px; border-radius: 4px; }
  .fs-add { background: rgba(86,211,100,.15); color: var(--ok); }
  .fs-del { background: rgba(255,123,114,.15); color: var(--err); }
  .fs-bytes { color: var(--fg-4); font-size: 11px; }
  .fs-diff {
    background: var(--bg-0); margin: 0; padding: 10px 12px;
    overflow-x: auto; max-height: 360px; overflow-y: auto;
  }
  .fs-diff code { font-family: var(--mono); font-size: 12px; white-space: pre; }
  .d-add { background: rgba(86,211,100,.1); color: #88f5ad; display: inline-block; width: 100%; }
  .d-del { background: rgba(255,123,114,.1); color: #ffb4ad; display: inline-block; width: 100%; }
  .d-hunk { color: var(--aurora-3); font-weight: 600; }
  .d-ctx { color: var(--fg-3); }
  .fs-trunc { padding: 6px 12px; color: var(--fg-4); font-size: 11px; font-style: italic; border-top: 1px solid var(--line); }

  .msg-body { min-width: 0; }
  .msg-author {
    display: flex; align-items: center; gap: 8px;
    font-size: 12px; font-weight: 600; color: var(--fg-2);
    margin-bottom: 4px;
  }
  .msg-author .time { font-weight: 400; color: var(--fg-4); font-size: 11px; }
  .streaming { color: var(--aurora-3); animation: blink 1s steps(2) infinite; }
  @keyframes blink { 50% { opacity: 0; } }

  .msg-content { font-size: 14px; color: var(--fg); line-height: 1.6; }
  .md :global(p) { margin: 6px 0; word-wrap: break-word; overflow-wrap: anywhere; }
  .md :global(h1), .md :global(h2), .md :global(h3), .md :global(h4) {
    color: var(--fg); margin: 14px 0 6px; font-weight: 700; letter-spacing: -.3px;
  }
  .md :global(h1) { font-size: 18px; }
  .md :global(h2) { font-size: 16px; }
  .md :global(h3) { font-size: 14.5px; color: var(--aurora-3); }
  .md :global(h4) { font-size: 13px; color: var(--fg-2); }
  .md :global(ul), .md :global(ol) { margin: 6px 0 6px 22px; padding: 0; }
  .md :global(li) { margin: 3px 0; }
  .md :global(blockquote) {
    border-left: 3px solid var(--aurora-1); padding: 4px 12px; margin: 8px 0;
    background: rgba(124,92,255,.06); color: var(--fg-2); border-radius: 0 6px 6px 0;
  }
  .md :global(a) { color: var(--acc-2, var(--aurora-3)); text-decoration: none; border-bottom: 1px dotted; }
  .md :global(a:hover) { color: var(--aurora-1); }
  .md :global(strong) { color: var(--fg); font-weight: 700; }
  .md :global(em) { font-style: italic; color: var(--fg-2); }
  .md :global(hr) { border: 0; border-top: 1px dashed var(--line-2); margin: 12px 0; }
  .md :global(table) { border-collapse: collapse; margin: 8px 0; font-size: 13px; }
  .md :global(th), .md :global(td) { border: 1px solid var(--line); padding: 5px 9px; text-align: left; }
  .md :global(th) { background: var(--bg-2); color: var(--fg-3); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; }
  .md :global(code) {
    background: var(--bg-2); padding: 1px 5px; border-radius: 4px;
    font-family: var(--mono); font-size: 12.5px; color: var(--aurora-3);
  }

  .tool-card {
    background: var(--bg-2); border: 1px solid var(--line);
    border-radius: var(--r-md); margin-top: 8px; overflow: hidden;
  }
  .tool-head {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 12px;
    background: rgba(74,216,199,.05);
    border-bottom: 1px solid var(--line);
  }
  .tool-name { font-family: var(--mono); font-size: 12.5px; color: var(--aurora-3); flex: 1; }
  .tool-status {
    font-size: 10.5px; padding: 1px 8px; border-radius: 999px;
    text-transform: uppercase; letter-spacing: .5px; font-weight: 600;
    background: var(--bg-3); color: var(--fg-3); border: 1px solid var(--line);
  }
  .tool-status.t-completed,
  .tool-status.t-success { color: var(--ok); border-color: rgba(86,211,100,.4); }
  .tool-status.t-failed,
  .tool-status.t-error { color: var(--err); border-color: rgba(255,123,114,.4); }
  .tool-status.t-pending,
  .tool-status.t-in_progress { color: var(--warn); border-color: rgba(255,166,87,.4); }

  .tool-body, .tool-output {
    padding: 10px 12px;
    border-top: 1px solid rgba(38,44,57,.4);
  }
  .tool-body pre, .tool-output pre {
    background: var(--bg-0); border: 1px solid var(--line);
    border-radius: var(--r-sm); padding: 10px; overflow-x: auto;
    margin: 0;
  }
  .tool-body pre code, .tool-output pre code {
    font-family: var(--mono); font-size: 12px; color: var(--fg-2);
  }
</style>
