<script lang="ts">
  import { showMessage } from "siyuan"
  import { onDestroy, onMount } from "svelte"
  import ShareProPlugin from "../../index"
  import { ProgressManager } from "../../utils/progress/ProgressManager"
  import { progressStore } from "../../utils/progress/progressStore"

  // Props
  export let pluginInstance: ShareProPlugin

  // Local state
  let currentBatch = null
  let isVisible = false
  let autoCloseTimer = null
  let countdown = 5

  // Subscribe to progress store
  let unsubscribe: () => void

  onMount(() => {
    unsubscribe = progressStore.subscribe((value) => {
      currentBatch = value
      isVisible = !!value

      // 当有新的进度状态时，重置自动关闭计时器
      if (value) {
        resetAutoCloseTimer()
      }
    })
  })

  // Cleanup on destroy
  onDestroy(() => {
    if (unsubscribe) {
      unsubscribe()
    }
    clearAutoCloseTimer()
    currentBatch = null
    isVisible = false
  })

  // 重置自动关闭计时器
  function resetAutoCloseTimer() {
    clearAutoCloseTimer()

    // 只有在成功且无错误的情况下才启用自动关闭
    const shouldAutoClose =
      currentBatch &&
      currentBatch.status === "success" &&
      currentBatch.errors.length === 0 &&
      currentBatch.resourceErrors.length === 0 &&
      !currentBatch.isResourceProcessing

    if (shouldAutoClose) {
      countdown = 5
      autoCloseTimer = setInterval(() => {
        countdown--
        if (countdown <= 0) {
          handleCloseAuto()
        }
      }, 1000)
    } else {
      // 有错误时不自动关闭，显示永久提示
      countdown = 0
    }
  }

  // 清除自动关闭计时器
  function clearAutoCloseTimer() {
    if (autoCloseTimer) {
      clearInterval(autoCloseTimer)
      autoCloseTimer = null
    }
  }

  // 自动关闭处理
  function handleCloseAuto() {
    isVisible = false
    currentBatch = null
    ProgressManager.clearBatch()
    clearAutoCloseTimer()
  }

  // 手动关闭处理
  function handleClose(e) {
    // 阻止事件冒泡，避免影响 ShareUI
    e.stopPropagation()
    isVisible = false
    currentBatch = null
    ProgressManager.clearBatch()
    clearAutoCloseTimer()
  }

  // Cancel batch handler
  function handleCancel(e) {
    // 阻止事件冒泡
    e.stopPropagation()
    if (currentBatch) {
      ProgressManager.cancelBatch(currentBatch.id)
      showMessage(pluginInstance.i18n["progressManager"]["progressCanceled"], 3000, "info")
    }
  }
</script>

{#if isVisible && currentBatch}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="share-pro-progress-manager-overlay" on:click={handleClose}>
    <div class="share-pro-progress-manager-content" on:click|stopPropagation>
      <!-- Header -->
      <div class="progress-header">
        <div class="progress-title">
          {#if currentBatch.status === "processing"}
            {currentBatch.operationName}
          {:else if currentBatch.status === "success"}
            {pluginInstance.i18n["progressManager"]["operationCompleted"] || "操作完成"}
          {:else if currentBatch.status === "error"}
            {pluginInstance.i18n["progressManager"]["operationFailed"] || "操作失败"}
          {:else if currentBatch.status === "canceled"}
            {pluginInstance.i18n["progressManager"]["operationCanceled"] || "操作已取消"}
          {:else}
            {currentBatch.operationName}
          {/if}
        </div>
        <button class="close-button" on:click={handleClose} title={pluginInstance.i18n["cancel"] || "Close"}>
          ×
        </button>
      </div>

      <!-- Status indicator -->
      <div class="progress-status">
        {#if currentBatch.status === "processing"}
          <span class="status-icon processing">⚡</span>
          <span class="status-text">{pluginInstance.i18n["progressManager"]["progressRunning"] || "In Progress"}</span>
        {:else if currentBatch.status === "success"}
          <span class="status-icon success">✓</span>
          <span class="status-text">{pluginInstance.i18n["progressManager"]["progressSuccess"] || "Success"}</span>
        {:else if currentBatch.status === "error"}
          <span class="status-icon error">✗</span>
          <span class="status-text">{pluginInstance.i18n["progressManager"]["progressError"] || "Error"}</span>
        {:else if currentBatch.status === "canceled"}
          <span class="status-icon canceled">■</span>
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
          <div class="progress-fill" style="width: {currentBatch.percentage}%; transition: width 0.3s ease;" />
        </div>
      </div>

      <!-- Resource progress (if applicable) -->
      {#if currentBatch.totalResources > 0}
        <div class="resource-progress">
          <div class="resource-info">
            <span class="resource-info-text">
              {pluginInstance.i18n["progressManager"]["resourcesProcessed"]
                .replace("[param1]", currentBatch.completedResources.toString())
                .replace("[param2]", currentBatch.totalResources.toString())}
            </span>
          </div>
          <div class="resource-bar">
            <div
              class="resource-fill"
              style="width: {Math.round(
                (currentBatch.completedResources / currentBatch.totalResources) * 100
              )}%; transition: width 0.3s ease;"
            />
          </div>
        </div>
      {/if}

      <!-- Waiting for resource completion -->
      {#if currentBatch.documentsCompleted && currentBatch.isResourceProcessing}
        <div class="waiting-info">
          <span class="waiting-icon">⏳</span>
          <span class="waiting-text"
            >{pluginInstance.i18n["progressManager"]["waitingForResourceCompletion"] ||
              "Waiting for resource processing to complete..."}</span
          >
        </div>
      {/if}

      <!-- Current document -->
      {#if currentBatch.currentDocTitle}
        <div class="current-document">
          <span class="doc-label">{pluginInstance.i18n["progressManager"]["currentDocument"]}</span>
          <span class="doc-title">{currentBatch.currentDocTitle}</span>
        </div>
      {/if}

      <!-- Auto-close countdown or persistent display for errors -->
      {#if countdown > 0}
        <div class="auto-close-info">
          {pluginInstance.i18n["progressManager"]["autoCloseIn"].replace("[param1]", countdown.toString())}
        </div>
      {/if}

      <!-- Error details display -->
      {#if currentBatch && (currentBatch.errors.length > 0 || currentBatch.resourceErrors.length > 0)}
        <div class="error-details">
          <div class="error-header">
            {pluginInstance.i18n["progressManager"]["errorsDetected"] || "Errors detected:"}
          </div>
          {#if currentBatch.errors.length > 0}
            <div class="document-errors">
              <span class="error-type"
                >📄 {pluginInstance.i18n["progressManager"]["documentErrors"] || "Document errors"}:</span
              >
              <ul class="error-list">
                {#each currentBatch.errors as error, index}
                  <li class="error-item" title={error.error}>
                    {error.docId.substring(0, 8)}...: {String(error.error).substring(0, 50)}...
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
          {#if currentBatch.resourceErrors.length > 0}
            <div class="resource-errors">
              <span class="error-type"
                >🖼️ {pluginInstance.i18n["progressManager"]["resourceErrors"] || "Resource errors"}:</span
              >
              <ul class="error-list">
                {#each currentBatch.resourceErrors as error, index}
                  <li class="error-item" title={error.error}>
                    {error.docId.substring(0, 8)}...: {String(error.error).substring(0, 50)}...
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style lang="stylus">
.share-pro-progress-manager-overlay
  position fixed
  bottom 20px
  right 20px
  z-index 9999
  background-color rgba(24, 24, 28, 0.92)
  color white
  padding 16px
  border-radius 12px
  box-shadow 0 6px 20px rgba(0, 0, 0, 0.4)
  // 尽量继承宿主的字体，不要单独搞一套
  //font-family "Open Sans", "LXGW WenKai", "JetBrains Mono", "-apple-system", "Microsoft YaHei", "Times New Roman", "方正北魏楷书_GBK", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif
  max-width 640px
  width 100%
  backdrop-filter blur(12px)
  border 1px solid rgba(255, 255, 255, 0.15)

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
    box-shadow 0 0 8px rgba(24, 144, 255, 0.3)

  .current-document
    display flex
    align-items center
    gap 8px
    font-size 13px
    color rgba(255, 255, 255, 0.85)

  .doc-label
    font-weight 600
    color rgba(255, 255, 255, 0.9)

  .doc-title
    font-weight 500
    overflow hidden
    text-overflow ellipsis
    white-space nowrap
    max-width 220px

  .auto-close-info
    font-size 12px
    color rgba(255, 255, 255, 0.6)
    text-align right
    font-style italic

  .resource-progress
    display flex
    flex-direction column
    gap 8px
    margin-top 8px

  .resource-info
    display flex
    justify-content space-between
    align-items center
    font-size 13px
    color rgba(255, 255, 255, 0.8)

  .resource-info-text
    font-weight 600
    color rgba(255, 255, 255, 0.9)
    width 100%
    text-align left

  .resource-label
    font-weight 600
    color rgba(255, 255, 255, 0.9)

  .resource-count
    font-weight 500
    color #fa8c16

  .resource-bar
    height 4px
    background-color rgba(255, 255, 255, 0.2)
    border-radius 2px
    overflow hidden

  .resource-fill
    height 100%
    background linear-gradient(90deg, #fa8c16, #faad14)
    border-radius 2px
    transition width 0.3s ease

  .waiting-info
    display flex
    align-items center
    gap 8px
    font-size 13px
    color rgba(255, 255, 255, 0.85)
    margin-top 8px

  .waiting-icon
    font-size 16px

  .waiting-text
    font-style italic

  .error-details
    display flex
    flex-direction column
    gap 8px
    margin-top 12px
    padding 8px
    background-color rgba(245, 34, 45, 0.1)
    border-radius 6px
    border 1px solid rgba(245, 34, 45, 0.3)

  .error-header
    font-weight 600
    color #f5222d
    font-size 14px

  .error-type
    font-weight 600
    color rgba(255, 255, 255, 0.9)
    font-size 13px
    margin-bottom 4px

  .error-list
    list-style none
    padding 0
    margin 0
    display flex
    flex-direction column
    gap 4px

  .error-item
    font-size 12px
    color rgba(255, 255, 255, 0.85)
    white-space nowrap
    overflow hidden
    text-overflow ellipsis
    padding 2px 4px
    background-color rgba(255, 255, 255, 0.1)
    border-radius 3px
    cursor pointer
    transition background-color 0.2s ease

    &:hover
      background-color rgba(255, 255, 255, 0.2)
      color white

  /* Dark mode support */
  html[data-theme-mode="dark"] &
    background-color rgba(24, 24, 28, 0.95)
    border-color rgba(255, 255, 255, 0.2)
    backdrop-filter blur(16px)

    .progress-title
      color rgba(255, 255, 255, 0.95)

    .progress-info,
    .current-document
      color rgba(255, 255, 255, 0.9)
</style>
