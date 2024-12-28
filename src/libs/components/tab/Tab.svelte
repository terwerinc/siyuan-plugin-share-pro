<!--
  -            GNU GENERAL PUBLIC LICENSE
  -               Version 3, 29 June 2007
  -
  -  Copyright (C) 2024 Terwer, Inc. <https://terwer.space/>
  -  Everyone is permitted to copy and distribute verbatim copies
  -  of this license document, but changing it is not allowed.
  -->

<script lang="ts">
  import { createEventDispatcher } from "svelte"

  export let tabs: { label: string; content: any; props?: Record<string, any> }[] = []
  export let activeTab: number = 0
  export let vertical: boolean = false

  const dispatch = createEventDispatcher()

  function handleTabClick(index: number) {
    if (index !== activeTab) {
      activeTab = index
      dispatch("tabChange", index)
    }
  }
</script>

<div class="tabs" class:vertical>
  <div class="tab-list">
    {#each tabs as { label }, index}
      <button class="tab" class:active={index === activeTab} on:click={() => handleTabClick(index)}>
        {label}
      </button>
    {/each}
  </div>

  <div class="tab-content">
    {#if tabs[activeTab]}
      {#if typeof tabs[activeTab].content === "function"}
        <svelte:component this={tabs[activeTab].content} {...tabs[activeTab].props} />
      {:else}
        {tabs[activeTab].content}
      {/if}
    {/if}
  </div>
</div>

<style lang="stylus">
  .tabs
    display flex
    flex-direction column
    border-radius 8px
    overflow hidden
    background-color #fff
    box-shadow 0 1px 3px rgba(0, 0, 0, 0.1)
    margin 10px

  .tabs.vertical
    flex-direction row

  .tabs:not(.vertical)
    flex-direction column

  .tab-list
    display flex
    flex-wrap wrap
    border-bottom 1px solid #e0e0e0

  .tabs.vertical .tab-list
    flex-direction column
    border-right 1px solid #e0e0e0
    border-bottom none

  .tabs:not(.vertical) .tab-list
    flex-direction row

  .tab
    padding 12px 16px
    border none
    background-color transparent
    cursor pointer
    position relative
    font-size 14px
    color #555
    transition background-color 0.2s ease

  .tabs.vertical .tab:not(:last-child)
    border-bottom 1px solid #e0e0e0

  .tabs:not(.vertical) .tab:not(:last-child)
    border-right 1px solid #e0e0e0

  .tab.active, .tab:active
    background-color var(--b3-list-hover)
    color var(--b3-theme-on-background)

  .tab-content
    padding 16px
    background-color #fff

  .tabs.vertical .tab-content
    flex 1

  .tabs:not(.vertical) .tab-content
    flex 1

  /* 适配暗黑主题 */
  :global(html[data-theme-mode="dark"]) .tabs
    background-color: var(--b3-theme-background);
    .tab-content
      background-color: var(--b3-theme-background);

  :global(html[data-theme-mode="dark"]) .tab-list
    border-bottom 1px solid var(--b3-theme-surface-lighter)

  :global(html[data-theme-mode="dark"]) .tabs.vertical .tab-list
    border-right 1px solid var(--b3-theme-surface-lighter)

  :global(html[data-theme-mode="dark"]) .tabs.vertical .tab:not(:last-child)
    border-bottom 1px solid var(--b3-theme-surface-lighter)

  :global(html[data-theme-mode="dark"]) .tabs:not(.vertical) .tab:not(:last-child)
    border-right 1px solid var(--b3-theme-surface-lighter)
</style>
