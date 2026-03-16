<!--
  -            GNU GENERAL PUBLIC LICENSE
  -               Version 3, 29 June 2007
  -
  -  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
  -  Everyone is permitted to copy and distribute verbatim copies
  -  of this license document, but changing it is not allowed.
  -->

<script lang="ts">
  export let node: any;
  export let selectedDocIds: Set<string>;
  export let expandedNodes: Set<string>;
  export let depth: number = 0;
  export let onToggleExpand: (nodeId: string) => void;
  export let onToggleSelect: (docId: string, event: Event) => void;
  export let isBlacklisted: (docId: string) => boolean;

  const hasChildren = () => {
    return node.children && node.children.length > 0;
  };

  const isExpanded = () => {
    return expandedNodes.has(node.docId);
  };

  const isSelected = () => {
    return selectedDocIds.has(node.docId);
  };

  const isNodeBlacklisted = () => {
    return isBlacklisted(node.docId);
  };

  const toggleExpand = () => {
    if (onToggleExpand) {
      onToggleExpand(node.docId);
    }
  };

  const toggleSelect = (event: Event) => {
    if (onToggleSelect) {
      onToggleSelect(node.docId, event);
    }
  };
</script>

<div class="tree-node" style="padding-left: {depth * 16}px">
  <div class="node-content">
    {#if hasChildren()}
      <span class="expand-icon" on:click={toggleExpand}>
        {isExpanded() ? '▼' : '▶'}
      </span>
    {:else}
      <span class="expand-icon" style="visibility: hidden;">▶</span>
    {/if}

    <input
      type="checkbox"
      checked={isSelected()}
      on:change={toggleSelect}
      disabled={isNodeBlacklisted()}
      class="node-checkbox"
    />

    <span class="node-title {isNodeBlacklisted() ? 'blacklisted' : ''}">
      {node.docTitle || 'Untitled Document'}
    </span>

    {#if isNodeBlacklisted()}
      <span class="blacklist-indicator" title="Blacklisted">
        🚫
      </span>
    {/if}
  </div>
</div>

<style lang="stylus">
  .tree-node
    margin 2px 0

  .node-content
    display flex
    align-items center
    gap 8px
    padding 4px 8px
    border-radius 3px
    cursor pointer

    &:hover
      background-color var(--b3-theme-surface-light)

  .expand-icon
    font-size 12px
    color var(--b3-theme-on-surface)
    cursor pointer
    user-select none

  .node-checkbox
    width 16px
    height 16px
    cursor pointer

    &[disabled]
      opacity 0.5
      cursor not-allowed

  .node-title
    font-size 13px
    color var(--b3-theme-on-surface)
    white-space nowrap
    overflow hidden
    text-overflow ellipsis

  .node-title.blacklisted
    color var(--b3-theme-error)
    text-decoration line-through

  .blacklist-indicator
    font-size 12px
    color var(--b3-theme-error)
    margin-left 4px
</style>