<!--
  -            GNU GENERAL PUBLIC LICENSE
  -               Version 3, 29 June 2007
  -
  -  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
  -  Everyone is permitted to copy and distribute verbatim copies
  -  of this license document, but changing it is not allowed.
  -->

<script lang="ts">
  import { onMount } from "svelte";
  import { simpleLogger } from "zhi-lib-base";
  import { isDev } from "../../Constants";
  import { useSiyuanApi } from "../../composables/useSiyuanApi";
  import ShareProPlugin from "../../index";
  import { getSubdocCount, getSubdocsPaged } from "../../composables/useSiyuanApi";
  import { SettingKeys } from "../../utils/SettingKeys";
  import TreeNode from "./TreeNode.svelte";

  export let pluginInstance: ShareProPlugin;
  export let docId: string;
  export let maxSubdocuments: number = 100;
  export let onSubdocumentSelect: (selectedDocIds: string[]) => void;

  const logger = simpleLogger("subdocument-tree-preview", "share-pro", isDev);

  // 子文档树数据
  let subdocumentTree = [];
  let totalSubdocuments = 0;
  let isLoading = false;
  let selectedDocIds = new Set<string>();
  let expandedNodes = new Set<string>();

  // 初始化
  onMount(async () => {
    await loadSubdocumentTree();
  });

  // 加载子文档树
  const loadSubdocumentTree = async () => {
    if (!docId) return;

    isLoading = true;
    try {
      const cfg = await pluginInstance.safeLoad();
      const { kernelApi } = useSiyuanApi(cfg);

      // 获取总数
      totalSubdocuments = await getSubdocCount(kernelApi, docId);

      // 获取子文档列表（分页加载）
      const pageSize = Math.min(maxSubdocuments, 50);
      const totalPages = Math.ceil(Math.min(totalSubdocuments, maxSubdocuments) / pageSize);
      const allSubdocs = [];

      for (let page = 0; page < totalPages; page++) {
        const subdocs = await getSubdocsPaged(kernelApi, docId, page, pageSize);
        allSubdocs.push(...subdocs);
        if (allSubdocs.length >= maxSubdocuments) {
          break;
        }
      }

      // 构建树形结构（简化版，只处理一层）
      subdocumentTree = allSubdocs.map(subdoc => ({
        ...subdoc,
        depth: 0,
        children: []
      }));

      // 默认选中所有文档
      selectedDocIds = new Set();
      allSubdocs.forEach(subdoc => {
        selectedDocIds.add(subdoc.docId);
      });

      // 触发选择回调
      if (onSubdocumentSelect) {
        onSubdocumentSelect(Array.from(selectedDocIds));
      }
    } catch (error) {
      logger.error("Failed to load subdocument tree", error);
    } finally {
      isLoading = false;
    }
  };

  // 切换节点展开/折叠
  const toggleExpand = (nodeId: string) => {
    if (expandedNodes.has(nodeId)) {
      expandedNodes.delete(nodeId);
    } else {
      expandedNodes.add(nodeId);
    }
  };

  // 切换单个文档选择
  const toggleSelect = (docId: string, event: Event) => {
    event.stopPropagation();

    if (selectedDocIds.has(docId)) {
      selectedDocIds.delete(docId);
    } else {
      selectedDocIds.add(docId);
    }

    if (onSubdocumentSelect) {
      onSubdocumentSelect(Array.from(selectedDocIds));
    }
  };

  // 全选/反选
  const toggleSelectAll = () => {
    if (selectedDocIds.size === subdocumentTree.length) {
      selectedDocIds = new Set();
    } else {
      selectedDocIds = new Set();
      subdocumentTree.forEach(node => {
        selectedDocIds.add(node.docId);
      });
    }

    if (onSubdocumentSelect) {
      onSubdocumentSelect(Array.from(selectedDocIds));
    }
  };

  // 仅分享首层子文档（这里就是所有文档）
  const selectFirstLevelOnly = () => {
    selectedDocIds = new Set();
    subdocumentTree.forEach(node => {
      selectedDocIds.add(node.docId);
    });

    if (onSubdocumentSelect) {
      onSubdocumentSelect(Array.from(selectedDocIds));
    }
  };

  // 同步检查黑名单（用于UI渲染）
  const isBlacklistedSync = (docId: string): boolean => {
    return false;
  };

  // 获取选中文档数量
  const getSelectedCount = () => {
    return selectedDocIds.size;
  };

  // 获取总文档数量
  const getTotalCount = () => {
    return totalSubdocuments;
  };

  // 获取预估分享时间（每个文档约3秒）
  const getEstimatedTime = () => {
    const selectedCount = getSelectedCount();
    return selectedCount * 3;
  };

  // 获取存储空间预估（简化估算）
  const getEstimatedStorage = () => {
    const selectedCount = getSelectedCount();
    // 假设每个文档平均10KB
    return selectedCount * 10;
  };
</script>

<div class="subdocument-tree-preview">
  {#if isLoading}
    <div class="loading-container">
      <div class="spinner" />
      <div class="loading-text">{pluginInstance.i18n["ui"]["dataLoading"]}</div>
    </div>
  {:else if subdocumentTree.length === 0}
    <div class="empty-state">
      {pluginInstance.i18n["incrementalShare"]["noNewDocs"]}
    </div>
  {:else}
    <div class="preview-header">
      <div class="stats">
        <span class="stat-item">
          {pluginInstance.i18n["cs"]["maxSubdocuments"]}:
          <strong>{getSelectedCount()}/{getTotalCount()}</strong>
        </span>
        <span class="stat-item">
          {pluginInstance.i18n["ui"]["expiresTitle"]}:
          <strong>{Math.floor(getEstimatedTime() / 60)}m {getEstimatedTime() % 60}s</strong>
        </span>
        <span class="stat-item">
          {pluginInstance.i18n["seo"]["siteDescription"]}:
          <strong>{getEstimatedStorage()}KB</strong>
        </span>
      </div>
      <div class="actions">
        <button class="action-btn" on:click={selectFirstLevelOnly}>
          {pluginInstance.i18n["incrementalShare"]["new"]}
        </button>
        <button class="action-btn" on:click={toggleSelectAll}>
          {getSelectedCount() > 0 ? pluginInstance.i18n["incrementalShare"]["deselectAll"] : pluginInstance.i18n["incrementalShare"]["selectAll"]}
        </button>
      </div>
    </div>

    <div class="tree-container">
      {#each subdocumentTree as node}
        <TreeNode
          node={node}
          selectedDocIds={selectedDocIds}
          expandedNodes={expandedNodes}
          onToggleExpand={toggleExpand}
          onToggleSelect={toggleSelect}
          isBlacklisted={isBlacklistedSync}
          depth={0}
        />
      {/each}
    </div>
  {/if}
</div>

<style lang="stylus">
  .subdocument-tree-preview
    padding 12px
    border 1px solid var(--b3-theme-surface-light)
    border-radius 4px
    background-color var(--b3-theme-background)

  .loading-container
    display flex
    flex-direction column
    align-items center
    justify-content center
    padding 20px

  .spinner
    width 20px
    height 20px
    border 2px solid var(--b3-theme-surface-light)
    border-top 2px solid var(--b3-theme-primary)
    border-radius 50%
    animation spin 1s linear infinite

  .loading-text
    margin-top 8px
    color var(--b3-theme-on-surface)

  .empty-state
    text-align center
    color var(--b3-theme-on-surface)
    padding 20px

  .preview-header
    display flex
    justify-content space-between
    align-items center
    margin-bottom 12px
    padding-bottom 8px
    border-bottom 1px solid var(--b3-theme-surface-light)

  .stats
    display flex
    gap 16px

  .stat-item
    font-size 12px
    color var(--b3-theme-on-surface)

  .actions
    display flex
    gap 8px

  .action-btn
    padding 4px 8px
    font-size 12px
    border 1px solid var(--b3-theme-primary)
    background-color transparent
    color var(--b3-theme-primary)
    border-radius 3px
    cursor pointer
    transition all 0.2s ease

    &:hover
      background-color var(--b3-theme-primary)
      color var(--b3-theme-background)

  .tree-container
    max-height 400px
    overflow-y auto

  @keyframes spin
    from
      transform rotate(0deg)
    to
      transform rotate(360deg)
</style>