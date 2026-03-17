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
  import {isDev, SHARE_PRO_STORE_NAME} from "../../../Constants";
  import { useSiyuanApi } from "../../../composables/useSiyuanApi";
  import ShareProPlugin from "../../../index";
  import { getSubdocCount, getSubdocTreeByPath, getDocNotebookInfo} from "../../../composables/useSiyuanApi";
  import RecursiveTreeNode from "./RecursiveTreeNode.svelte";
  import {ShareProConfig} from "../../../models/ShareProConfig";

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
  let treeExpanded = false; // 控制整个树的展开/折叠状态

  // 初始化
  onMount(async () => {
    await loadSubdocumentTree();
  });

  // 递归加载所有子节点
  const loadAllChildrenRecursively = async (parentNode: any) => {
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

      // 默认选中新加载的子节点，并将有子节点的添加到expandedNodes
      const newSelectedIds = new Set([...selectedDocIds]);
      const newExpandedIds = new Set([...expandedNodes]);
      children.forEach(child => {
        newSelectedIds.add(child.docId);
        if (child.hasChildren) {
          newExpandedIds.add(child.docId);
        }
      });
      selectedDocIds = newSelectedIds;
      expandedNodes = newExpandedIds;

      // 递归加载所有新加载的子节点的子节点
      for (const child of children) {
        if (child.hasChildren) {
          await loadAllChildrenRecursively(child);
        }
      }
    } catch (error) {
      logger.error("Failed to load children for node", { nodeId: parentNode.docId, error });
    }
  };

  // 加载子文档树（根层级）并递归加载所有子节点
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
        logger.warn("Document not found or inaccessible, showing empty subdocument tree", docId);
        subdocumentTree = [];
        totalSubdocuments = 0;
        return;
      }

      notebookId = docInfo.notebookId || "";
      rootDocPath = docInfo.docPath || "";

      // 如果没有有效的笔记本ID或路径，显示空状态
      if (!notebookId || !rootDocPath) {
        logger.warn("Invalid notebook info for document, showing empty subdocument tree", docId);
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
      const initialSelectedIds = new Set<string>();
      const initialExpandedIds = new Set<string>();

      // 先处理根节点
      subdocumentTree.forEach(node => {
        initialSelectedIds.add(node.docId);
        if (node.hasChildren) {
          initialExpandedIds.add(node.docId);
        }
      });
      selectedDocIds = initialSelectedIds;
      expandedNodes = initialExpandedIds;

      // 递归加载所有子节点
      for (const node of subdocumentTree) {
        if (node.hasChildren) {
          await loadAllChildrenRecursively(node);
        }
      }

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
      logger.error("Failed to load children for node", { nodeId: parentNode.docId, error });
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

  // 获取总文档数量（排除主文档）
  const getTotalCount = () => {
    // getSubdocCount 返回包含主文档的总数，所以减1得到真正的子文档数量
    return Math.max(0, totalSubdocuments - 1);
  };

  // 响应式计算属性 - 直接在模板中使用
  $: selectedCount = selectedDocIds.size;
  $: estimatedTime = selectedCount * 0.25;
  $: estimatedStorage = selectedCount * 100;
</script>

<div class="subdocument-tree-preview">
  {#if isLoading}
    <div class="loading-container">
      <div class="spinner" />
      <div class="loading-text">{pluginInstance.i18n["ui"]["dataLoading"]}</div>
    </div>
  {:else if subdocumentTree.length === 0}
    <div class="empty-state">
      {pluginInstance.i18n["ui"]["noSubdocuments"]}
    </div>
  {:else}
    <div class="preview-header">
      <div class="stats">
        <span class="stat-item">
          {pluginInstance.i18n["cs"]["maxSubdocumentsShow"]}:
          <strong>{selectedCount}/{getTotalCount()}</strong>
        </span>
        <span class="stat-item">
          {pluginInstance.i18n["incrementalShare"]["estimatedTime"]}:
          <strong>{Math.floor(estimatedTime / 60)}m {estimatedTime % 60}s</strong>
        </span>
        <span class="stat-item">
          {pluginInstance.i18n["incrementalShare"]["estimatedSize"]}:
          <strong>{estimatedStorage}KB</strong>
        </span>
      </div>
      <div class="actions">
        <button class="action-btn" on:click={selectFirstLevelOnly}>
          {pluginInstance.i18n["incrementalShare"]["firstLevelOnly"]}
        </button>
        <button class="action-btn" on:click={toggleSelectAll}>
          {pluginInstance.i18n["incrementalShare"]["selectAllToggle"]}
        </button>
      </div>
    </div>

    <div class="tree-toggle" on:click={() => treeExpanded = !treeExpanded}>
      <span class="toggle-icon">{treeExpanded ? '▼' : '▶'}</span>
      <span class="toggle-label">
        {treeExpanded ? "收起子文档" : "展开子文档"}
      </span>
    </div>

    {#if treeExpanded}
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

  .tree-toggle
    display flex
    align-items center
    gap 8px
    cursor pointer
    padding 6px 0
    color var(--b3-theme-primary)
    font-size 13px
    font-weight 500
    transition all 0.2s ease

  .tree-toggle:hover
    color var(--b3-theme-on-surface)

  .toggle-icon
    font-size 14px
    line-height 1
    transition transform 0.2s ease

  .toggle-label
    white-space nowrap

  .tree-container
    max-height 400px
    overflow-y auto

  @keyframes spin
    from
      transform rotate(0deg)
    to
      transform rotate(360deg)
</style>