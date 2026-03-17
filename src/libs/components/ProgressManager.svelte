<script lang="ts">
  import { onMount, onDestroy } from "svelte"
  import { showMessage } from "siyuan"
  import ShareProPlugin from "../../index"
  import { ProgressManager } from "../utils/ProgressManager"
  import { progressStore } from "../utils/progressStore"

  // Props
  export let pluginInstance: ShareProPlugin

  // Local state
  let currentBatch = null
  let isVisible = false

  // Subscribe to progress store
  let unsubscribe: () => void

  onMount(() => {
    unsubscribe = progressStore.subscribe(value => {
      currentBatch = value
      isVisible = !!value
    })
  })

  // Cleanup on destroy
  onDestroy(() => {
    if (unsubscribe) {
      unsubscribe()
    }
    currentBatch = null
    isVisible = false
  })

  // Close handler - manual close only
  function handleClose(e) {
    // 阻止事件冒泡，避免影响 ShareUI
    e.stopPropagation()
    isVisible = false
    currentBatch = null
    ProgressManager.clearBatch()
  }

  // Cancel batch handler
  function handleCancel(e) {
    // 阻止事件冒泡
    e.stopPropagation()
    if (currentBatch) {
      ProgressManager.cancelBatch(currentBatch.id)
      showMessage(
        pluginInstance.i18n["progressManager"]["progressCanceled"],
        3000,
        "info"
      )
    }
  }
</script>

{#if isVisible && currentBatch}
  <div class="share-pro-progress-manager-overlay" on:click|stopPropagation>
    <div class="share-pro-progress-manager-content">
      <!-- Header -->
      <div class="progress-header">
        <div class="progress-title">
          {currentBatch.operationName}
        </div>
        <button
          class="close-button"
          on:click={handleClose}
          title={pluginInstance.i18n["cancel"] || "Close"}
        >
          ×
        </button>
      </div>

      <!-- Status indicator -->
      <div class="progress-status">
        {#if currentBatch.status === 'processing'}
          <span class="status-icon processing">🔄</span>
          <span class="status-text">{pluginInstance.i18n["progressManager"]["progressRunning"] || "In Progress"}</span>
        {:else if currentBatch.status === 'success'}
          <span class="status-icon success">✅</span>
          <span class="status-text">{pluginInstance.i18n["progressManager"]["progressSuccess"] || "Success"}</span>
        {:else if currentBatch.status === 'error'}
          <span class="status-icon error">❌</span>
          <span class="status-text">{pluginInstance.i18n["progressManager"]["progressError"] || "Error"}</span>
        {:else if currentBatch.status === 'canceled'}
          <span class="status-icon canceled">⏹️</span>
          <span class="status-text">{pluginInstance.i18n["progressManager"]["progressCanceled"] || "Canceled"}</span>
        {/if}
      </div>

      <!-- Progress bar -->
      <div class="progress-bar-container">
        <div class="progress-info">
          <span class="progress-count">{currentBatch.completed}/{currentBatch.total}</span>
          <span class="progress-percentage">{currentBatch.percentage}%</span>
        </div>
        <div class="progress-bar">
          <div
            class="progress-fill"
            style="width: {currentBatch.percentage}%; transition: width 0.3s ease;"
          ></div>
        </div>
      </div>

      <!-- Current document -->
      {#if currentBatch.currentDocTitle}
        <div class="current-document">
          <span class="doc-label">Current:</span>
          <span class="doc-title">{currentBatch.currentDocTitle}</span>
        </div>
      {/if}

      <!-- Action buttons -->
      <div class="action-buttons">
        {#if currentBatch.status === 'processing'}
          <button
            class="cancel-button"
            on:click={handleCancel}
            title={pluginInstance.i18n["progressManager"]["cancelConfirm"] || "Cancel operation"}
          >
            {pluginInstance.i18n["cancel"] || "Cancel"}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style lang="stylus">
.share-pro-progress-manager-overlay
  position fixed
  bottom 20px
  right 20px
  z-index 9999
  background-color rgba(0, 0, 0, 0.85)
  color white
  padding 16px
  border-radius 8px
  box-shadow 0 4px 12px rgba(0, 0, 0, 0.3)
  font-family "Open Sans", "LXGW WenKai", "JetBrains Mono", "-apple-system", "Microsoft YaHei", "Times New Roman", "方正北魏楷书_GBK", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif
  max-width 640px
  width 100%
  backdrop-filter blur(8px)
  border 1px solid rgba(255, 255, 255, 0.1)

  .share-pro-progress-manager-content
    display flex
    flex-direction column
    gap 16px

  .progress-header
    display flex
    justify-content space-between
    align-items center
    margin-bottom 12px

  .progress-title
    font-size 16px
    font-weight 600
    color rgba(255, 255, 255, 0.9)

  .close-button
    background none
    border none
    color rgba(255, 255, 255, 0.7)
    font-size 20px
    cursor pointer
    width 32px
    height 32px
    display flex
    align-items center
    justify-content center
    border-radius 50%
    transition all 0.2s ease

    &:hover
      background-color rgba(255, 255, 255, 0.1)
      color white

  .progress-status
    display flex
    align-items center
    gap 12px
    font-weight 600
    font-size 14px

  .status-icon
    font-size 20px

  .status-icon.processing
    color #1890ff

  .status-icon.success
    color #52c41a

  .status-icon.error
    color #f5222d

  .status-icon.canceled
    color #fa8c16

  .progress-bar-container
    display flex
    flex-direction column
    gap 12px

  .progress-info
    display flex
    justify-content space-between
    align-items center
    font-size 14px
    color rgba(255, 255, 255, 0.8)

  .progress-count
    font-weight 600
    font-size 16px

  .progress-percentage
    font-weight 600
    font-size 16px
    color #1890ff

  .progress-bar
    height 6px
    background-color rgba(255, 255, 255, 0.2)
    border-radius 3px
    overflow hidden

  .progress-fill
    height 100%
    background linear-gradient(90deg, #1890ff, #52c41a)
    border-radius 3px
    transition width 0.3s ease

  .current-document
    display flex
    align-items center
    gap 8px
    font-size 14px
    color rgba(255, 255, 255, 0.7)

  .doc-label
    font-weight 600
    color rgba(255, 255, 255, 0.8)

  .doc-title
    font-weight 500
    overflow hidden
    text-overflow ellipsis
    white-space nowrap
    max-width 280px

  .action-buttons
    display flex
    justify-content flex-end

  .cancel-button,
  .close-button-small
    padding 6px 12px
    border none
    border-radius 4px
    font-size 13px
    font-weight 500
    cursor pointer
    transition all 0.2s ease

  .cancel-button
    background-color #fa8c16
    color white

    &:hover
      background-color #d87a00
      transform translateY(-1px)

  .close-button-small
    background-color rgba(255, 255, 255, 0.15)
    color white
    transition all 0.2s ease

    &:hover
      background-color rgba(255, 255, 255, 0.25)
      transform translateY(-1px)

  /* Dark mode support */
  html[data-theme-mode="dark"] &
    background-color rgba(30, 30, 30, 0.95)
    border-color rgba(255, 255, 255, 0.15)
    backdrop-filter blur(14px)

    .progress-title
      color rgba(255, 255, 255, 0.95)

    .progress-info,
    .current-document
      color rgba(255, 255, 255, 0.85)
</style>