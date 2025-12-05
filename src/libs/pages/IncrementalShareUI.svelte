<!--
  -            GNU GENERAL PUBLIC LICENSE
  -               Version 3, 29 June 2007
  -
  -  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
  -  Everyone is permitted to copy and distribute verbatim copies
  -  of this license document, but changing it is not allowed.
  -->

<script lang="ts">
  import { showMessage } from "siyuan"
  import { onMount } from "svelte"
  import { simpleLogger } from "zhi-lib-base"
  import VirtualList from "svelte-virtual-list"
  import { isDev, SHARE_PRO_STORE_NAME } from "../../Constants"
  import ShareProPlugin from "../../index"
  import { ShareProConfig } from "../../models/ShareProConfig"
  import type { ChangeDetectionResult } from "../../service/IncrementalShareService"
  import { icons } from "../../utils/svg"

  export let pluginInstance: ShareProPlugin

  const logger = simpleLogger("incremental-share-ui", "share-pro", isDev)
  let config: ShareProConfig
  let isLoading = false
  let changeDetectionResult: ChangeDetectionResult | null = null
  let selectedNewDocs = new Set<string>()
  let selectedUpdatedDocs = new Set<string>()
  let expandedGroups = {
    newDocuments: true,
    updatedDocuments: true,
    unchangedDocuments: false,
  }
  let searchTerm = ""
  let filteredNewDocs: any[] = []
  let filteredUpdatedDocs: any[] = []
  let filteredUnchangedDocs: any[] = []
  let selectAllNew = false
  let selectAllUpdated = false
  
  // 虚拟滚动配置
  const ITEM_HEIGHT = 45 // 每个文档项的高度（像素）
  const MAX_VISIBLE_ITEMS = 100 // 每页显示的最大项数
  
  const formatTime = (timestamp: number) => {
    if (!timestamp || timestamp === 0) return "从未分享"
    try {
      return new Date(timestamp).toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch (error) {
      return "无效日期"
    }
  }

  onMount(async () => {
    config = await pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
    await loadDocuments()
  })

  const loadDocuments = async () => {
    isLoading = true
    try {
      const allDocuments = await getAllDocuments()
      changeDetectionResult = await pluginInstance.incrementalShareService.detectChangedDocuments(allDocuments)
      updateFilteredResults()
      logger.info("文档变更检测结果:", changeDetectionResult)
    } catch (error) {
      logger.error("加载文档失败:", error)
      showMessage(pluginInstance.i18n.incrementalShare.loadError, 7000, "error")
    } finally {
      isLoading = false
    }
  }

  const getAllDocuments = async () => {
    try {
      const mockDocuments = [
        { docId: "20231201-mock001", docTitle: "Mock 文档1 - 已分享未更新", modifiedTime: Date.now() - 1000 * 60 * 60 * 24 * 8, notebookId: "mock-nb1", notebookName: "Mock 笔记木1" },
        { docId: "20231202-mock002", docTitle: "Mock 文档2 - 已分享有更新", modifiedTime: Date.now() - 1000 * 60 * 60, notebookId: "mock-nb1", notebookName: "Mock 笔记木1" },
        { docId: "20231203-mock003", docTitle: "Mock 文档3 - 分享失败", modifiedTime: Date.now() - 1000 * 60 * 60 * 24 * 2, notebookId: "mock-nb1", notebookName: "Mock 笔记木1" },
        { docId: "20231205-mock005", docTitle: "Mock 文档5 - 新增文档", modifiedTime: Date.now() - 1000 * 60 * 30, notebookId: "mock-nb2", notebookName: "Mock 笔记木2" },
      ]
      logger.info(`获取到 ${mockDocuments.length} 个文档（Mock 数据）`)
      return mockDocuments
    } catch (error) {
      logger.error("获取文档列表失败:", error)
      return []
    }
  }

  const updateFilteredResults = () => {
    if (!changeDetectionResult) return
    const filterDocs = (docs: any[]) => {
      if (!searchTerm) return docs
      return docs.filter((doc) => doc.docTitle.toLowerCase().includes(searchTerm.toLowerCase()))
    }
    filteredNewDocs = filterDocs(changeDetectionResult.newDocuments)
    filteredUpdatedDocs = filterDocs(changeDetectionResult.updatedDocuments)
    filteredUnchangedDocs = filterDocs(changeDetectionResult.unchangedDocuments)
  }

  const handleSearch = () => updateFilteredResults()

  const handleSelectAllNew = () => {
    if (selectAllNew) {
      filteredNewDocs.forEach((doc) => selectedNewDocs.add(doc.docId))
    } else {
      filteredNewDocs.forEach((doc) => selectedNewDocs.delete(doc.docId))
    }
    selectedNewDocs = selectedNewDocs
  }

  const handleSelectAllUpdated = () => {
    if (selectAllUpdated) {
      filteredUpdatedDocs.forEach((doc) => selectedUpdatedDocs.add(doc.docId))
    } else {
      filteredUpdatedDocs.forEach((doc) => selectedUpdatedDocs.delete(doc.docId))
    }
    selectedUpdatedDocs = selectedUpdatedDocs
  }

  const toggleDocSelection = (docId: string, type: "new" | "updated") => {
    if (type === "new") {
      if (selectedNewDocs.has(docId)) {
        selectedNewDocs.delete(docId)
      } else {
        selectedNewDocs.add(docId)
      }
      selectedNewDocs = selectedNewDocs
      selectAllNew = selectedNewDocs.size === filteredNewDocs.length && filteredNewDocs.length > 0
    } else {
      if (selectedUpdatedDocs.has(docId)) {
        selectedUpdatedDocs.delete(docId)
      } else {
        selectedUpdatedDocs.add(docId)
      }
      selectedUpdatedDocs = selectedUpdatedDocs
      selectAllUpdated = selectedUpdatedDocs.size === filteredUpdatedDocs.length && filteredUpdatedDocs.length > 0
    }
  }

  const handleBulkShare = async () => {
    const selectedDocs = [
      ...Array.from(selectedNewDocs).map((docId) => ({
        docId,
        docTitle: filteredNewDocs.find((d) => d.docId === docId)?.docTitle || "",
      })),
      ...Array.from(selectedUpdatedDocs).map((docId) => ({
        docId,
        docTitle: filteredUpdatedDocs.find((d) => d.docId === docId)?.docTitle || "",
      })),
    ]

    if (selectedDocs.length === 0) {
      showMessage(pluginInstance.i18n.incrementalShare.noSelection, 3000, "error")
      return
    }

    isLoading = true
    try {
      const result = await pluginInstance.incrementalShareService.bulkShareDocuments(selectedDocs)

      if (result.successCount > 0) {
        showMessage(
          `${pluginInstance.i18n.incrementalShare.shareSuccess}: ${result.successCount} ${
            pluginInstance.i18n.incrementalShare.documents
          }`,
          3000,
          "info"
        )
        await loadDocuments()
        selectedNewDocs.clear()
        selectedUpdatedDocs.clear()
        selectAllNew = false
        selectAllUpdated = false
      }

      if (result.failedCount > 0) {
        showMessage(
          `${pluginInstance.i18n.incrementalShare.shareFailed}: ${result.failedCount} ${
            pluginInstance.i18n.incrementalShare.documents
          }`,
          7000,
          "error"
        )
      }
    } catch (error) {
      logger.error("批量分享失败:", error)
      showMessage(pluginInstance.i18n.incrementalShare.shareError, 7000, "error")
    } finally {
      isLoading = false
    }
  }

  const toggleGroup = (group: keyof typeof expandedGroups) => {
    expandedGroups[group] = !expandedGroups[group]
    expandedGroups = expandedGroups
  }

  $: if (changeDetectionResult) updateFilteredResults()
</script>

<div class="incremental-share-ui">
  <div class="share-header">
    <h3>{pluginInstance.i18n.incrementalShare.title}</h3>
    <div class="header-actions">
      <input
        type="text"
        class="b3-text-field"
        placeholder={pluginInstance.i18n.incrementalShare.searchPlaceholder}
        bind:value={searchTerm}
        on:input={handleSearch}
      />
      <button
        class="btn-primary"
        on:click={handleBulkShare}
        disabled={isLoading || selectedNewDocs.size + selectedUpdatedDocs.size === 0}
      >
        {@html icons.iconBulk}
        {pluginInstance.i18n.incrementalShare.bulkShare}
        ({selectedNewDocs.size + selectedUpdatedDocs.size})
      </button>
      <button class="btn-default" on:click={loadDocuments} disabled={isLoading}>
        {@html icons.iconRefresh}
        {pluginInstance.i18n.incrementalShare.refresh}
      </button>
    </div>
  </div>

  {#if isLoading}
    <div class="loading">
      <div class="spinner" />
      <span>{pluginInstance.i18n.incrementalShare.loading}</span>
    </div>
  {:else if changeDetectionResult}
    <div class="share-stats">
      <div class="stat-item">
        <span class="stat-number">{changeDetectionResult.newDocuments.length}</span>
        <span class="stat-label">{pluginInstance.i18n.incrementalShare.newDocuments}</span>
      </div>
      <div class="stat-item">
        <span class="stat-number">{changeDetectionResult.updatedDocuments.length}</span>
        <span class="stat-label">{pluginInstance.i18n.incrementalShare.updatedDocuments}</span>
      </div>
      <div class="stat-item">
        <span class="stat-number">{changeDetectionResult.unchangedDocuments.length}</span>
        <span class="stat-label">{pluginInstance.i18n.incrementalShare.unchangedDocuments}</span>
      </div>
      <div class="stat-item blacklisted">
        <span class="stat-number">{changeDetectionResult.blacklistedCount || 0}</span>
        <span class="stat-label">{pluginInstance.i18n.incrementalShare.blacklistedDocuments}</span>
      </div>
    </div>

    <div class="document-groups">
      <!-- 新增文档 -->
      <div class="document-group">
        <div class="group-header" on:click={() => toggleGroup("newDocuments")}>
          <span class="group-title">
            {@html expandedGroups.newDocuments ? icons.iconChevronDown : icons.iconChevronRight}
            {pluginInstance.i18n.incrementalShare.newDocumentsGroup}
            <span class="group-count">({filteredNewDocs.length})</span>
          </span>
          {#if filteredNewDocs.length > 0}
            <label class="select-all">
              <input type="checkbox" bind:checked={selectAllNew} on:change={handleSelectAllNew} />
              {pluginInstance.i18n.incrementalShare.selectAll}
            </label>
          {/if}
        </div>
        {#if expandedGroups.newDocuments}
          <div class="group-content">
            {#if filteredNewDocs.length === 0}
              <div class="empty-message">
                {pluginInstance.i18n.incrementalShare.noNewDocuments}
              </div>
            {:else}
              <!-- 使用虚拟滚动 -->
              <div class="virtual-list-container" style="height: {Math.min(filteredNewDocs.length, MAX_VISIBLE_ITEMS) * ITEM_HEIGHT}px;">
                <VirtualList items={filteredNewDocs} let:item height="{Math.min(filteredNewDocs.length, MAX_VISIBLE_ITEMS) * ITEM_HEIGHT}px">
                  <div class="document-item">
                    <label class="document-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedNewDocs.has(item.docId)}
                        on:change={() => toggleDocSelection(item.docId, "new")}
                      />
                      <span class="document-title">{item.docTitle}</span>
                    </label>
                    <span class="document-time">{formatTime(item.shareTime)}</span>
                  </div>
                </VirtualList>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- 更新文档 -->
      <div class="document-group">
        <div class="group-header" on:click={() => toggleGroup("updatedDocuments")}>
          <span class="group-title">
            {@html expandedGroups.updatedDocuments ? icons.iconChevronDown : icons.iconChevronRight}
            {pluginInstance.i18n.incrementalShare.updatedDocumentsGroup}
            <span class="group-count">({filteredUpdatedDocs.length})</span>
          </span>
          {#if filteredUpdatedDocs.length > 0}
            <label class="select-all">
              <input type="checkbox" bind:checked={selectAllUpdated} on:change={handleSelectAllUpdated} />
              {pluginInstance.i18n.incrementalShare.selectAll}
            </label>
          {/if}
        </div>
        {#if expandedGroups.updatedDocuments}
          <div class="group-content">
            {#if filteredUpdatedDocs.length === 0}
              <div class="empty-message">
                {pluginInstance.i18n.incrementalShare.noUpdatedDocuments}
              </div>
            {:else}
              <!-- 使用虚拟滚动 -->
              <div class="virtual-list-container" style="height: {Math.min(filteredUpdatedDocs.length, MAX_VISIBLE_ITEMS) * ITEM_HEIGHT}px;">
                <VirtualList items={filteredUpdatedDocs} let:item height="{Math.min(filteredUpdatedDocs.length, MAX_VISIBLE_ITEMS) * ITEM_HEIGHT}px">
                  <div class="document-item">
                    <label class="document-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedUpdatedDocs.has(item.docId)}
                        on:change={() => toggleDocSelection(item.docId, "updated")}
                      />
                      <span class="document-title">{item.docTitle}</span>
                    </label>
                    <span class="document-time">
                      {pluginInstance.i18n.incrementalShare.lastShared}: {formatTime(item.shareTime)}
                    </span>
                  </div>
                </VirtualList>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- 未变更文档 -->
      <div class="document-group">
        <div class="group-header" on:click={() => toggleGroup("unchangedDocuments")}>
          <span class="group-title">
            {@html expandedGroups.unchangedDocuments ? icons.iconChevronDown : icons.iconChevronRight}
            {pluginInstance.i18n.incrementalShare.unchangedDocumentsGroup}
            <span class="group-count">({filteredUnchangedDocs.length})</span>
          </span>
        </div>
        {#if expandedGroups.unchangedDocuments}
          <div class="group-content">
            {#if filteredUnchangedDocs.length === 0}
              <div class="empty-message">
                {pluginInstance.i18n.incrementalShare.noUnchangedDocuments}
              </div>
            {:else}
              <!-- 使用虚拟滚动 -->
              <div class="virtual-list-container" style="height: {Math.min(filteredUnchangedDocs.length, MAX_VISIBLE_ITEMS) * ITEM_HEIGHT}px;">
                <VirtualList items={filteredUnchangedDocs} let:item height="{Math.min(filteredUnchangedDocs.length, MAX_VISIBLE_ITEMS) * ITEM_HEIGHT}px">
                  <div class="document-item no-select">
                    <span class="document-title">{item.docTitle}</span>
                    <span class="document-time">
                      {pluginInstance.i18n.incrementalShare.lastShared}: {formatTime(item.shareTime)}
                    </span>
                  </div>
                </VirtualList>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <div class="empty-state">
      {pluginInstance.i18n.incrementalShare.noData}
    </div>
  {/if}
</div>

<style>
  .incremental-share-ui {
    padding: 16px;
    font-family: var(--b3-font-family);
  }

  .share-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--b3-border-color);
  }

  .share-header h3 {
    margin: 0;
    color: var(--b3-theme-on-background);
  }

  .header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .b3-text-field {
    width: 200px;
  }

  .header-actions button {
    padding: 3px 10px;
    font-size: 13px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    flex-shrink: 0;
    height: 26px;
    line-height: 20px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  /* 主要按钮 - 批量分享 */
  .header-actions .btn-primary {
    color: #ffffff;
    background-color: #0073e6;
  }

  .header-actions .btn-primary:hover:not(:disabled) {
    background-color: #005bb5;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .header-actions .btn-primary:active:not(:disabled) {
    background-color: #004999;
    transform: translateY(1px);
  }

  .header-actions .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background-color: #d9d9d9;
    color: rgba(0, 0, 0, 0.5);
  }

  /* 次要按钮 - 刷新 */
  .header-actions .btn-default {
    color: rgba(0, 0, 0, 0.88);
    background-color: #ffffff;
    border: 1px solid #d9d9d9;
  }

  .header-actions .btn-default:hover:not(:disabled) {
    color: #0073e6;
    border-color: #0073e6;
  }

  .header-actions .btn-default:active:not(:disabled) {
    color: #005bb5;
    border-color: #005bb5;
  }

  .header-actions .btn-default:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    color: rgba(0, 0, 0, 0.25);
    background-color: rgba(0, 0, 0, 0.04);
    border-color: #d9d9d9;
  }

  /* 暗黑模式 */
  html[data-theme-mode="dark"] .header-actions .btn-primary {
    background-color: #177ddc;
  }

  html[data-theme-mode="dark"] .header-actions .btn-primary:hover:not(:disabled) {
    background-color: #1765ad;
  }

  html[data-theme-mode="dark"] .header-actions .btn-primary:disabled {
    background-color: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.5);
  }

  html[data-theme-mode="dark"] .header-actions .btn-default {
    color: rgba(255, 255, 255, 0.85);
    background-color: transparent;
    border-color: #434343;
  }

  html[data-theme-mode="dark"] .header-actions .btn-default:hover:not(:disabled) {
    color: #177ddc;
    border-color: #177ddc;
  }

  html[data-theme-mode="dark"] .header-actions .btn-default:disabled {
    color: rgba(255, 255, 255, 0.3);
    background-color: rgba(255, 255, 255, 0.08);
    border-color: #434343;
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
    gap: 12px;
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid var(--b3-border-color);
    border-top: 2px solid var(--b3-theme-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .share-stats {
    display: flex;
    gap: 24px;
    margin-bottom: 20px;
    padding: 16px;
    background: var(--b3-theme-surface);
    border-radius: 8px;
    border: 1px solid var(--b3-border-color);
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 80px;
  }

  .stat-item.blacklisted {
    color: var(--b3-theme-error);
  }

  .stat-number {
    font-size: 24px;
    font-weight: bold;
    color: var(--b3-theme-primary);
  }

  .stat-label {
    font-size: 12px;
    color: var(--b3-theme-on-surface);
    margin-top: 4px;
  }

  .document-groups {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .document-group {
    border: 1px solid var(--b3-border-color);
    border-radius: 8px;
    overflow: hidden;
  }

  .group-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: var(--b3-theme-surface);
    cursor: pointer;
    user-select: none;
  }

  .group-header:hover {
    background: var(--b3-theme-surface-light);
  }

  .group-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
    color: var(--b3-theme-on-background);
  }

  .group-count {
    color: var(--b3-theme-on-surface);
    font-size: 14px;
  }

  .select-all {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    cursor: pointer;
  }

  .group-content {
    padding: 0;
  }

  .virtual-list-container {
    width: 100%;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .document-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--b3-border-color);
    transition: background-color 0.2s;
  }

  .document-item:hover {
    background: var(--b3-theme-surface-light);
  }

  .document-item:last-child {
    border-bottom: none;
  }

  .document-item.no-select {
    padding-left: 40px;
  }

  .document-checkbox {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    flex: 1;
  }

  .document-title {
    font-size: 14px;
    color: var(--b3-theme-on-background);
  }

  .document-time {
    font-size: 12px;
    color: var(--b3-theme-on-surface);
  }

  .empty-message {
    padding: 20px;
    text-align: center;
    color: var(--b3-theme-on-surface);
    font-size: 14px;
  }

  .empty-state {
    padding: 40px;
    text-align: center;
    color: var(--b3-theme-on-surface);
    font-size: 16px;
  }
</style>
