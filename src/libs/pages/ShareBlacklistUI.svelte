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
    import { isDev } from "../../Constants"
    import ShareProPlugin from "../../index"
    import { ShareService } from "../../service/ShareService"
    import { ShareProConfig } from "../../models/ShareProConfig"
    import type { BlacklistItem, BlacklistItemType } from "../../models/ShareBlacklist"
    import { icons } from "../../utils/svg"

    export let pluginInstance: ShareProPlugin
export let shareService: ShareService
// @ts-ignore
export const config = null

    const logger = simpleLogger("share-blacklist-ui", "share-pro", isDev)

    // 状态管理
    let isLoading = false
    let blacklistItems: BlacklistItem[] = []
    let selectedItems = new Set<string>()
    let showAddModal = false
    let showEditModal = false
    let editingItem: BlacklistItem | null = null

    // 添加/编辑表单
    let formData = {
        name: "",
        type: "document" as BlacklistItemType,
        description: ""
    }

    // 搜索过滤
    let searchTerm = ""
    let filterType: "all" | "notebook" | "document" = "all"
    let filteredItems: BlacklistItem[] = []

    // 全选状态
    let selectAll = false

    // 生命周期
    onMount(async () => {
        await loadBlacklist()
    })

    // 加载黑名单
    const loadBlacklist = async () => {
        isLoading = true
        try {
            blacklistItems = await shareService.getShareBlacklist()
            updateFilteredResults()
            logger.info("黑名单加载完成，共", blacklistItems.length, "项")
        } catch (error) {
            logger.error("加载黑名单失败:", error)
            showMessage(pluginInstance.i18n?.blacklist?.loadError || "加载黑名单失败", 7000, "error")
        } finally {
            isLoading = false
        }
    }

    // 更新过滤结果
    const updateFilteredResults = () => {
        let items = blacklistItems

        // 类型过滤
        if (filterType !== "all") {
            items = items.filter(item => item.type === filterType)
        }

        // 搜索过滤
        if (searchTerm) {
            items = items.filter(item => 
                item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.description?.toLowerCase().includes(searchTerm.toLowerCase())
            )
        }

        filteredItems = items
    }

    // 搜索处理
    const handleSearch = () => {
        updateFilteredResults()
    }

    // 类型过滤处理
    const handleTypeFilter = () => {
        updateFilteredResults()
    }

    // 全选处理
    const handleSelectAll = () => {
        if (selectAll) {
            filteredItems.forEach(item => selectedItems.add(item.id))
        } else {
            filteredItems.forEach(item => selectedItems.delete(item.id))
        }
        selectedItems = selectedItems // 触发响应式更新
    }

    // 单个项目选择
    const toggleItemSelection = (itemId: string) => {
        if (selectedItems.has(itemId)) {
            selectedItems.delete(itemId)
        } else {
            selectedItems.add(itemId)
        }
        selectedItems = selectedItems
        selectAll = selectedItems.size === filteredItems.length && filteredItems.length > 0
    }

    // 显示添加模态框
    const showAddDialog = () => {
        formData = {
            name: "",
            type: "document",
            description: ""
        }
        showAddModal = true
    }

    // 显示编辑模态框
    const showEditDialog = (item: BlacklistItem) => {
        editingItem = item
        formData = {
            name: item.name,
            type: item.type,
            description: item.description || ""
        }
        showEditModal = true
    }

    // 添加黑名单项
    const handleAddItem = async () => {
        if (!formData.name.trim()) {
            showMessage(pluginInstance.i18n?.blacklist?.nameRequired || "请输入名称", 3000, "warning")
            return
        }

        isLoading = true
        try {
            const newItem: BlacklistItem = {
                id: Date.now().toString(),
                name: formData.name.trim(),
                type: formData.type,
                description: formData.description.trim(),
                createdAt: Date.now(),
                updatedAt: Date.now()
            }

            await shareService.setShareBlacklist([...blacklistItems, newItem])
            showMessage(pluginInstance.i18n?.blacklist?.addSuccess || "添加成功", 3000, "info")
            showAddModal = false
            await loadBlacklist()
        } catch (error) {
            logger.error("添加黑名单项失败:", error)
            showMessage(pluginInstance.i18n?.blacklist?.addError || "添加失败", 7000, "error")
        } finally {
            isLoading = false
        }
    }

    // 编辑黑名单项
    const handleEditItem = async () => {
        if (!editingItem || !formData.name.trim()) {
            showMessage(pluginInstance.i18n?.blacklist?.nameRequired || "请输入名称", 3000, "warning")
            return
        }

        isLoading = true
        try {
            const updatedItems = blacklistItems.map(item => 
                item.id === editingItem!.id 
                    ? { ...item, name: formData.name.trim(), type: formData.type, description: formData.description.trim(), updatedAt: Date.now() }
                    : item
            )

            await shareService.setShareBlacklist(updatedItems)
            showMessage(pluginInstance.i18n?.blacklist?.editSuccess || "编辑成功", 3000, "info")
            showEditModal = false
            editingItem = null
            await loadBlacklist()
        } catch (error) {
            logger.error("编辑黑名单项失败:", error)
            showMessage(pluginInstance.i18n?.blacklist?.editError || "编辑失败", 7000, "error")
        } finally {
            isLoading = false
        }
    }

    // 删除黑名单项
    const handleDeleteItems = async () => {
        if (selectedItems.size === 0) {
            showMessage(pluginInstance.i18n?.blacklist?.noSelection || "请选择要删除的项目", 3000, "warning")
            return
        }

        const confirmed = confirm(pluginInstance.i18n?.blacklist?.deleteConfirm || `确定要删除选中的 ${selectedItems.size} 个项目吗？`)
        if (!confirmed) return

        isLoading = true
        try {
            const updatedItems = blacklistItems.filter(item => !selectedItems.has(item.id))
            await shareService.setShareBlacklist(updatedItems)
            showMessage(pluginInstance.i18n?.blacklist?.deleteSuccess || "删除成功", 3000, "info")
            selectedItems.clear()
            selectedItems = selectedItems
            await loadBlacklist()
        } catch (error) {
            logger.error("删除黑名单项失败:", error)
            showMessage(pluginInstance.i18n?.blacklist?.deleteError || "删除失败", 7000, "error")
        } finally {
            isLoading = false
        }
    }

    // 获取类型标签样式
    const getTypeLabel = (type: BlacklistItemType) => {
        return type === "notebook" 
            ? pluginInstance.i18n?.blacklist?.notebook || "笔记本"
            : pluginInstance.i18n?.blacklist?.document || "文档"
    }

    // 获取类型标签样式类
    const getTypeClass = (type: BlacklistItemType) => {
        return type === "notebook" ? "type-notebook" : "type-document"
    }

    // 响应式处理
    $: if (blacklistItems) {
        updateFilteredResults()
    }
</script>

<div class="share-blacklist-ui">
    <div class="blacklist-header">
        <h3>{pluginInstance.i18n?.blacklist?.title || "分享黑名单管理"}</h3>
        <div class="header-actions">
            <input
                type="text"
                class="search-input"
                placeholder={pluginInstance.i18n?.blacklist?.searchPlaceholder || "搜索黑名单..."}
                bind:value={searchTerm}
                on:input={handleSearch}
            />
            <select class="filter-select" bind:value={filterType} on:change={handleTypeFilter}>
                <option value="all">{pluginInstance.i18n?.blacklist?.allTypes || "全部类型"}</option>
                <option value="notebook">{pluginInstance.i18n?.blacklist?.notebook || "笔记本"}</option>
                <option value="document">{pluginInstance.i18n?.blacklist?.document || "文档"}</option>
            </select>
            <button class="btn btn-primary" on:click={showAddDialog} disabled={isLoading}>
                {@html icons.add}
                {pluginInstance.i18n?.blacklist?.addItem || "添加项目"}
            </button>
            <button class="btn btn-danger" on:click={handleDeleteItems} disabled={isLoading || selectedItems.size === 0}>
                {@html icons.delete}
                {pluginInstance.i18n?.blacklist?.deleteSelected || "删除选中"}
                {#if selectedItems.size > 0}
                    ({selectedItems.size})
                {/if}
            </button>
        </div>
    </div>

    {#if isLoading}
        <div class="loading">
            <div class="spinner"></div>
            <span>{pluginInstance.i18n?.blacklist?.loading || "加载中..."}</span>
        </div>
    {:else if filteredItems.length > 0}
        <div class="blacklist-table">
            <table>
                <thead>
                    <tr>
                        <th width="40">
                            <input
                                type="checkbox"
                                bind:checked={selectAll}
                                on:change={handleSelectAll}
                            />
                        </th>
                        <th>{pluginInstance.i18n?.blacklist?.name || "名称"}</th>
                        <th width="100">{pluginInstance.i18n?.blacklist?.type || "类型"}</th>
                        <th>{pluginInstance.i18n?.blacklist?.description || "描述"}</th>
                        <th width="150">{pluginInstance.i18n?.blacklist?.createdAt || "创建时间"}</th>
                        <th width="100">{pluginInstance.i18n?.blacklist?.actions || "操作"}</th>
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
                            <td class="item-name">{item.name}</td>
                            <td>
                                <span class="type-label {getTypeClass(item.type)}">
                                    {getTypeLabel(item.type)}
                                </span>
                            </td>
                            <td class="item-description">{item.description || "-"}</td>
                            <td class="item-time">{new Date(item.createdAt).toLocaleString()}</td>
                            <td>
                                <button class="btn-icon" on:click={() => showEditDialog(item)} title={pluginInstance.i18n?.blacklist?.edit || "编辑"}>
                                    {@html icons.edit}
                                </button>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {:else}
        <div class="empty-state">
            <div class="empty-icon">{@html icons.empty}</div>
            <div class="empty-text">
                {searchTerm || filterType !== "all" 
                    ? (pluginInstance.i18n?.blacklist?.noResults || "没有找到匹配的黑名单项目")
                    : (pluginInstance.i18n?.blacklist?.noData || "暂无黑名单项目")
                }
            </div>
        </div>
    {/if}
</div>

<!-- 添加模态框 -->
{#if showAddModal}
    <div class="modal-overlay" on:click={() => showAddModal = false}>
        <div class="modal-content" on:click|stopPropagation>
            <div class="modal-header">
                <h4>{pluginInstance.i18n?.blacklist?.addItem || "添加黑名单项目"}</h4>
                <button class="modal-close" on:click={() => showAddModal = false}>{@html icons.close}</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>{pluginInstance.i18n?.blacklist?.name || "名称"} <span class="required">*</span></label>
                    <input
                        type="text"
                        bind:value={formData.name}
                        placeholder={pluginInstance.i18n?.blacklist?.namePlaceholder || "请输入名称"}
                    />
                </div>
                <div class="form-group">
                    <label>{pluginInstance.i18n?.blacklist?.type || "类型"}</label>
                    <select bind:value={formData.type}>
                        <option value="document">{pluginInstance.i18n?.blacklist?.document || "文档"}</option>
                        <option value="notebook">{pluginInstance.i18n?.blacklist?.notebook || "笔记本"}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>{pluginInstance.i18n?.blacklist?.description || "描述"}</label>
                    <textarea
                        bind:value={formData.description}
                        placeholder={pluginInstance.i18n?.blacklist?.descriptionPlaceholder || "请输入描述（可选）"}
                        rows="3"
                    ></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" on:click={() => showAddModal = false}>
                    {pluginInstance.i18n?.blacklist?.cancel || "取消"}
                </button>
                <button class="btn btn-primary" on:click={handleAddItem} disabled={isLoading}>
                    {pluginInstance.i18n?.blacklist?.confirm || "确定"}
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- 编辑模态框 -->
{#if showEditModal}
    <div class="modal-overlay" on:click={() => showEditModal = false}>
        <div class="modal-content" on:click|stopPropagation>
            <div class="modal-header">
                <h4>{pluginInstance.i18n?.blacklist?.editItem || "编辑黑名单项目"}</h4>
                <button class="modal-close" on:click={() => showEditModal = false}>{@html icons.close}</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>{pluginInstance.i18n?.blacklist?.name || "名称"} <span class="required">*</span></label>
                    <input
                        type="text"
                        bind:value={formData.name}
                        placeholder={pluginInstance.i18n?.blacklist?.namePlaceholder || "请输入名称"}
                    />
                </div>
                <div class="form-group">
                    <label>{pluginInstance.i18n?.blacklist?.type || "类型"}</label>
                    <select bind:value={formData.type}>
                        <option value="document">{pluginInstance.i18n?.blacklist?.document || "文档"}</option>
                        <option value="notebook">{pluginInstance.i18n?.blacklist?.notebook || "笔记本"}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>{pluginInstance.i18n?.blacklist?.description || "描述"}</label>
                    <textarea
                        bind:value={formData.description}
                        placeholder={pluginInstance.i18n?.blacklist?.descriptionPlaceholder || "请输入描述（可选）"}
                        rows="3"
                    ></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" on:click={() => showEditModal = false}>
                    {pluginInstance.i18n?.blacklist?.cancel || "取消"}
                </button>
                <button class="btn btn-primary" on:click={handleEditItem} disabled={isLoading}>
                    {pluginInstance.i18n?.blacklist?.confirm || "确定"}
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .share-blacklist-ui {
        padding: 16px;
        font-family: var(--b3-font-family);
    }

    .blacklist-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--b3-border-color);
    }

    .blacklist-header h3 {
        margin: 0;
        color: var(--b3-theme-on-background);
    }

    .header-actions {
        display: flex;
        gap: 12px;
        align-items: center;
    }

    .search-input {
        padding: 8px 12px;
        border: 1px solid var(--b3-border-color);
        border-radius: 4px;
        background: var(--b3-theme-background);
        color: var(--b3-theme-on-background);
        width: 200px;
    }

    .search-input:focus {
        outline: none;
        border-color: var(--b3-theme-primary);
    }

    .filter-select {
        padding: 8px 12px;
        border: 1px solid var(--b3-border-color);
        border-radius: 4px;
        background: var(--b3-theme-background);
        color: var(--b3-theme-on-background);
        min-width: 100px;
    }

    .filter-select:focus {
        outline: none;
        border-color: var(--b3-theme-primary);
    }

    .btn {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 14px;
        transition: all 0.2s;
    }

    .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .btn-primary {
        background: var(--b3-theme-primary);
        color: white;
    }

    .btn-primary:hover:not(:disabled) {
        background: var(--b3-theme-primary-light);
    }

    .btn-danger {
        background: var(--b3-theme-error);
        color: white;
    }

    .btn-danger:hover:not(:disabled) {
        background: var(--b3-theme-error-light);
    }

    .btn-icon {
        padding: 6px;
        background: transparent;
        border: none;
        cursor: pointer;
        color: var(--b3-theme-on-surface);
        border-radius: 4px;
        transition: all 0.2s;
    }

    .btn-icon:hover {
        background: var(--b3-theme-surface-light);
        color: var(--b3-theme-primary);
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
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    .blacklist-table {
        background: var(--b3-theme-background);
        border: 1px solid var(--b3-border-color);
        border-radius: 8px;
        overflow: hidden;
    }

    table {
        width: 100%;
        border-collapse: collapse;
    }

    th {
        background: var(--b3-theme-surface);
        color: var(--b3-theme-on-surface);
        font-weight: 500;
        text-align: left;
        padding: 12px 16px;
        border-bottom: 1px solid var(--b3-border-color);
    }

    td {
        padding: 12px 16px;
        border-bottom: 1px solid var(--b3-border-color);
        color: var(--b3-theme-on-background);
    }

    tr:last-child td {
        border-bottom: none;
    }

    tr:hover {
        background: var(--b3-theme-surface-light);
    }

    .item-name {
        font-weight: 500;
    }

    .item-description {
        color: var(--b3-theme-on-surface);
        font-size: 14px;
    }

    .item-time {
        color: var(--b3-theme-on-surface);
        font-size: 12px;
    }

    .type-label {
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
    }

    .type-notebook {
        background: var(--b3-theme-secondary);
        color: white;
    }

    .type-document {
        background: var(--b3-theme-primary);
        color: white;
    }

    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px 20px;
        color: var(--b3-theme-on-surface);
    }

    .empty-icon {
        font-size: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
    }

    .empty-text {
        font-size: 16px;
        text-align: center;
    }

    /* 模态框样式 */
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }

    .modal-content {
        background: var(--b3-theme-background);
        border-radius: 8px;
        width: 90%;
        max-width: 500px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid var(--b3-border-color);
    }

    .modal-header h4 {
        margin: 0;
        color: var(--b3-theme-on-background);
    }

    .modal-close {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: var(--b3-theme-on-surface);
        padding: 4px;
    }

    .modal-close:hover {
        color: var(--b3-theme-error);
    }

    .modal-body {
        padding: 20px;
    }

    .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding: 16px 20px;
        border-top: 1px solid var(--b3-border-color);
    }

    .form-group {
        margin-bottom: 16px;
    }

    .form-group label {
        display: block;
        margin-bottom: 6px;
        color: var(--b3-theme-on-background);
        font-weight: 500;
    }

    .form-group input,
    .form-group select,
    .form-group textarea {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--b3-border-color);
        border-radius: 4px;
        background: var(--b3-theme-background);
        color: var(--b3-theme-on-background);
        font-family: inherit;
    }

    .form-group input:focus,
    .form-group select:focus,
    .form-group textarea:focus {
        outline: none;
        border-color: var(--b3-theme-primary);
    }

    .required {
        color: var(--b3-theme-error);
    }
</style>