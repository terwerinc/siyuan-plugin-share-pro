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

  export let tabs: { label: string; content: any }[] = []
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
        <svelte:component this={tabs[activeTab].content} />
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
  }

  .tabs.vertical {
    flex-direction: column;
    margin-top: 10px;
  }

  .tabs:not(.vertical) {
    flex-direction: row;
    margin-left: 10px;
  }

  .tab-list {
    display: flex;
    flex-wrap: wrap;
  }

  .tabs.vertical .tab-list {
    flex-direction: row; /* 垂直布局时，按钮水平排列 */
    width: 100%; /* 确保按钮水平排列 */
  }

  .tabs:not(.vertical) .tab-list {
    flex-direction: column; /* 水平布局时，按钮垂直排列 */
  }

  .tab {
    padding: 10px;
    border: none; /* 初始边框 */
    background-color: #f1f1f1;
    cursor: pointer;
    flex: 1 1 auto; /* 使按钮均匀分布 */
    position: relative; /* 用于定位边框 */
  }

  .tab.active,
  .tab:active {
    background-color: #007bff; /* 金融蓝 */
    color: white;
  }

  .tab-content {
    padding: 10px;
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
