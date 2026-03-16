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
  import {isDev, SHARE_PRO_STORE_NAME} from "../../Constants";
  import { useSiyuanApi } from "../../composables/useSiyuanApi";
  import ShareProPlugin from "../../index";
  import { getSubdocCount, getSubdocTreeByPath, getDocNotebookInfo } from "../../composables/useSiyuanApi";
  import { SettingKeys } from "../../utils/SettingKeys";
  import RecursiveTreeNode from "./RecursiveTreeNode.svelte";
  import {ShareProConfig} from "../../models/ShareProConfig";

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
  let notebookId = "";
  let rootDocPath = "";

  // 初始化
  onMount(async () => {
    await loadSubdocumentTree();
  });

  // 加载子文档树（根层级）
  const loadSubdocumentTree = async () => {
    if (!docId) return;

    isLoading = true;
    try {
      const cfg = await pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME);
      const { kernelApi } = useSiyuanApi(cfg);

      // 获取文档的笔记本信息
      const docInfo = await getDocNotebookInfo(kernelApi, docId);

      // 如果文档不存在或无法获取信息，显示空状态
      if (!docInfo) {
        logger.warn(`Document ${docId} not found or inaccessible, showing empty subdocument tree`);
        subdocumentTree = [];
        totalSubdocuments = 0;
        return;
      }

      notebookId = docInfo.notebookId || "";
      rootDocPath = docInfo.docPath || "";

      // 如果没有有效的笔记本ID或路径，显示空状态
      if (!notebookId || !rootDocPath) {
        logger.warn(`Invalid notebook info for document ${docId}, showing empty subdocument tree`);
        subdocumentTree = [];
        totalSubdocuments = 0;
        return;
      }

      // 获取总数
      totalSubdocuments = await getSubdocCount(kernelApi, docId);

      // 使用思源官方API获取根层级的子文档
      const subdocs = await getSubdocTreeByPath(kernelApi, notebookId, rootDocPath);

      // 构建树形结构
      subdocumentTree = subdocs.map(subdoc => ({
        docId: subdoc.docId || "",
        docTitle: subdoc.docTitle || "Untitled Document",
        path: subdoc.path || "",
        parentId: subdoc.parentId,
        depth: subdoc.depth || 0,
        modifiedTime: subdoc.modifiedTime || 0,
        createdTime: subdoc.createdTime || 0,
        hasChildren: subdoc.hasChildren || false,
        children: [], // 初始化为空数组，支持懒加载
        loaded: false, // 标记是否已加载子节点
      }));

      // 默认选中所有文档
      selectedDocIds = new Set();
      subdocumentTree.forEach(node => {
        selectedDocIds.add(node.docId);
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

  // 懒加载子节点
  const loadChildren = async (parentNode: any) => {
    if (!parentNode || !parentNode.hasChildren || parentNode.loaded) {
      return;
    }

    try {
      const cfg = await pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME);
      const { kernelApi } = useSiyuanApi(cfg);

      // 获取子节点
      const children = await getSubdocTreeByPath(kernelApi, notebookId, parentNode.path);

      // 在树中找到指定节点并更新其children
      const updateNodeChildren = (nodes: any[], targetId: string, newChildren: any[]): any[] => {
        return nodes.map(node => {
          if (node.docId === targetId) {
            // 找到目标节点，更新其children
            return {
              ...node,
              children: newChildren.map(child => ({
                ...child,
                children: [],
                loaded: false,
              })),
              loaded: true,
            };
          }
          // 如果当前节点有children，递归搜索
          if (node.children && node.children.length > 0) {
            return {
              ...node,
              children: updateNodeChildren(node.children, targetId, newChildren),
            };
          }
          return node;
        });
      };

      subdocumentTree = updateNodeChildren(subdocumentTree, parentNode.docId, children);

      // 默认选中新加载的子节点
      children.forEach(child => {
        selectedDocIds.add(child.docId);
      });

      if (onSubdocumentSelect) {
        onSubdocumentSelect(Array.from(selectedDocIds));
      }
    } catch (error) {
      logger.error("Failed to load children for node", parentNode.docId, error);
    }
  };

  // 查找任意层级的节点
  const findNodeInTree = (nodes: any[], targetId: string): any => {
    for (const node of nodes) {
      if (node.docId === targetId) {
        return node;
      }
      if (node.children && node.children.length > 0) {
        const found = findNodeInTree(node.children, targetId);
        if (found) return found;
      }
    }
    return null;
  };

  // 切换节点展开/折叠
  const toggleExpand = async (nodeId: string) => {
    const node = findNodeInTree(subdocumentTree, nodeId);
    if (!node) return;

    if (expandedNodes.has(nodeId)) {
      // 创建新的Set来触发Svelte响应式更新
      expandedNodes = new Set([...expandedNodes].filter(id => id !== nodeId));
    } else {
      // 创建新的Set来触发Svelte响应式更新
      expandedNodes = new Set([...expandedNodes, nodeId]);
      // 如果有子节点且未加载，则懒加载
      if (node.hasChildren && !node.loaded) {
        await loadChildren(node);
      }
    }
  };

  // 查找节点（使用统一的查找方法）
  const findNodeById = (docId: string): any => {
    return findNodeInTree(subdocumentTree, docId);
  };

  // 递归获取所有子节点的ID
  const getAllChildIds = (node: any): string[] => {
    let ids = [node.docId];
    if (node.children && node.children.length > 0) {
      node.children.forEach((child: any) => {
        ids = ids.concat(getAllChildIds(child));
      });
    }
    return ids;
  };

  // 获取所有节点ID
  const getAllNodesIds = (nodes: any[]): string[] => {
    let ids: string[] = [];
    nodes.forEach(node => {
      ids.push(node.docId);
      if (node.children && node.children.length > 0) {
        ids = ids.concat(getAllNodesIds(node.children));
      }
    });
    return ids;
  };

  // 切换单个文档选择（支持父子联动）
  const toggleSelect = (docId: string, event: Event) => {
    event.stopPropagation();

    const node = findNodeById(docId);
    if (!node) return;

    let newSelectedIds: Set<string>;
    if (selectedDocIds.has(docId)) {
      // 创建新的Set来触发Svelte响应式更新
      const idsToRemove = new Set([docId]);
      if (node.children && node.children.length > 0) {
        const allChildIds = getAllChildIds(node);
        allChildIds.forEach(id => idsToRemove.add(id));
      }
      newSelectedIds = new Set([...selectedDocIds].filter(id => !idsToRemove.has(id)));
    } else {
      // 创建新的Set来触发Svelte响应式更新
      newSelectedIds = new Set([...selectedDocIds, docId]);
      if (node.children && node.children.length > 0) {
        const allChildIds = getAllChildIds(node);
        allChildIds.forEach(id => newSelectedIds.add(id));
      }
    }
    selectedDocIds = newSelectedIds;

    if (onSubdocumentSelect) {
      onSubdocumentSelect(Array.from(selectedDocIds));
    }
  };

  // 全选/反选
  const toggleSelectAll = () => {
    const allIds = getAllNodesIds(subdocumentTree);
    const allSelected = allIds.every(id => selectedDocIds.has(id));

    if (allSelected) {
      selectedDocIds = new Set();
    } else {
      selectedDocIds = new Set(allIds);
    }

    if (onSubdocumentSelect) {
      onSubdocumentSelect(Array.from(selectedDocIds));
    }
  };

  // 仅分享首层子文档
  const selectFirstLevelOnly = () => {
    const firstLevelIds = subdocumentTree.map(node => node.docId);
    selectedDocIds = new Set(firstLevelIds);

    if (onSubdocumentSelect) {
      onSubdocumentSelect(Array.from(selectedDocIds));
    }
  };

  // 同步检查黑名单（用于UI渲染）
  const isBlacklistedSync = (): boolean => {
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
        <RecursiveTreeNode
          node={node}
          selectedDocIds={selectedDocIds}
          expandedNodes={expandedNodes}
          onToggleExpand={toggleExpand}
          onToggleSelect={(docId, event) => toggleSelect(docId, event)}
          isBlacklisted={() => isBlacklistedSync()}
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