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
    import type { ChangeDetectionResult } from "../../service/IncrementalShareService"
    import { icons } from "../../utils/svg"

    export let pluginInstance: ShareProPlugin
    export let shareService: ShareService
    export let config: ShareProConfig

    const logger = simpleLogger("incremental-share-ui", "share-pro", isDev)

    // 状态管理
    let isLoading = false
    let changeDetectionResult: ChangeDetectionResult | null = null
    let selectedNewDocs = new Set<string>()
    let selectedUpdatedDocs = new Set<string>()
    let expandedGroups = {
        newDocuments: true,
        updatedDocuments: true,
        unchangedDocuments: false
    }

    // 搜索过滤
    let searchTerm = ""
    let filteredNewDocs: any[] = []
    let filteredUpdatedDocs: any[] = []
    let filteredUnchangedDocs: any[] = []

    // 全选状态
    let selectAllNew = false
    let selectAllUpdated = false

    // 生命周期
    onMount(async () => {
        await loadDocuments()
    })

    // 加载文档列表
    const loadDocuments = async () => {
        isLoading = true
        try {
            // 获取所有文档
            const allDocuments = await getAllDocuments()
            
            // 检测变更
            changeDetectionResult = await shareService.detectChangedDocuments(allDocuments, config)
            
            // 初始化过滤结果
            updateFilteredResults()
            
            logger.info("文档变更检测结果:", changeDetectionResult)
        } catch (error) {
            logger.error("加载文档失败:", error)
            showMessage(pluginInstance.i18n?.incrementalShare?.loadError || "加载文档失败", 7000, "error")
        } finally {
            isLoading = false
        }
    }

    // 获取所有文档（模拟数据，实际应该从思源笔记获取）
    const getAllDocuments = async () => {
        // 这里应该调用思源笔记API获取所有文档
        // 暂时返回模拟数据
        return [
            { docId: "1", docTitle: "测试文档1", modifiedTime: Date.now() - 1000 * 60 * 60, notebookId: "nb1", notebookName: "笔记本1" },
            { docId: "2", docTitle: "测试文档2", modifiedTime: Date.now() - 1000 * 60 * 60 * 24, notebookId: "nb1", notebookName: "笔记本1" },
            { docId: "3", docTitle: "测试文档3", modifiedTime: Date.now(), notebookId: "nb2", notebookName: "笔记本2" }
        ]
    }

    // 更新过滤结果
    const updateFilteredResults = () => {
        if (!changeDetectionResult) return

        const filterDocs = (docs: any[]) => {
            if (!searchTerm) return docs
            return docs.filter(doc => 
                doc.docTitle.toLowerCase().includes(searchTerm.toLowerCase())
            )
        }

        filteredNewDocs = filterDocs(changeDetectionResult.newDocuments)
        filteredUpdatedDocs = filterDocs(changeDetectionResult.updatedDocuments)
        filteredUnchangedDocs = filterDocs(changeDetectionResult.unchangedDocuments)
    }

    // 搜索处理
    const handleSearch = () => {
        updateFilteredResults()
    }

    // 全选处理
    const handleSelectAllNew = () => {
        if (selectAllNew) {
            filteredNewDocs.forEach(doc => selectedNewDocs.add(doc.docId))
        } else {
            filteredNewDocs.forEach(doc => selectedNewDocs.delete(doc.docId))
        }
        selectedNewDocs = selectedNewDocs // 触发响应式更新
    }

    const handleSelectAllUpdated = () => {
        if (selectAllUpdated) {
            filteredUpdatedDocs.forEach(doc => selectedUpdatedDocs.add(doc.docId))
        } else {
            filteredUpdatedDocs.forEach(doc => selectedUpdatedDocs.delete(doc.docId))
        }
        selectedUpdatedDocs = selectedUpdatedDocs // 触发响应式更新
    }

    // 单个文档选择
    const toggleDocSelection = (docId: string, type: 'new' | 'updated') => {
        if (type === 'new') {
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

    // 批量分享
    const handleBulkShare = async () => {
        const selectedDocs = [
            ...Array.from(selectedNewDocs).map(docId => ({
                docId,
                docTitle: filteredNewDocs.find(d => d.docId === docId)?.docTitle || ""
            })),
            ...Array.from(selectedUpdatedDocs).map(docId => ({
                docId,
                docTitle: filteredUpdatedDocs.find(d => d.docId === docId)?.docTitle || ""
            }))
        ]

        if (selectedDocs.length === 0) {
            showMessage(pluginInstance.i18n?.incrementalShare?.noSelection || "请选择要分享的文档", 3000, "warning")
            return
        }

        isLoading = true
        try {
            const result = await shareService.bulkShareDocuments(selectedDocs, config)
            
            if (result.successCount > 0) {
                showMessage(
                    `${pluginInstance.i18n?.incrementalShare?.shareSuccess || "分享成功"}: ${result.successCount} ${pluginInstance.i18n?.incrementalShare?.documents || "个文档"}`,
                    3000, 
                    "info"
                )
                // 重新加载文档列表
                await loadDocuments()
                // 清空选择
                selectedNewDocs.clear()
                selectedUpdatedDocs.clear()
                selectAllNew = false
                selectAllUpdated = false
            }
            
            if (result.failedCount > 0) {
                showMessage(
                    `${pluginInstance.i18n?.incrementalShare?.shareFailed || "分享失败"}: ${result.failedCount} ${pluginInstance.i18n?.incrementalShare?.documents || "个文档"}`,
                    7000, 
                    "error"
                )
            }
        } catch (error) {
            logger.error("批量分享失败:", error)
            showMessage(pluginInstance.i18n?.incrementalShare?.shareError || "批量分享失败", 7000, "error")
        } finally {
            isLoading = false
        }
    }

    // 格式化时间
    const formatTime = (timestamp: number) => {
        if (timestamp === 0) return pluginInstance.i18n?.incrementalShare?.neverShared || "从未分享"
        return new Date(timestamp).toLocaleString()
    }

    // 切换分组展开状态
    const toggleGroup = (group: keyof typeof expandedGroups) => {
        expandedGroups[group] = !expandedGroups[group]
        expandedGroups = expandedGroups
    }

    // 响应式处理
    $: if (changeDetectionResult) {
        updateFilteredResults()
    }
</script>

<div class="incremental-share-ui">
    <div class="share-header">
        <h3>{pluginInstance.i18n?.incrementalShare?.title || "增量分享"}</h3>
        <div class="header-actions">
            <input
                type="text"
                class="search-input"
                placeholder={pluginInstance.i18n?.incrementalShare?.searchPlaceholder || "搜索文档..."}
                bind:value={searchTerm}
                on:input={handleSearch}
            />
            <button class="btn btn-primary" on:click={handleBulkShare} disabled={isLoading || selectedNewDocs.size + selectedUpdatedDocs.size === 0}>
                {@html icons.share}
                {pluginInstance.i18n?.incrementalShare?.bulkShare || "批量分享"}
                ({selectedNewDocs.size + selectedUpdatedDocs.size})
            </button>
            <button class="btn btn-secondary" on:click={loadDocuments} disabled={isLoading}>
                {@html icons.refresh}
                {pluginInstance.i18n?.incrementalShare?.refresh || "刷新"}
            </button>
        </div>
    </div>

    {#if isLoading}
        <div class="loading">
            <div class="spinner"></div>
            <span>{pluginInstance.i18n?.incrementalShare?.loading || "加载中..."}</span>
        </div>
    {:else if changeDetectionResult}
        <div class="share-stats">
            <div class="stat-item">
                <span class="stat-number">{changeDetectionResult.newDocuments.length}</span>
                <span class="stat-label">{pluginInstance.i18n?.incrementalShare?.newDocuments || "新增文档"}</span>
            </div>
            <div class="stat-item">
                <span class="stat-number">{changeDetectionResult.updatedDocuments.length}</span>
                <span class="stat-label">{pluginInstance.i18n?.incrementalShare?.updatedDocuments || "更新文档"}</span>
            </div>
            <div class="stat-item">
                <span class="stat-number">{changeDetectionResult.unchangedDocuments.length}</span>
                <span class="stat-label">{pluginInstance.i18n?.incrementalShare?.unchangedDocuments || "未变更文档"}</span>
            </div>
            {#if changeDetectionResult.blacklistedCount > 0}
                <div class="stat-item blacklisted">
                    <span class="stat-number">{changeDetectionResult.blacklistedCount}</span>
                    <span class="stat-label">{pluginInstance.i18n?.incrementalShare?.blacklistedDocuments || "黑名单文档"}</span>
                </div>
            {/if}
        </div>

        <div class="document-groups">
            <!-- 新增文档 -->
            <div class="document-group">
                <div class="group-header" on:click={() => toggleGroup('newDocuments')}>
                    <span class="group-title">
                        {@html expandedGroups.newDocuments ? icons.chevronDown : icons.chevronRight}
                        {pluginInstance.i18n?.incrementalShare?.newDocumentsGroup || "新增文档"}
                        <span class="group-count">({filteredNewDocs.length})</span>
                    </span>
                    {#if filteredNewDocs.length > 0}
                        <label class="select-all">
                            <input
                                type="checkbox"
                                bind:checked={selectAllNew}
                                on:change={handleSelectAllNew}
                            />
                            {pluginInstance.i18n?.incrementalShare?.selectAll || "全选"}
                        </label>
                    {/if}
                </div>
                {#if expandedGroups.newDocuments}
                    <div class="group-content">
                        {#if filteredNewDocs.length === 0}
                            <div class="empty-message">
                                {pluginInstance.i18n?.incrementalShare?.noNewDocuments || "暂无新增文档"}
                            </div>
                        {:else}
                            {#each filteredNewDocs as doc}
                                <div class="document-item">
                                    <label class="document-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={selectedNewDocs.has(doc.docId)}
                                            on:change={() => toggleDocSelection(doc.docId, 'new')}
                                        />
                                        <span class="document-title">{doc.docTitle}</span>
                                    </label>
                                    <span class="document-time">{formatTime(doc.lastShareTime)}</span>
                                </div>
                            {/each}
                        {/if}
                    </div>
                {/if}
            </div>

            <!-- 更新文档 -->
            <div class="document-group">
                <div class="group-header" on:click={() => toggleGroup('updatedDocuments')}>
                    <span class="group-title">
                        {@html expandedGroups.updatedDocuments ? icons.chevronDown : icons.chevronRight}
                        {pluginInstance.i18n?.incrementalShare?.updatedDocumentsGroup || "更新文档"}
                        <span class="group-count">({filteredUpdatedDocs.length})</span>
                    </span>
                    {#if filteredUpdatedDocs.length > 0}
                        <label class="select-all">
                            <input
                                type="checkbox"
                                bind:checked={selectAllUpdated}
                                on:change={handleSelectAllUpdated}
                            />
                            {pluginInstance.i18n?.incrementalShare?.selectAll || "全选"}
                        </label>
                    {/if}
                </div>
                {#if expandedGroups.updatedDocuments}
                    <div class="group-content">
                        {#if filteredUpdatedDocs.length === 0}
                            <div class="empty-message">
                                {pluginInstance.i18n?.incrementalShare?.noUpdatedDocuments || "暂无更新文档"}
                            </div>
                        {:else}
                            {#each filteredUpdatedDocs as doc}
                                <div class="document-item">
                                    <label class="document-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={selectedUpdatedDocs.has(doc.docId)}
                                            on:change={() => toggleDocSelection(doc.docId, 'updated')}
                                        />
                                        <span class="document-title">{doc.docTitle}</span>
                                    </label>
                                    <span class="document-time">{pluginInstance.i18n?.incrementalShare?.lastShared || "上次分享"}: {formatTime(doc.lastShareTime)}</span>
                                </div>
                            {/each}
                        {/if}
                    </div>
                {/if}
            </div>

            <!-- 未变更文档 -->
            <div class="document-group">
                <div class="group-header" on:click={() => toggleGroup('unchangedDocuments')}>
                    <span class="group-title">
                        {@html expandedGroups.unchangedDocuments ? icons.chevronDown : icons.chevronRight}
                        {pluginInstance.i18n?.incrementalShare?.unchangedDocumentsGroup || "未变更文档"}
                        <span class="group-count">({filteredUnchangedDocs.length})</span>
                    </span>
                </div>
                {#if expandedGroups.unchangedDocuments}
                    <div class="group-content">
                        {#if filteredUnchangedDocs.length === 0}
                            <div class="empty-message">
                                {pluginInstance.i18n?.incrementalShare?.noUnchangedDocuments || "暂无未变更文档"}
                            </div>
                        {:else}
                            {#each filteredUnchangedDocs as doc}
                                <div class="document-item no-select">
                                    <span class="document-title">{doc.docTitle}</span>
                                    <span class="document-time">{pluginInstance.i18n?.incrementalShare?.lastShared || "上次分享"}: {formatTime(doc.lastShareTime)}</span>
                                </div>
                            {/each}
                        {/if}
                    </div>
                {/if}
            </div>
        </div>
    {:else}
        <div class="empty-state">
            {pluginInstance.i18n?.incrementalShare?.noData || "暂无数据"}
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

    .btn-secondary {
        background: var(--b3-theme-surface);
        color: var(--b3-theme-on-surface);
        border: 1px solid var(--b3-border-color);
    }

    .btn-secondary:hover:not(:disabled) {
        background: var(--b3-theme-surface-light);
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