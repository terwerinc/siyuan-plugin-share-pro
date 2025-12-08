<!--
  -            GNU GENERAL PUBLIC LICENSE
  -               Version 3, 29 June 2007
  -
  -  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
  -  Everyone is permitted to copy and distribute verbatim copies
  -  of this license document, but changing it is not allowed.
  -->

<script lang="ts">
  import VirtualList from "@sveltejs/svelte-virtual-list"
  import { showMessage } from "siyuan"
  import { onMount } from "svelte"
  import { simpleLogger } from "zhi-lib-base"
  import { getDocumentsCount, getDocumentsPaged, useSiyuanApi } from "../../composables/useSiyuanApi"
  import { isDev } from "../../Constants"
  import ShareProPlugin from "../../index"
  import { ShareProConfig } from "../../models/ShareProConfig"
  import type { ChangeDetectionResult } from "../../service/IncrementalShareService"
  import { icons } from "../../utils/svg"

  export let pluginInstance: ShareProPlugin
  export let config: ShareProConfig

  const logger = simpleLogger("incremental-share-ui", "share-pro", isDev)
  let isLoading = false
  let changeDetectionResult: ChangeDetectionResult | null = null
  let selectedDocs = new Set<string>()
  let searchTerm = ""
  
  // 统一的文档列表（新文档和更新文档合并）
  let combinedDocs: Array<{docId: string, docTitle: string, shareTime?: number, type: "new" | "updated"}> = []
  let filteredDocs: Array<{docId: string, docTitle: string, shareTime?: number, type: "new" | "updated"}> = []
  let selectAll = false
  
  // 分页相关状态
  let currentPage = 0
  let pageSize = 5 // 每页显示5条记录
  let totalDocuments = 0
  let totalPages = 0
  let hasMoreDocuments = true
  
  // 虚拟滚动配置
  const ITEM_HEIGHT = 45 // 每个文档项的高度（像素）
  const MAX_VISIBLE_ITEMS = 5 // 每页显示的最大项数
  
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
    await loadDocuments()
  })

  const loadDocuments = async () => {
    isLoading = true
    try {
      // 获取思源 API
      const { kernelApi } = useSiyuanApi(config)
      
      // 获取上次分享时间戳（用于增量检测）
      const lastShareTime = config.appConfig?.incrementalShareConfig?.lastShareTime
      
      // 获取文档总数（用于显示进度）
      totalDocuments = await getDocumentsCount(kernelApi, lastShareTime)
      totalPages = Math.ceil(totalDocuments / pageSize)
      logger.info(`文档总数: ${totalDocuments}, 总页数: ${totalPages}`)
      
      // 重置分页状态
      currentPage = 0
      hasMoreDocuments = true
      changeDetectionResult = {
        newDocuments: [],
        updatedDocuments: [],
        unchangedDocuments: [],
        blacklistedCount: 0,
      }
      
      // 加载第一页
      await loadDocumentsByPage(0)
      
      updateFilteredResults()
      logger.info("文档变更检测结果:", changeDetectionResult)
    } catch (error) {
      logger.error("加载文档失败:", error)
      showMessage(pluginInstance.i18n.incrementalShare.loadError, 7000, "error")
      
      // 在加载失败时使用mock数据
      useMockData()
    } finally {
      isLoading = false
    }
  }
  
  // 使用mock数据进行测试
  const useMockData = () => {
    logger.info("使用mock数据进行测试")
    
    // 生成mock的新文档数据
    const mockNewDocuments: any = Array.from({ length: 25 }, (_, i) => ({
      docId: `new-doc-${i + 1}`,
      docTitle: `Mock 新增文档 ${i + 1} - 测试数据`,
      modifiedTime: Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 24), // 随机在过去24小时内
      shareTime: 0,
      type: "new" as const,
      shareStatus: "pending" as const,
      docModifiedTime: Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 24)
    }))
    
    // 生成mock的更新文档数据
    const mockUpdatedDocuments: any = Array.from({ length: 15 }, (_, i) => ({
      docId: `updated-doc-${i + 1}`,
      docTitle: `Mock 更新文档 ${i + 1} - 内容已修改`,
      modifiedTime: Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 24), // 随机在过去24小时内
      shareTime: Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 24 * 7), // 随机在过去一周内分享
      type: "updated" as const,
      shareStatus: "success" as const,
      docModifiedTime: Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 24)
    }))
    
    // 设置mock数据
    changeDetectionResult = {
      newDocuments: mockNewDocuments,
      updatedDocuments: mockUpdatedDocuments,
      unchangedDocuments: [],
      blacklistedCount: 3,
    }
    
    // 更新分页信息
    totalDocuments = mockNewDocuments.length + mockUpdatedDocuments.length
    totalPages = Math.ceil(totalDocuments / pageSize)
    currentPage = 0
    
    updateFilteredResults()
    logger.info("已加载mock数据", changeDetectionResult)
  }
  
  // 新增：加载指定页码的文档
  const loadDocumentsByPage = async (pageNum: number) => {
    isLoading = true
    try {
      const { kernelApi } = useSiyuanApi(config)
      
      // 获取上次分享时间戳（用于增量检测）
      const lastShareTime = config.appConfig?.incrementalShareConfig?.lastShareTime
      
      // 使用分页检测方法，只加载指定页
      const pageResult = await pluginInstance.incrementalShareService.detectChangedDocumentsSinglePage(
        async (pageNum, size) => {
          return await getDocumentsPaged(kernelApi, pageNum, size, lastShareTime)
        },
        pageNum,
        pageSize,
        totalDocuments
      )
      
      // 更新结果
      changeDetectionResult = pageResult
      
      // 更新分页状态
      currentPage = pageNum
      
      updateFilteredResults()
    } catch (error) {
      logger.error("加载文档页失败:", error)
      showMessage(pluginInstance.i18n.incrementalShare.loadError, 7000, "error")
      
      // 在加载失败时使用mock数据
      useMockData()
    } finally {
      isLoading = false
    }
  }
  
  // 加载下一页文档
  const loadNextPage = async () => {
    if (currentPage < totalPages - 1) {
      await loadDocumentsByPage(currentPage + 1)
    }
  }
  
  // 加载上一页文档
  const loadPrevPage = async () => {
    if (currentPage > 0) {
      await loadDocumentsByPage(currentPage - 1)
    }
  }

  const updateFilteredResults = () => {
    if (!changeDetectionResult) return
    
    // 合并新文档和更新文档
    const allDocs = [
      ...changeDetectionResult.newDocuments.map(doc => ({...doc, type: "new" as const})),
      ...changeDetectionResult.updatedDocuments.map(doc => ({...doc, type: "updated" as const}))
    ]
    
    // 应用搜索过滤
    const filterDocs = (docs: any[]) => {
      if (!searchTerm) return docs
      return docs.filter((doc) => doc.docTitle.toLowerCase().includes(searchTerm.toLowerCase()))
    }
    
    combinedDocs = allDocs
    filteredDocs = filterDocs(allDocs)
  }

  const handleSearch = () => updateFilteredResults()

  const handleSelectAll = () => {
    if (selectAll) {
      filteredDocs.forEach((doc) => selectedDocs.add(doc.docId))
    } else {
      filteredDocs.forEach((doc) => selectedDocs.delete(doc.docId))
    }
    selectedDocs = selectedDocs
  }

  const toggleDocSelection = (docId: string) => {
    if (selectedDocs.has(docId)) {
      selectedDocs.delete(docId)
    } else {
      selectedDocs.add(docId)
    }
    selectedDocs = selectedDocs
    selectAll = selectedDocs.size === filteredDocs.length && filteredDocs.length > 0
  }

  const handleBulkShare = async () => {
    const selectedDocsArray = Array.from(selectedDocs).map(docId => {
      const doc = combinedDocs.find(d => d.docId === docId)
      return {
        docId,
        docTitle: doc?.docTitle || ""
      }
    }).filter(doc => doc.docTitle) // 过滤掉找不到的文档

    if (selectedDocsArray.length === 0) {
      showMessage(pluginInstance.i18n.incrementalShare.noSelection, 3000, "error")
      return
    }

    isLoading = true
    try {
      const result = await pluginInstance.incrementalShareService.bulkShareDocuments(selectedDocsArray)

      if (result.successCount > 0) {
        showMessage(
          `${pluginInstance.i18n.incrementalShare.shareSuccess}: ${result.successCount} ${
            pluginInstance.i18n.incrementalShare.documents
          }`,
          3000,
          "info"
        )
        await loadDocuments()
        selectedDocs.clear()
        selectAll = false
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

  $: if (changeDetectionResult) {
    updateFilteredResults()
  }
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
        disabled={isLoading || selectedDocs.size === 0}
      >
        {@html icons.iconBulk}
        {pluginInstance.i18n.incrementalShare.bulkShare}
        ({selectedDocs.size})
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

    <div class="document-section">
      <!-- 统一的文档列表 -->
      <div class="document-group">
        <div class="group-header">
          <span class="group-title">
            {pluginInstance.i18n.incrementalShare.documentsToShare}
            <span class="group-count">({filteredDocs.length})</span>
          </span>
          {#if filteredDocs.length > 0}
            <label class="select-all">
              <input type="checkbox" bind:checked={selectAll} on:change={handleSelectAll} />
              {pluginInstance.i18n.incrementalShare.selectAll}
            </label>
          {/if}
        </div>
        <div class="group-content">
          {#if filteredDocs.length === 0}
            <div class="empty-message">
              {pluginInstance.i18n.incrementalShare.noDocumentsToShare}
            </div>
          {:else}
            <!-- 使用虚拟滚动 -->
            <div class="virtual-list-container" 
                 style="height: {Math.min(filteredDocs.length, MAX_VISIBLE_ITEMS) * ITEM_HEIGHT}px;">
              <VirtualList items={filteredDocs} let:item height="{Math.min(filteredDocs.length, MAX_VISIBLE_ITEMS) * ITEM_HEIGHT}px">
                <div class="document-item">
                  <label class="document-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedDocs.has(item.docId)}
                      on:change={() => toggleDocSelection(item.docId)}
                    />
                    <span class="document-title">{item.docTitle}</span>
                  </label>
                  <div class="document-meta">
                    <span class={`document-type document-type--${item.type}`}>
                      {item.type === 'new' ? pluginInstance.i18n.incrementalShare.new : pluginInstance.i18n.incrementalShare.updated}
                    </span>
                    {#if item.shareTime}
                      <span class="document-time">
                        {pluginInstance.i18n.incrementalShare.lastShared}: {formatTime(item.shareTime)}
                      </span>
                    {/if}
                  </div>
                </div>
              </VirtualList>
            </div>
          {/if}
        </div>
      </div>

      <!-- 分页控件 -->
      {#if totalPages > 1}
        <div class="pagination-controls">
          <button 
            class="pagination-btn" 
            on:click={loadPrevPage} 
            disabled={currentPage === 0 || isLoading}
          >
            {@html icons.iconChevronLeft}
            {pluginInstance.i18n.incrementalShare.prevPage}
          </button>
          
          <div class="pagination-info">
            {pluginInstance.i18n.incrementalShare.page} {currentPage + 1} / {totalPages}
          </div>
          
          <button 
            class="pagination-btn" 
            on:click={loadNextPage} 
            disabled={currentPage === totalPages - 1 || isLoading}
          >
            {pluginInstance.i18n.incrementalShare.nextPage}
            {@html icons.iconChevronRight}
          </button>
        </div>
      {/if}
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

  .document-section {
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
    user-select: none;
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

  .document-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
  }

  .document-type {
    font-size: 12px;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 500;
  }

  .document-type--new {
    background-color: #e6ffec;
    color: #00b324;
  }

  .document-type--updated {
    background-color: #fff7e6;
    color: #fa8c16;
  }

  html[data-theme-mode="dark"] .document-type--new {
    background-color: #1f3a24;
    color: #65e48d;
  }

  html[data-theme-mode="dark"] .document-type--updated {
    background-color: #3a2a1f;
    color: #fabe8f;
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
  
  .pagination-controls {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    padding: 16px;
    background: var(--b3-theme-surface);
    border-top: 1px solid var(--b3-border-color);
  }
  
  .pagination-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid var(--b3-border-color);
    background: var(--b3-theme-background);
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    color: var(--b3-theme-on-background);
    transition: all 0.2s;
  }
  
  .pagination-btn:hover:not(:disabled) {
    background: var(--b3-theme-surface-light);
    border-color: var(--b3-theme-primary);
  }
  
  .pagination-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .pagination-info {
    font-size: 14px;
    color: var(--b3-theme-on-surface);
    min-width: 100px;
    text-align: center;
  }
</style>
