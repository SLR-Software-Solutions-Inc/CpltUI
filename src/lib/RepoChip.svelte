<script lang="ts">
  interface Props {
    repo: string;
    branch: string;
    owner?: string;
  }

  let { repo, branch, owner = 'SLR' }: Props = $props();
</script>

<span class="repo-chip" title="{owner}/{repo}@{branch}">
  <span class="gh">{owner.charAt(0)}</span>
  <span class="name">{repo}</span>
  <span class="branch">{branch}</span>
</span>

<style>
  .repo-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 5px 10px 5px 8px;
    background: var(--bg-2);
    border: 1px solid var(--line-2);
    border-radius: var(--r-pill);
    font-size: 12px;
    color: var(--fg-2);
  }
  .gh {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: linear-gradient(135deg, #7c5cff, #4ad8c7);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    color: #fff;
    font-weight: 700;
  }
  .branch {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--fg-3);
  }
  .branch::before {
    content: '@ ';
    color: var(--fg-4);
  }
</style>
