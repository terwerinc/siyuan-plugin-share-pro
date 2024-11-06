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

<style>
  .tabs {
    display: flex;
    flex-direction: column;
    /* 添加圆角 */
    border-radius: 8px;
    /* 防止内容溢出圆角 */
    overflow: hidden;
    background-color: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    margin: 10px;
  }

  .tabs.vertical {
    flex-direction: row;
  }

  .tabs:not(.vertical) {
    flex-direction: column;
  }

  .tab-list {
    display: flex;
    flex-wrap: wrap;
    border-bottom: 1px solid #e0e0e0;
  }

  .tabs.vertical .tab-list {
    /* 垂直布局时，按钮水平排列 */
    flex-direction: column;
    border-right: 1px solid #e0e0e0;
    border-bottom: none;
  }

  .tabs:not(.vertical) .tab-list {
    /* 水平布局时，按钮垂直排列 */
    flex-direction: row;
  }

  .tab {
    padding: 12px 16px;
    /* 初始边框 */
    border: none;
    background-color: transparent;
    cursor: pointer;
    /* 使按钮均匀分布 */
    /* flex: 1 1 auto; */
    /* 用于定位边框 */
    position: relative;
    font-size: 14px;
    color: #555;
    transition: background-color 0.2s ease;
  }

  .tabs.vertical .tab:not(:last-child) {
    border-bottom: 1px solid #e0e0e0;
  }

  .tabs:not(.vertical) .tab:not(:last-child) {
    border-right: 1px solid #e0e0e0;
  }

  .tab.active,
  .tab:active {
    /* Notion 蓝色 */
    background-color: #eaf4ff;
    color: #1a73e8;
  }

  .tab-content {
    padding: 16px;
    background-color: #fff;
  }

  .tabs.vertical .tab-content {
    /* 垂直布局时，内容占满剩余空间 */
    flex: 1;
  }

  .tabs:not(.vertical) .tab-content {
    /* 水平布局时，内容占满剩余空间 */
    flex: 1;
  }
</style>
