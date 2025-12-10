<!--
  -            GNU GENERAL PUBLIC LICENSE
  -               Version 3, 29 June 2007
  -
  -  Copyright (C) 2024-2025 Terwer, Inc. <https://terwer.space/>
  -  Everyone is permitted to copy and distribute verbatim copies
  -  of this license document, but changing it is not allowed.
  -->
<script lang="ts">
  import { confirm, openTab, showMessage } from "siyuan"
  import { onMount } from "svelte"
  import { simpleLogger } from "zhi-lib-base"
  import { isDev, SHARE_LIST_PAGE_SIZE, SHARE_PRO_STORE_NAME } from "../../Constants"
  import ShareProPlugin from "../../index"
  import { KeyInfo } from "../../models/KeyInfo"
  import { ShareProConfig } from "../../models/ShareProConfig"
  import { SettingService } from "../../service/SettingService"
  import { hidePopover, showPopover } from "../../utils/popoverUtils"
  import { syncAppConfig } from "../../utils/ShareConfigUtils"
  import { getChineseCharCount, truncateByChineseChar } from "../../utils/utils"
  import Bench from "../components/bench/Bench.svelte"

  const logger = simpleLogger("share-manage", "share-pro", isDev)
  export let pluginInstance: ShareProPlugin
  export let keyInfo: KeyInfo
  export let pageSize: number = SHARE_LIST_PAGE_SIZE // 允许传递自定义分页大小
  const shareService = pluginInstance.shareService
  let docs = []
  let loading = false
  let settingConfig: ShareProConfig

  let tableData,
    tableLimit = pageSize, // 使用传递的pageSize或默认值
    tableOffset = 0,
    tableOrder,
    tableDir,
    tableSearch

  const tableColumns = [
    {
      id: "title",
      name: pluginInstance.i18n.manage.columnTitle,
      html: true,
      sort: false,
      formatter: (cell) => {
        // 限制最多显示6个汉字字符（区分中英文）
        const maxLength = 6;
        
        // 计算标题中的汉字字符数
        const chineseCharCount = getChineseCharCount(cell);
        
        if (chineseCharCount > maxLength) {
          // 截取前6个汉字字符并添加popover和复制功能
          const truncated = truncateByChineseChar(cell, maxLength);
          // 添加复制图标，使用data-title存储完整标题
          return `<span class="title-container">
            <span class="title-popover" data-title="${cell}">${truncated}...</span>
            <span class="copy-icon" data-full-title="${cell}" title="${pluginInstance.i18n.manage.copyFullTitle}">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M13 5h-3c-.6 0-1-.4-1-1v-3h-6v12h5v1h-6c-.6 0-1-.4-1-1v-12c0-.6.4-1 1-1h7c.6 0 1 .4 1 1v3h3v7h-1v-7zm-3-2.5v1.5h1.5l-1.5-1.5zm-6 11v-10h5v3c0 .6.4 1 1 1h3v6h-9z"/>
              </svg>
            </span>
          </span>`;
        } else {
          // 对于未截断的标题也添加复制功能
          return `<span class="title-container">
            <span class="title-text">${cell}</span>
            <span class="copy-icon" data-full-title="${cell}" title="${pluginInstance.i18n.manage.copyFullTitle}">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M13 5h-3c-.6 0-1-.4-1-1v-3h-6v12h5v1h-6c-.6 0-1-.4-1-1v-12c0-.6.4-1 1-1h7c.6 0 1 .4 1 1v3h3v7h-1v-7zm-3-2.5v1.5h1.5l-1.5-1.5zm-6 11v-10h5v3c0 .6.4 1 1 1h3v6h-9z"/>
              </svg>
            </span>
          </span>`;
        }
      },
      onMouseOver: (e) => {
        const target = e.target as HTMLElement;
        // 处理popover显示
        if (target.classList.contains('title-popover')) {
          const title = target.getAttribute('data-title');
          if (title) {
            showPopover(e, title);
          }
        }
      },
      onMouseOut: (e) => {
        const target = e.target as HTMLElement;
        // 只有当鼠标离开popover相关元素时才隐藏popover
        // 注意：不要在鼠标离开copy-icon时隐藏popover，因为用户可能想要点击它
        if (!target.classList.contains('title-popover') && !target.classList.contains('copy-icon')) {
          hidePopover();
        }
      },
      onClick: (e) => {
        const target = e.target as HTMLElement;
        // 处理复制功能 - 检查点击的元素是否是复制图标或其子元素
        if (target.classList.contains('copy-icon') || target.closest('.copy-icon')) {
          const copyIcon = target.classList.contains('copy-icon') ? target : target.closest('.copy-icon');
          const fullTitle = copyIcon.getAttribute('data-full-title');
          if (fullTitle) {
            // 复制到剪贴板
            navigator.clipboard.writeText(fullTitle).then(() => {
              // 显示成功消息
              showMessage(pluginInstance.i18n.ui.copySuccess, 2000, "info");
            }).catch(err => {
              console.error('复制失败:', err);
              showMessage(pluginInstance.i18n.manage.copyFailed, 2000, "error");
            });
          }
        }
      },
    },
    {
      id: "createdAt",
      name: pluginInstance.i18n.manage.columnCreatedAt,
      formatter: (cell) => {
        return cell
      },
    },
    {
      id: "media_count",
      name: pluginInstance.i18n.manage.columnMediaCount,
      sort: false,
    },
    {
      id: "status",
      name: pluginInstance.i18n.manage.columnStatus,
      html: true,
      formatter: (cell) => {
        // 根据枚举来
        // ING("ing")
        // COMPLETED("completed")
        // FAILED("failed")
        const statusMap = {
          ING: pluginInstance.i18n.manage.statusIng,
          COMPLETED: pluginInstance.i18n.manage.statusSuccess,
          FAILED: pluginInstance.i18n.manage.statusError,
        }
        return statusMap[cell]
      },
      onClick: (e) => {},
    },
    {
      id: "action",
      name: pluginInstance.i18n.manage.action,
      html: true,
      sort: false,
      formatter: (row) => {
        if (!row || !row.docId) {
          return '<div class="action-container">-</div>';
        }
        
        // 获取文档ID
        const docId = row.docId;
        
        // 将原有的文字链接转换为图标+小文字的形式
        return `
          <div class="action-container">
            <!-- 取消分享 -->
            <span class="action-item cancel-share" 
                  onclick="window.cancelShareFromSharePro('${docId}','${row.title}')" 
                  title="${pluginInstance.i18n.manage.actionCancel}">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1.5c-3.6 0-6.5 2.9-6.5 6.5s2.9 6.5 6.5 6.5 6.5-2.9 6.5-6.5-2.9-6.5-6.5-6.5zm3.7 8.2l-1.2 1.2-2.5-2.5-2.5 2.5-1.2-1.2 2.5-2.5-2.5-2.5 1.2-1.2 2.5 2.5 2.5-2.5 1.2 1.2-2.5 2.5 2.5 2.5z"/>
              </svg>
              <span class="action-text">${pluginInstance.i18n.manage.actionCancelShort}</span>
            </span>
            
            <!-- 设置首页 -->
            <span class="action-item set-home ${(settingConfig?.appConfig?.homePageId === docId) ? 'set-already' : ''}" 
                  onclick="window.setHomeFromSharePro('${docId}','${row.title}',${settingConfig?.appConfig?.homePageId === docId})" 
                  title="${settingConfig?.appConfig?.homePageId === docId ? pluginInstance.i18n.manage.actionSetAlready : pluginInstance.i18n.manage.actionSetHome}">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1.5l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4l2-4zm0 2.3l-1.1 2.2-2.4.4 1.8 1.7-.4 2.4 2.1-1.1 2.1 1.1-.4-2.4 1.8-1.7-2.4-.4-1.1-2.2z"/>
              </svg>
              <span class="action-text">${pluginInstance.i18n.manage.actionSetHomeShort}</span>
            </span>
            
            <!-- 查看文档 -->
            <span class="action-item view-doc" 
                  onclick="window.viewDocFromSharePro('${docId}','${row.title}')" 
                  title="${pluginInstance.i18n.manage.actionViewDoc}">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3 2c-.6 0-1 .4-1 1v10c0 .6.4 1 1 1h10c.6 0 1-.4 1-1v-5h-1v5h-10v-10h5v-1h-5zm8 0v1h2.6l-5.3 5.3.7.7 5.3-5.3v2.6h1v-5h-5z"/>
              </svg>
              <span class="action-text">${pluginInstance.i18n.manage.actionViewDocShort}</span>
            </span>
            
            <!-- 跳转到原文档 -->
            <span class="action-item go-to-doc" 
                  onclick="window.goToOriginalDocFromSharePro('${docId}')" 
                  title="${pluginInstance.i18n.manage.actionGotoDoc}">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M12 2h-2v3h2v2h3v2h-3v3h-2v-3h-2v3h-3v-2h3v-2h-3v-2h3v-3h2v3h2v-3h2zm-4 4h-2v2h2v-2z"/>
              </svg>
              <span class="action-text">${pluginInstance.i18n.manage.actionGotoDocShort}</span>
            </span>
            
            <!-- 复制文档ID -->
            <span class="action-item copy-id" 
                  data-doc-id="${docId}" 
                  title="${pluginInstance.i18n.manage.copyDocId}">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M11 1.5h-5c-.3 0-.5.2-.5.5v1h-4c-.3 0-.5.2-.5.5v9c0 .3.2.5.5.5h4v1h-4c-.8 0-1.5-.7-1.5-1.5v-9c0-.8.7-1.5 1.5-1.5h4v-1c0-.3.2-.5.5-.5h5c.3 0 .5.2.5.5v1h3v7h-3v1h3c.8 0 1.5-.7 1.5-1.5v-7c0-.8-.7-1.5-1.5-1.5zm-1 .5v1h1v-1h-1zm-6 10v-8h4v1c0 .3.2.5.5.5h3v6h-7.5z"/>
              </svg>
              <span class="action-text">${pluginInstance.i18n.manage.copyDocIdShort}</span>
            </span>
          </div>
        `;
      },
      onMouseOver: (e) => {
        const target = e.target as HTMLElement;
        // 为操作项添加popover提示
        if (target.classList.contains('action-item')) {
          const title = target.getAttribute('title');
          if (title) {
            showPopover(e, title);
          }
        }
      },
      onMouseOut: (e) => {
        const target = e.target as HTMLElement;
        // 鼠标离开操作项时延迟隐藏popover（1秒）
        if (target.classList.contains('action-item')) {
          hidePopover(1000); // 延迟1秒隐藏
        }
      },
      onClick: (e) => {
        const target = e.target as HTMLElement;
        // 检查点击的元素是否是操作项或其子元素
        const actionItem = target.classList.contains('action-item') ? target : target.closest('.action-item');
        
        if (actionItem && actionItem.classList.contains('copy-id')) {
          const docId = actionItem.getAttribute('data-doc-id');
          if (docId) {
            // 复制到剪贴板
            navigator.clipboard.writeText(docId).then(() => {
              // 显示成功消息
              showMessage(pluginInstance.i18n.ui.copySuccess, 2000, "info");
            }).catch(err => {
              console.error('复制失败:', err);
              showMessage(pluginInstance.i18n.manage.copyFailed, 2000, "error");
            });
          }
        }
      },
    },
  ]

  const updateTable = async function () {
    loading = true
    try {
      console.log("start update table:", {
        tableOffset,
        tableLimit,
        tableOrder,
        tableDir,
        tableSearch,
      })
      // 需要根据 tableOffset tableLimit计算 pageNum
      const pageNum = Math.ceil(tableOffset / tableLimit)
      const resp = await shareService.listDoc(pageNum, tableLimit, tableOrder, tableDir, tableSearch)
      docs = resp.data.data
      tableData = {
        results: docs.map((doc) => {
          return {
            docId: doc.docId,
            // author: keyInfo.email,
            title: doc.data.title,
            media_count: doc.media.length,
            createdAt: doc.createdAt,
            status: doc.status,
            action: {
              docId: doc.docId,
              title: doc.data.title,
            },
          }
        }),
        recordsTotal: resp.data.total,
      }
      logger.info(`loaded docs for ${keyInfo.email}`, docs)
    } catch (e) {
      showMessage(pluginInstance.i18n.manage.dataLoadingError, e)
    } finally {
      loading = false
    }
  }

  // @ts-ignore
  window.cancelShareFromSharePro = async function (docId: string, docTitle: string) {
    confirm(pluginInstance.i18n.tipTitle, pluginInstance.i18n.confirmDelete + "【" + docTitle + "】", async () => {
      const ret = await shareService.cancelShare(docId)
      if (ret.code === 0) {
        await updateTable()
        showMessage(pluginInstance.i18n.topbar.cancelSuccess, 3000, "info")
      } else {
        showMessage(pluginInstance.i18n.topbar.cancelError + ret.msg, 7000, "error")
      }
    })
  }

  // @ts-ignore
  window.setHomeFromSharePro = async function (docId: string, docTitle: string, isSet: boolean) {
    if (isSet) {
      return
    }

    const msgSetHomeConfirmWithParam = pluginInstance.i18n.manage.setHomeConfirm
    const msgSetHomeConfirm = msgSetHomeConfirmWithParam.replace("[param1]", docTitle)
    confirm(pluginInstance.i18n.tipTitle, msgSetHomeConfirm, async () => {
      settingConfig.appConfig.homePageId = docId
      await pluginInstance.saveData(SHARE_PRO_STORE_NAME, settingConfig)
      try {
        const settingService = new SettingService(pluginInstance)
        await syncAppConfig(settingService, settingConfig)
        await updateTable()
        showMessage(`${pluginInstance.i18n.manage.setHomeSuccess}`, 2000, "info")
      } catch (e) {
        showMessage(`${pluginInstance.i18n.manage.setHomeError}${e}`, 7000, "error")
      }
    })
  }

  // @ts-ignore
  window.viewDocFromSharePro = async function (docId: string, _docTitle: string) {
    const docInfo = await shareService.getSharedDocInfo(docId)
    const shareData = docInfo?.data ? JSON.parse(docInfo.data) : null
    if (!shareData) {
      const noShareMsg = pluginInstance.i18n.topbar.msgNoShare + docInfo.msg
      showMessage(noShareMsg, 7000, "error")
      return
    }
    window.open(shareData.viewUrl)
  }

  // @ts-ignore
  window.goToOriginalDocFromSharePro = function (docId: string) {
    openTab({
      app: pluginInstance.app,
      doc: {
        id: docId,
      },
    })
  }

  onMount(async () => {
    settingConfig = await pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
    await updateTable()
  })

  $: tableLimit, tableOffset, tableOrder, tableDir, tableSearch, updateTable()
</script>

<div id="share-manage">
  {#if loading}
    <div class="loading-indicator-container">
      <div class="loading-indicator">
        <div class="spinner" />
        <span>{pluginInstance.i18n.manage.dataLoading}</span>
      </div>
    </div>
  {/if}
  <Bench
    data={tableData}
    columns={tableColumns}
    bind:order={tableOrder}
    bind:dir={tableDir}
    bind:offset={tableOffset}
    bind:limit={tableLimit}
    bind:search={tableSearch}
    classBenchContainer="share-bench-container"
    searchPlaceholder={pluginInstance.i18n.manage.tableKeyword}
    textPrevious={pluginInstance.i18n.manage.tablePrevious}
    textNext={pluginInstance.i18n.manage.tableNext}
    textShowing={pluginInstance.i18n.manage.tableShowing}
    textTo={pluginInstance.i18n.manage.tableTo}
    textOf={pluginInstance.i18n.manage.tableOf}
    textEntries={pluginInstance.i18n.manage.tableEntries}
    textFiltered={pluginInstance.i18n.manage.tableFiltered}
    textPage={pluginInstance.i18n.manage.tablePage}
    textFirstPage={pluginInstance.i18n.manage.tableFirstPage}
  />
</div>
<style lang="stylus">
  #share-manage
    padding 10px
    position: relative

  .loading-indicator-container
    position: absolute
    top: 0
    left: 0
    right: 0
    bottom: 0
    background: rgba(255, 255, 255, 0.8) /* 蒙版层背景色 */
    display: flex
    flex-direction: column
    align-items: center
    justify-content: center
    z-index: 1000
  /* 确保蒙版层在最上层 */

  .loading-indicator
    display: flex
    align-items: center
    margin-top: 20px

  .spinner
    border: 4px solid rgba(0, 0, 0, 0.1)
    border-left-color: #000
    border-radius: 50%
    width: 20px
    height: 20px
    animation: spin 1s linear infinite
    margin-right: 10px

  /* 使文字与加载图标之间有间距 */

  @keyframes spin
    0%
      transform: rotate(0deg)
    100%
      transform: rotate(360deg)

  /* Title container styles - 使用组件前缀限定，避免样式冲突 */
  :global(#share-manage .title-container)
    display: flex
    align-items: center

  :global(#share-manage .docid-container)
    display: flex
    align-items: center

  :global(#share-manage .copy-icon)
    margin-left: 4px
    cursor: pointer
    font-size: 14px

  :global(#share-manage .copy-icon:hover)
    color: #007bff

  /* Action items styles - 使用组件前缀限定，避免样式冲突 */
  :global(#share-manage .action-container)
    display: flex
    gap: 4px  /* 减小间距 */
    align-items: center

  :global(#share-manage .action-item)
    display: inline-flex
    flex-direction: column
    align-items: center
    justify-content: center
    width: 40px  /* 减小宽度 */
    cursor: pointer
    border-radius: 6px
    transition: all 0.2s ease
    color: #666
    font-size: 12px

  :global(#share-manage .action-item:hover)
    background-color: #f0f0f0
    color: #007bff

  :global(#share-manage .action-item.set-already)
    color: #28a745

  :global(#share-manage .action-item.set-already:hover)
    background-color: #f0f0f0
    color: #218838

  :global(#share-manage .action-text)
    margin-top: 2px
    font-size: 10px
    white-space: nowrap
    overflow: hidden
    text-overflow: ellipsis
    max-width: 100%
</style>