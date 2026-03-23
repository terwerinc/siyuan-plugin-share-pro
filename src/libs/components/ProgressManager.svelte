<script lang="ts">
  import { showMessage } from "siyuan"
  import { onDestroy, onMount } from "svelte"
  import ShareProPlugin from "../../index"
  import { ProgressManager } from "../../utils/progress/ProgressManager"
  import { progressStore } from "../../utils/progress/progressStore"

  // Props
  export let pluginInstance: ShareProPlugin
  export let docId: string = "" // 当前文档ID，用于文档级别隔离

  // Local state
  let currentBatch = null
  let isVisible = false
  let autoCloseTimer = null
  let countdown = 5

  // 文档级别的错误过滤
  // 关键修复：使用 initiatorDocId（发起操作的文档ID）而不是 currentDocId（当前正在处理的文档ID）
  // initiatorDocId 是用户点击"分享"按钮的文档ID，不会随处理进度变化
  $: isCurrentDocOperation = (() => {
    if (!currentBatch || !docId) return false
    // 关键：使用 initiatorDocId 判断当前文档是否是发起操作的文档
    return currentBatch.initiatorDocId === docId
  })()

  // 当 initiatorDocId 匹配时，显示所有相关错误（包括子文档/引用文档的错误）
  $: currentDocErrors = isCurrentDocOperation ? currentBatch?.errors || [] : []
  $: currentDocResourceErrors = isCurrentDocOperation ? currentBatch?.resourceErrors || [] : []
  $: hasErrors = currentDocErrors.length > 0 || currentDocResourceErrors.length > 0

  // Subscribe to progress store
  let unsubscribe: () => void

  onMount(() => {
    unsubscribe = progressStore.subscribe((value) => {
      currentBatch = value
      // 关键修复：只有当操作与当前文档相关时才显示
      isVisible = !!value && (isCurrentDocOperation || !docId)

      // 当有新的进度状态时，重置自动关闭计时器
      if (value && isVisible) {
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
    // 使用文档级别的错误判断
    const shouldAutoClose =
      currentBatch && currentBatch.status === "success" && !hasErrors && !currentBatch.isResourceProcessing

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
  function handleClose(e?: Event) {
    // 阻止事件冒泡，避免影响 ShareUI
    if (e) e.stopPropagation()

    // 关键设计：错误信息保留在 progressStore 中，直到下一次操作或组件销毁
    // 这样 ShareUI 可以直接从 progressStore 获取错误信息，实现文档级别的错误隔离
    isVisible = false
    currentBatch = null
    ProgressManager.clearBatch()
    clearAutoCloseTimer()
  }

  // "我知道了"按钮处理
  function handleAcknowledgeError(e) {
    e.stopPropagation()
    // 保存错误状态后关闭
    handleClose()
    showMessage(pluginInstance.i18n["progressManager"]["errorAcknowledged"], 3000, "info")
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
            {pluginInstance.i18n["progressManager"]["operationCompleted"]}
          {:else if currentBatch.status === "error"}
            {pluginInstance.i18n["progressManager"]["operationFailed"]}
          {:else if currentBatch.status === "canceled"}
            {pluginInstance.i18n["progressManager"]["operationCanceled"]}
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
          <span class="status-text">{pluginInstance.i18n["progressManager"]["progressRunning"]}</span>
        {:else if currentBatch.status === "success"}
          <span class="status-icon success">✓</span>
          <span class="status-text">{pluginInstance.i18n["progressManager"]["progressSuccess"]}</span>
        {:else if currentBatch.status === "error"}
          <span class="status-icon error">✗</span>
          <span class="status-text">{pluginInstance.i18n["progressManager"]["progressError"]}</span>
        {:else if currentBatch.status === "canceled"}
          <span class="status-icon canceled">■</span>
          <span class="status-text">{pluginInstance.i18n["progressManager"]["progressCanceled"]}</span>
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
          <span class="waiting-text">{pluginInstance.i18n["progressManager"]["waitingForResourceCompletion"]}</span>
        </div>
      {/if}

      <!-- Current document -->
      {#if currentBatch.currentDocTitle}
        <div class="current-document">
          <span class="doc-label">{pluginInstance.i18n["progressManager"]["currentDocument"]}</span>
          <span class="doc-title">{currentBatch.currentDocTitle}</span>
          {#if currentBatch.skippedCount > 0 && currentBatch.currentDocId}
            <span class="doc-skipped">({pluginInstance.i18n["progressManager"]["skipped"]})</span>
          {/if}
        </div>
      {/if}

      <!-- Auto-close countdown or persistent display for errors -->
      {#if countdown > 0}
        <div class="auto-close-info">
          {pluginInstance.i18n["progressManager"]["autoCloseIn"].replace("[param1]", countdown.toString())}
        </div>
      {/if}

      <!-- Error details display - 文档级别，只显示当前文档的错误 -->
      {#if hasErrors}
        <div class="error-details">
          <div class="error-header">
            {pluginInstance.i18n["progressManager"]["errorsDetected"]}
          </div>
          {#if currentDocErrors.length > 0}
            <div class="document-errors">
              <span class="error-type">📄 {pluginInstance.i18n["progressManager"]["documentErrors"]}:</span>
              <ul class="error-list">
                {#each currentDocErrors as error, index}
                  <li class="error-item" title={error.error}>
                    {error.docId.substring(0, 8)}...: {String(error.error).substring(0, 50)}...
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
          {#if currentDocResourceErrors.length > 0}
            <div class="resource-errors">
              <span class="error-type">🖼️ {pluginInstance.i18n["progressManager"]["resourceErrors"]}:</span>
              <ul class="error-list">
                {#each currentDocResourceErrors as error, index}
                  <li class="error-item" title={error.error}>
                    {error.docId.substring(0, 8)}...: {String(error.error).substring(0, 50)}...
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>

        <!-- 大厂设计：错误状态下显示"我知道了"按钮，给用户明确的关闭入口 -->
        <div class="error-actions">
          <button class="acknowledge-btn" on:click={handleAcknowledgeError}>
            {pluginInstance.i18n["progressManager"]["acknowledgeError"]}
          </button>
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

  // 大厂设计：错误操作按钮区域
  .error-actions
    display flex
    justify-content flex-end
    margin-top 12px
    padding-top 12px
    border-top 1px solid rgba(245, 34, 45, 0.3)

  // 大厂设计："我知道了"按钮样式（参考阿里云/字节设计规范）
  .acknowledge-btn
    padding 8px 20px
    font-size 13px
    font-weight 500
    color white
    background-color #f5222d
    border none
    border-radius 4px
    cursor pointer
    transition all 0.2s ease
    box-shadow 0 2px 4px rgba(245, 34, 45, 0.3)

    &:hover
      background-color #ff4d4f
      box-shadow 0 4px 8px rgba(245, 34, 45, 0.4)
      transform translateY(-1px)

    &:active
      background-color #cf1322
      transform translateY(0)

  /* Dark mode support - using :global to avoid unused selector warning */
  :global(html[data-theme-mode="dark"]) &
    background-color rgba(24, 24, 28, 0.95)
    border-color rgba(255, 255, 255, 0.2)
    backdrop-filter blur(16px)

    .progress-title
      color rgba(255, 255, 255, 0.95)

    .progress-info,
    .current-document
      color rgba(255, 255, 255, 0.9)
</style>
