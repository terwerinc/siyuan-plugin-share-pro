<!--
  -            GNU GENERAL PUBLIC LICENSE
  -               Version 3, 29 June 2007
  -
  -  Copyright (C) 2024-2025 Terwer, Inc. <https://terwer.space/>
  -  Everyone is permitted to copy and distribute verbatim copies
  -  of this license document, but changing it is not allowed.
  -->

<script lang="ts">
  import { simpleLogger } from "zhi-lib-base"
  import { isDev } from "../../../Constants"
  import ShareProPlugin from "../../../index"
  import { Dialog, showMessage } from "siyuan"
  import { onMount } from "svelte"
  import { BlacklistService } from "../../../service/BlacklistService"
  import type { BlacklistDTO, BlacklistType, AddBlacklistRequest } from "../../../types"

  const logger = simpleLogger("blacklist-setting", "share-pro", isDev)
  export let pluginInstance: ShareProPlugin
  export let dialog: Dialog

  let blacklistService: BlacklistService
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

  // 添加表单
  let formData = {
    targetName: "",
    type: "DOCUMENT" as BlacklistType,
    targetId: "",
    note: "",
  }

  onMount(async () => {
    blacklistService = new BlacklistService(pluginInstance)
    await loadBlacklist()
  })

  // 加载黑名单（从 Java 后端）
  const loadBlacklist = async () => {
    isLoading = true
    try {
      // 调用 Java 后端 API
      const allItems = await blacklistService.getAllItems()

      // 转换为 DTO 格式
      blacklistItems = allItems.map((item) => ({
        id: item.dbId || 0,
        type: item.type === "notebook" ? "NOTEBOOK" : "DOCUMENT",
        targetId: item.id,
        targetName: item.name,
        note: item.note,
        createdAt: new Date(item.addedTime).toISOString(),
        updatedAt: new Date(item.addedTime).toISOString(),
      }))

      totalItems = blacklistItems.length
      totalPages = Math.ceil(totalItems / pageSize)

      updateFilteredResults()
      logger.info("黑名单加载完成，共" + totalItems + "项")
    } catch (error) {
      logger.error("加载黑名单失败:", error)
      showMessage("加载黑名单失败", 7000, "error")
    } finally {
      isLoading = false
    }
  }

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

  // 显示添加表单
  const showAddFormFn = () => {
    formData = {
      targetName: "",
      type: "DOCUMENT",
      targetId: "",
      note: "",
    }
    showAddForm = true
  }

  // 取消添加
  const cancelAdd = () => {
    showAddForm = false
  }

  // 添加黑名单项
  const handleAddItem = async () => {
    if (!formData.targetName.trim()) {
      showMessage(pluginInstance.i18n?.incrementalShare?.blacklist?.nameRequired || "请输入名称", 3000, "error")
      return
    }

    if (!formData.targetId.trim()) {
      showMessage(pluginInstance.i18n?.incrementalShare?.blacklist?.targetIdRequired || "请输入目标ID", 3000, "error")
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

      // 调用 Java 后端 API
      await blacklistService.addItem({
        id: request.targetId,
        name: request.targetName,
        type: request.type === "NOTEBOOK" ? "notebook" : "document",
        addedTime: Date.now(),
        note: request.note,
      })

      showMessage(pluginInstance.i18n?.incrementalShare?.blacklist?.addSuccess || "添加成功", 3000, "info")
      showAddForm = false
      await loadBlacklist()
    } catch (error) {
      logger.error("添加黑名单项失败:", error)
      showMessage(pluginInstance.i18n?.incrementalShare?.blacklist?.addError || "添加失败", 7000, "error")
    } finally {
      isLoading = false
    }
  }

  // 删除选中项
  const handleDeleteItems = async () => {
    if (selectedItems.size === 0) {
      showMessage(pluginInstance.i18n?.incrementalShare?.blacklist?.noSelection || "请选择要删除的项目", 3000, "error")
      return
    }

    const confirmed = confirm(
      pluginInstance.i18n?.incrementalShare?.blacklist?.deleteConfirm ||
        `确定要删除选中的 ${selectedItems.size} 个项目吗？`
    )
    if (!confirmed) return

    isLoading = true
    try {
      // 调用 Java 后端 API
      for (const dbId of selectedItems) {
        const item = blacklistItems.find((i) => i.id === dbId)
        if (item) {
          await blacklistService.removeItem(item.targetId)
        }
      }

      showMessage(pluginInstance.i18n?.incrementalShare?.blacklist?.deleteSuccess || "删除成功", 3000, "info")
      selectedItems.clear()
      selectedItems = selectedItems
      await loadBlacklist()
    } catch (error) {
      logger.error("删除黑名单项失败:", error)
      showMessage(pluginInstance.i18n?.incrementalShare?.blacklist?.deleteError || "删除失败", 7000, "error")
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

  // 分页处理
  const handlePageChange = async (page: number) => {
    currentPage = page
    updateFilteredResults()
  }

  // 搜索处理
  const handleSearch = () => {
    currentPage = 0
    updateFilteredResults()
  }

  // 筛选处理
  const handleFilter = () => {
    currentPage = 0
    updateFilteredResults()
  }

  // 获取类型标签
  const getTypeLabel = (type: BlacklistType) => {
    return type === "NOTEBOOK"
      ? pluginInstance.i18n?.incrementalShare?.blacklist?.notebook || "笔记本"
      : pluginInstance.i18n?.incrementalShare?.blacklist?.document || "文档"
  }

  // 格式化时间
  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("zh-CN")
    } catch (error) {
      return dateStr
    }
  }

  const onCancel = () => {
    dialog.destroy()
  }
</script>

<div>
  <div class="config__tab-container">
    <!-- 搜索和筛选 -->
    <div class="fn__block form-item">
      <div class="search-filter-row">
        <input
          class="b3-text-field"
          style="width: 200px;"
          placeholder={pluginInstance.i18n?.incrementalShare?.blacklist?.searchPlaceholder || "搜索名称/ID/备注..."}
          bind:value={searchTerm}
          on:input={handleSearch}
        />
        <select class="b3-select" style="width: 120px;" bind:value={filterType} on:change={handleFilter}>
          <option value="all">{pluginInstance.i18n?.incrementalShare?.blacklist?.allTypes || "全部类型"}</option>
          <option value="NOTEBOOK">{pluginInstance.i18n?.incrementalShare?.blacklist?.notebook || "笔记本"}</option>
          <option value="DOCUMENT">{pluginInstance.i18n?.incrementalShare?.blacklist?.document || "文档"}</option>
        </select>
        {#if !showAddForm}
          <button class="b3-button b3-button--outline" on:click={showAddFormFn} disabled={isLoading}>
            {pluginInstance.i18n?.incrementalShare?.blacklist?.add || "添加"}
          </button>
        {/if}
        {#if selectedItems.size > 0}
          <button class="b3-button b3-button--cancel" on:click={handleDeleteItems} disabled={isLoading}>
            {pluginInstance.i18n?.incrementalShare?.blacklist?.delete || "删除"} ({selectedItems.size})
          </button>
        {/if}
      </div>
    </div>

    <!-- 添加表单（展开式） -->
    {#if showAddForm}
      <div class="fn__block form-item add-form-block">
        <div class="add-form-header">
          <span>{pluginInstance.i18n?.incrementalShare?.blacklist?.addItem || "添加黑名单项"}</span>
          <button class="b3-button b3-button--cancel" on:click={cancelAdd}>
            {pluginInstance.i18n?.incrementalShare?.blacklist?.cancel || "取消"}
          </button>
        </div>
        <span class="fn__hr" />
        <div class="add-form-content">
          <div class="form-row">
            <div class="form-col">
              <label
                >{pluginInstance.i18n?.incrementalShare?.blacklist?.type || "类型"}
                <span style="color:red">*</span></label
              >
              <select class="b3-select fn__block" bind:value={formData.type}>
                <option value="DOCUMENT">{pluginInstance.i18n?.incrementalShare?.blacklist?.document || "文档"}</option>
                <option value="NOTEBOOK"
                  >{pluginInstance.i18n?.incrementalShare?.blacklist?.notebook || "笔记本"}</option
                >
              </select>
            </div>
            <div class="form-col">
              <label
                >{pluginInstance.i18n?.incrementalShare?.blacklist?.targetId || "目标ID"}
                <span style="color:red">*</span></label
              >
              <input
                class="b3-text-field fn__block"
                bind:value={formData.targetId}
                placeholder={pluginInstance.i18n?.incrementalShare?.blacklist?.targetIdPlaceholder ||
                  "请输入文档ID或笔记本ID"}
              />
            </div>
          </div>
          <div class="form-row">
            <div class="form-col">
              <label
                >{pluginInstance.i18n?.incrementalShare?.blacklist?.targetName || "名称"}
                <span style="color:red">*</span></label
              >
              <input
                class="b3-text-field fn__block"
                bind:value={formData.targetName}
                placeholder={pluginInstance.i18n?.incrementalShare?.blacklist?.targetNamePlaceholder || "请输入名称"}
              />
            </div>
            <div class="form-col">
              <label>{pluginInstance.i18n?.incrementalShare?.blacklist?.note || "备注"}</label>
              <input
                class="b3-text-field fn__block"
                bind:value={formData.note}
                placeholder={pluginInstance.i18n?.incrementalShare?.blacklist?.notePlaceholder || "请输入备注（可选）"}
              />
            </div>
          </div>
          <div class="form-actions">
            <button class="b3-button b3-button--text" on:click={handleAddItem} disabled={isLoading}>
              {pluginInstance.i18n?.incrementalShare?.blacklist?.confirmAdd || "确定添加"}
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- 黑名单列表 -->
    <div class="fn__block form-item">
      <div class="b3-label__text form-item-tip">
        {pluginInstance.i18n?.incrementalShare?.blacklist?.manageTip || "管理不需要分享的笔记本或文档"}（共 {totalItems}
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
                <th>{pluginInstance.i18n?.incrementalShare?.blacklist?.targetName || "名称"}</th>
                <th style="width: 120px;">{pluginInstance.i18n?.incrementalShare?.blacklist?.type || "类型"}</th>
                <th>{pluginInstance.i18n?.incrementalShare?.blacklist?.note || "备注"}</th>
                <th style="width: 150px;"
                  >{pluginInstance.i18n?.incrementalShare?.blacklist?.createdAt || "创建时间"}</th
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
              {pluginInstance.i18n?.incrementalShare?.blacklist?.prevPage || "上一页"}
            </button>
            <span class="page-info">
              第 {currentPage + 1} / {totalPages} 页
            </span>
            <button
              class="b3-button b3-button--outline"
              disabled={currentPage >= totalPages - 1 || isLoading}
              on:click={() => handlePageChange(currentPage + 1)}
            >
              {pluginInstance.i18n?.incrementalShare?.blacklist?.nextPage || "下一页"}
            </button>
          </div>
        {/if}
      {:else}
        <div class="blacklist-empty">
          {pluginInstance.i18n?.incrementalShare?.blacklist?.noItems || "暂无黑名单项目"}
        </div>
      {/if}
    </div>

    <!-- 底部按钮 -->
    <div class="b3-dialog__action">
      <button class="b3-button b3-button--cancel" on:click={onCancel}>{pluginInstance.i18n.cancel}</button>
    </div>
  </div>
</div>

<style>
  .form-item {
    padding: 10px;
    width: 94%;
    margin: auto;
    font-size: 14px;
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
  }

  /* 添加表单区域 */
  .add-form-block {
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    padding: 16px;
  }

  .add-form-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    font-weight: 500;
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
