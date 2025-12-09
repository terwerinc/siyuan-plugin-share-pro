<script lang="ts">
  import { Dialog, showMessage } from "siyuan"
  import { onMount } from "svelte"
  import { simpleLogger } from "zhi-lib-base"
  import { isDev } from "../../../Constants"
  import ShareProPlugin from "../../../index"
  import { LocalBlacklistService } from "../../../service/LocalBlacklistService"
  import type { AddBlacklistRequest, BlacklistDTO, BlacklistType } from "../../../types"

  const logger = simpleLogger("blacklist-setting", "share-pro", isDev)
  export let pluginInstance: ShareProPlugin
  export let dialog: Dialog

  let blacklistService: LocalBlacklistService
  let isLoading = false
  let blacklistItems: BlacklistDTO[] = []
  let filteredItems: BlacklistDTO[] = []
  let selectedItems = new Set<number>()
  let showAddForm = false

  // 分页状态
  let currentPage = 0
  let pageSize = 10
  let totalPages = 0
  let totalItems = 0

  // 搜索筛选
  let searchTerm = ""
  let filterType: "all" | "NOTEBOOK" | "DOCUMENT" = "all"
  let searchTimeout: any = null

  // 统一的数据加载方法
  const loadData = async () => {
    isLoading = true
    try {
      // 将前端的filterType转换为后端需要的类型
      const backendType = filterType === "all" ? "all" : 
                         filterType === "NOTEBOOK" ? "notebook" : "document"

      // 统一调用后端接口，同时处理类型筛选和搜索
      totalItems = await blacklistService.getItemsCount(backendType, searchTerm)
      totalPages = Math.ceil(totalItems / pageSize)
      const results = await blacklistService.getItemsPaged(currentPage, pageSize, backendType, searchTerm)
      
      // 转换为 DTO 格式
      blacklistItems = results.map((item) => ({
        id: 0,
        type: item.type === "notebook" ? "NOTEBOOK" : "DOCUMENT",
        targetId: item.id,
        targetName: item.name,
        note: item.note,
        createdAt: new Date(item.addedTime).toISOString(),
        updatedAt: new Date(item.addedTime).toISOString(),
      }))

      updateFilteredResults()
      logger.info("黑名单数据加载完成，共" + totalItems + "项")
    } catch (error) {
      logger.error("加载黑名单数据失败:", error)
      showMessage("加载黑名单数据失败", 7000, "error")
    } finally {
      isLoading = false
    }
  }

  // 加载黑名单（从本地存储）- 保持向后兼容
  const loadBlacklist = async () => {
    await loadData()
  }

  // 搜索黑名单 - 保持向后兼容
  const searchBlacklist = async () => {
    if (!searchTerm.trim()) {
      // 如果搜索词为空，重新加载所有数据
      currentPage = 0
    }
    await loadData()
  }

  // 添加表单
  let formData = {
    targetName: "",
    type: "DOCUMENT" as BlacklistType,
    targetId: "",
    note: "",
  }

  // 智能搜索相关
  let searchKeyword = ""
  let searchResults: Array<{id: string, name: string}> = []
  let showSearchDropdown = false
  let isSearching = false

  onMount(async () => {
    blacklistService = new LocalBlacklistService(pluginInstance, pluginInstance.settingService)
    await loadBlacklist()
  })

  // 更新过滤结果
  const updateFilteredResults = () => {
    let items = blacklistItems

    // 类型筛选
    if (filterType !== "all") {
      items = items.filter((item) => item.type === filterType)
    }

    // 搜索过滤
    if (searchTerm) {
      items = items.filter(
        (item) =>
          item.targetName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.targetId.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.note?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // 分页
    const start = currentPage * pageSize
    const end = start + pageSize
    filteredItems = items.slice(start, end)
    totalPages = Math.ceil(items.length / pageSize)
  }

  // 处理搜索输入变化
  const handleSearchInput = () => {
    // 防抖搜索
    if (searchTimeout) {
      clearTimeout(searchTimeout)
    }
    
    searchTimeout = setTimeout(() => {
      currentPage = 0 // 重置到第一页
      if (searchTerm.trim()) {
        searchBlacklist()
      } else {
        loadBlacklist()
      }
    }, 300)
  }

  // 处理分页变化
  const handlePageChange = (newPage: number) => {
    if (newPage < 0 || newPage >= totalPages) return
    currentPage = newPage
    
    if (searchTerm.trim()) {
      searchBlacklist()
    } else {
      loadBlacklist()
    }
  }

  // 显示添加表单
  const showAddFormFn = () => {
    formData = {
      targetName: "",
      type: "DOCUMENT",
      targetId: "",
      note: "",
    }
    searchResults = []
    showSearchDropdown = false
    showAddForm = true
  }

  // 取消添加
  const cancelAdd = () => {
    showAddForm = false
  }

  // 添加黑名单项
  const handleAddItem = async () => {
    if (!formData.targetName.trim()) {
      showMessage(pluginInstance.i18n.incrementalShare.blacklist.nameRequired, 3000, "error")
      return
    }

    if (!formData.targetId.trim()) {
      showMessage(pluginInstance.i18n.incrementalShare.blacklist.targetIdRequired, 3000, "error")
      return
    }

    isLoading = true
    try {
      const request: AddBlacklistRequest = {
        type: formData.type,
        targetId: formData.targetId.trim(),
        targetName: formData.targetName.trim(),
        note: formData.note.trim() || undefined,
      }

      // 调用本地黑名单服务
      await blacklistService.addItem({
        id: request.targetId,
        name: request.targetName,
        type: request.type === "NOTEBOOK" ? "notebook" : "document",
        addedTime: Date.now(),
        note: request.note,
      })

      showMessage(pluginInstance.i18n.incrementalShare.blacklist.addSuccess, 3000, "info")
      showAddForm = false
      await loadBlacklist()
    } catch (error) {
      logger.error("添加黑名单项失败:", error)
      showMessage(pluginInstance.i18n.incrementalShare.blacklist.addError, 7000, "error")
    } finally {
      isLoading = false
    }
  }

  // 删除选中项
  const handleDeleteItems = async () => {
    if (selectedItems.size === 0) {
      showMessage(pluginInstance.i18n.incrementalShare.blacklist.noSelection, 3000, "error")
      return
    }

    const confirmed = confirm(
      pluginInstance.i18n.incrementalShare.blacklist.deleteConfirm ||
        `确定要删除选中的 ${selectedItems.size} 个项目吗？`
    )
    if (!confirmed) return

    isLoading = true
    try {
      // 调用本地黑名单服务
      for (const item of filteredItems) {
        if (selectedItems.has(item.id)) {
          await blacklistService.removeItem(item.targetId)
        }
      }

      showMessage(pluginInstance.i18n.incrementalShare.blacklist.deleteSuccess, 3000, "info")
      selectedItems.clear()
      selectedItems = selectedItems
      await loadBlacklist()
    } catch (error) {
      logger.error("删除黑名单项失败:", error)
      showMessage(pluginInstance.i18n.incrementalShare.blacklist.deleteError, 7000, "error")
    } finally {
      isLoading = false
    }
  }

  // 切换选中状态
  const toggleItemSelection = (itemId: number) => {
    if (selectedItems.has(itemId)) {
      selectedItems.delete(itemId)
    } else {
      selectedItems.add(itemId)
    }
    selectedItems = selectedItems
  }

  // 搜索处理
  const handleSearch = () => {
    currentPage = 0
    loadData()
  }

  // 筛选处理
  const handleFilter = () => {
    currentPage = 0
    loadData()
  }

  // 获取类型标签
  const getTypeLabel = (type: BlacklistType) => {
    return type === "NOTEBOOK"
      ? pluginInstance.i18n.incrementalShare.blacklist.notebook
      : pluginInstance.i18n.incrementalShare.blacklist.document
  }

  // 格式化时间
  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("zh-CN")
    } catch (error) {
      return dateStr
    }
  }

  // 搜索文档或笔记本
  const searchTargets = async () => {
    if (!searchKeyword.trim()) {
      searchResults = []
      showSearchDropdown = false
      return
    }

    isSearching = true
    try {
      if (formData.type === "DOCUMENT") {
        // 搜索文档
        searchResults = await blacklistService.searchDocuments(searchKeyword)
      } else {
        // 搜索笔记本
        searchResults = await blacklistService.searchNotebooks(searchKeyword)
      }
      showSearchDropdown = searchResults.length > 0
    } catch (error) {
      logger.error("搜索失败:", error)
      searchResults = []
      showSearchDropdown = false
    } finally {
      isSearching = false
    }
  }

  // 选择搜索结果
  const selectSearchResult = (item: {id: string, name: string}) => {
    formData.targetId = item.id
    formData.targetName = item.name
    searchResults = []
    showSearchDropdown = false
    searchKeyword = item.name
  }

  const onCancel = () => {
    dialog.destroy()
  }
  
  // 当类型改变时清空搜索结果
  const handleTypeChange = () => {
    searchResults = []
    showSearchDropdown = false
    searchKeyword = ""
    formData.targetId = ""
    formData.targetName = ""
  }
</script>

<div>
  <div class="config__tab-container">
    <!-- 搜索和筛选 -->
    <div class="fn__block form-item">
      <div class="search-filter-row">
        <input
          class="b3-text-field"
          style="flex: 1; min-width: 150px;"
          placeholder={pluginInstance.i18n.incrementalShare.blacklist.searchPlaceholder}
          bind:value={searchTerm}
          on:input={handleSearchInput}
        />
        <select class="b3-select" style="width: 120px;" bind:value={filterType} on:change={handleFilter}>
          <option value="all">{pluginInstance.i18n.incrementalShare.blacklist.allTypes}</option>
          <option value="NOTEBOOK">{pluginInstance.i18n.incrementalShare.blacklist.notebook}</option>
          <option value="DOCUMENT">{pluginInstance.i18n.incrementalShare.blacklist.document}</option>
        </select>
        {#if !showAddForm}
          <button class="b3-button b3-button--primary" style="white-space: nowrap;" on:click={showAddFormFn} disabled={isLoading}>
            {pluginInstance.i18n.incrementalShare.blacklist.add}
          </button>
        {/if}
        {#if selectedItems.size > 0}
          <button class="b3-button b3-button--cancel" style="white-space: nowrap;" on:click={handleDeleteItems} disabled={isLoading}>
            {pluginInstance.i18n.incrementalShare.blacklist.delete} ({selectedItems.size})
          </button>
        {/if}
      </div>
    </div>

    <!-- 添加表单（展开式） -->
    {#if showAddForm}
      <div class="fn__block form-item add-form-block">
        <div class="add-form-header">
          <span style="flex: 1;">{pluginInstance.i18n.incrementalShare.blacklist.addItem}</span>
          <button class="b3-button b3-button--error" on:click={cancelAdd}>
            {pluginInstance.i18n.incrementalShare.blacklist.cancel}
          </button>
        </div>
        <span class="fn__hr" />
        <div class="add-form-content">
          <div class="form-row">
            <div class="form-col">
              <label
                >{pluginInstance.i18n.incrementalShare.blacklist.type}
                <span style="color:red">*</span></label
              >
              <select class="b3-select fn__block" bind:value={formData.type} on:change={handleTypeChange}>
                <option value="DOCUMENT">{pluginInstance.i18n.incrementalShare.blacklist.document}</option>
                <option value="NOTEBOOK"
                  >{pluginInstance.i18n.incrementalShare.blacklist.notebook}</option
                >
              </select>
            </div>
            <div class="form-col">
              <label
                >{pluginInstance.i18n.incrementalShare.blacklist.targetName}
                <span style="color:red">*</span></label
              >
              <div class="search-input-container">
                <input
                  class="b3-text-field fn__block"
                  bind:value={searchKeyword}
                  placeholder={pluginInstance.i18n.incrementalShare.blacklist.targetNamePlaceholder}
                  on:input={searchTargets}
                />
                {#if isSearching}
                  <div class="search-loading">搜索中...</div>
                {/if}
                {#if showSearchDropdown}
                  <div class="search-dropdown">
                    {#each searchResults as item}
                      <div class="dropdown-item" on:click={() => selectSearchResult(item)}>
                        {item.name}
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
              <!-- 隐藏的实际值 -->
              <input type="hidden" bind:value={formData.targetId} />
              <input type="hidden" bind:value={formData.targetName} />
            </div>
          </div>
          <div class="form-row">
            <div class="form-col">
              <label>{pluginInstance.i18n.incrementalShare.blacklist.note}</label>
              <input
                class="b3-text-field fn__block"
                bind:value={formData.note}
                placeholder={pluginInstance.i18n.incrementalShare.blacklist.notePlaceholder}
              />
            </div>
          </div>
          <div class="form-actions">
            <button class="b3-button b3-button--primary" on:click={handleAddItem} disabled={isLoading || !formData.targetId}>
              {pluginInstance.i18n.incrementalShare.blacklist.confirmAdd}
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- 黑名单列表 -->
    <div class="fn__block form-item">
      <div class="b3-label__text form-item-tip">
        {pluginInstance.i18n.incrementalShare.blacklist.manageTip}（共 {totalItems}
        项）
      </div>
      <span class="fn__hr" />

      {#if isLoading}
        <div class="blacklist-loading">加载中...</div>
      {:else if filteredItems.length > 0}
        <div class="blacklist-table">
          <table class="b3-list">
            <thead>
              <tr>
                <th style="width: 40px;"><input type="checkbox" /></th>
                <th>{pluginInstance.i18n.incrementalShare.blacklist.targetName}</th>
                <th style="width: 120px;">{pluginInstance.i18n.incrementalShare.blacklist.type}</th>
                <th>{pluginInstance.i18n.incrementalShare.blacklist.note}</th>
                <th style="width: 150px;"
                  >{pluginInstance.i18n.incrementalShare.blacklist.createdAt}</th
                >
              </tr>
            </thead>
            <tbody>
              {#each filteredItems as item}
                <tr>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.id)}
                      on:change={() => toggleItemSelection(item.id)}
                    />
                  </td>
                  <td>
                    <div class="item-name">{item.targetName}</div>
                    <div class="item-id">{item.targetId}</div>
                  </td>
                  <td><span class="type-badge">{getTypeLabel(item.type)}</span></td>
                  <td class="item-note">{item.note || "-"}</td>
                  <td class="item-time">{formatTime(item.createdAt)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- 分页 -->
        {#if totalPages > 1}
          <div class="pagination-row">
            <button
              class="b3-button b3-button--outline"
              disabled={currentPage === 0 || isLoading}
              on:click={() => handlePageChange(currentPage - 1)}
            >
              {pluginInstance.i18n.incrementalShare.blacklist.prevPage}
            </button>
            <span class="page-info">
              第 {currentPage + 1} / {totalPages} 页
            </span>
            <button
              class="b3-button b3-button--outline"
              disabled={currentPage >= totalPages - 1 || isLoading}
              on:click={() => handlePageChange(currentPage + 1)}
            >
              {pluginInstance.i18n.incrementalShare.blacklist.nextPage}
            </button>
          </div>
        {/if}
      {:else}
        <div class="blacklist-empty">
          {pluginInstance.i18n.incrementalShare.blacklist.noItems}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .config__tab-container{
      overflow: hidden;
  }

  .form-item {
    padding: 10px;
    width: 100%;
    margin: auto;
    font-size: 14px;
    box-sizing: border-box;
  }

  .form-item-tip {
    font-size: 12px !important;
    color: var(--b3-theme-on-background);
  }

  /* 搜索筛选行 */
  .search-filter-row {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-bottom: 12px;
    flex-wrap: wrap; /* 允许换行以适应小屏幕 */
  }
  
  @media screen and (max-width: 768px) {
    .search-filter-row {
      flex-direction: column;
      align-items: stretch;
    }
    
    .search-filter-row > * {
      margin-bottom: 8px;
    }
  }

  /* 添加表单区域 */
  .add-form-block {
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    padding: 16px;
    margin-bottom: 16px;
  }

  .add-form-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    font-weight: 500;
    min-height: 32px; /* 确保有足够的高度显示内容 */
    width: 100%;
  }
  
  .add-form-header button {
    flex-shrink: 0; /* 防止按钮被压缩 */
  }

  .add-form-content {
    margin-top: 12px;
  }

  .form-row {
    display: flex;
    gap: 12px;
    margin-bottom: 12px;
  }

  .form-col {
    flex: 1;
    position: relative;
  }

  .form-col label {
    display: block;
    margin-bottom: 6px;
    font-size: 13px;
  }

  .form-actions {
    margin-top: 12px;
    text-align: right;
  }

  /* 搜索输入框容器 */
  .search-input-container {
    position: relative;
  }

  /* 搜索加载状态 */
  .search-loading {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    padding: 8px 12px;
    z-index: 1000;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  /* 搜索下拉框 */
  .search-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    max-height: 200px;
    overflow-y: auto;
    z-index: 1000;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .dropdown-item {
    padding: 8px 12px;
    cursor: pointer;
    border-bottom: 1px solid var(--b3-border-color);
  }

  .dropdown-item:hover {
    background: var(--b3-theme-surface-light);
  }

  .dropdown-item:last-child {
    border-bottom: none;
  }

  /* 表格样式 */
  .blacklist-loading {
    text-align: center;
    padding: 40px;
    color: var(--b3-theme-on-surface);
  }

  .blacklist-table {
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    margin-bottom: 12px;
  }

  .blacklist-table table {
    width: 100%;
    border-collapse: collapse;
  }

  .blacklist-table th {
    background: var(--b3-theme-surface);
    color: var(--b3-theme-on-surface);
    font-weight: 500;
    text-align: left;
    padding: 10px 12px;
    border-bottom: 1px solid var(--b3-border-color);
    font-size: 13px;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .blacklist-table td {
    padding: 10px 12px;
    border-bottom: 1px solid var(--b3-border-color);
    font-size: 13px;
  }

  .blacklist-table tbody tr:hover {
    background: var(--b3-theme-surface-light);
  }

  .item-name {
    font-weight: 500;
    margin-bottom: 4px;
  }

  .item-id {
    font-size: 11px;
    color: var(--b3-theme-on-surface);
    font-family: monospace;
  }

  .type-badge {
    padding: 3px 10px;
    border-radius: 10px;
    font-size: 12px;
    background: var(--b3-theme-primary);
    color: white;
    display: inline-block;
  }

  .item-note {
    color: var(--b3-theme-on-surface);
    font-size: 12px;
  }

  .item-time {
    color: var(--b3-theme-on-surface);
    font-size: 12px;
  }

  .blacklist-empty {
    text-align: center;
    padding: 40px 20px;
    color: var(--b3-theme-on-surface);
  }

  /* 分页 */
  .pagination-row {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    padding: 12px 0;
  }

  .page-info {
    font-size: 13px;
    color: var(--b3-theme-on-surface);
  }
</style>