<!--
  -            GNU GENERAL PUBLIC LICENSE
  -               Version 3, 29 June 2007
  -
  -  Copyright (C) 2024 Terwer, Inc. <https://terwer.space/>
  -  Everyone is permitted to copy and distribute verbatim copies
  -  of this license document, but changing it is not allowed.
  -->
<script lang="ts">
  import ShareProPlugin from "../../index"
  import { KeyInfo } from "../../models/KeyInfo"
  import { onMount } from "svelte"
  import { ShareService } from "../../service/ShareService"
  import { simpleLogger } from "zhi-lib-base"
  import { isDev, SHARE_LIST_PAGE_SIZE, SHARE_PRO_STORE_NAME } from "../../Constants"
  import Bench from "../components/bench/Bench.svelte"
  import { confirm, openTab, showMessage } from "siyuan"
  import { ShareProConfig } from "../../models/ShareProConfig"
  import { syncAppConfig } from "../../utils/ShareConfigUtils"
  import { SettingService } from "../../service/SettingService"

  const logger = simpleLogger("share-manage", "share-pro", isDev)
  export let pluginInstance: ShareProPlugin
  export let keyInfo: KeyInfo
  const shareService = new ShareService(pluginInstance)
  let docs = []
  let loading = false
  let settingConfig: ShareProConfig

  let tableData,
    tableLimit = SHARE_LIST_PAGE_SIZE,
    tableOffset = 0,
    tableOrder,
    tableDir,
    tableSearch

  const tableColumns = [
    // { id: "docId", name: pluginInstance.i18n.manage.columnDocId, hidden: false },
    // {
    //   id: "author",
    //   name: pluginInstance.i18n.manage.columnAuthor,
    //   sort: false,
    //   onClick: (e) => {},
    // },
    {
      id: "title",
      name: pluginInstance.i18n.manage.columnTitle,
      html: true,
      sort: false,
      formatter: (cell) => {
        if (cell.length > 25) {
          return `<span title="${cell}">${cell.substring(0, 25)}...</span>`
        } else {
          return cell
        }
      },
      onClick: (e) => {},
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
            // docId: doc.docId,
            // author: keyInfo.email,
            title: doc.data.title,
            media_count: doc.media.length,
            createdAt: doc.createdAt,
            status: doc.status,
            action: `
            <a href="javascript:;" onclick="window.cancelShareFromSharePro('${doc.docId}','${doc.data.title}')">${pluginInstance.i18n.manage.actionCancel}</a>&nbsp;&nbsp;
            <a href="javascript:;" style="${settingConfig?.appConfig?.homePageId===doc.docId?'color:green;text-decoration:none;cursor:text;':''}" onclick="window.setHomeFromSharePro('${doc.docId}','${doc.data.title}',${settingConfig?.appConfig?.homePageId===doc.docId})">${settingConfig?.appConfig?.homePageId===doc.docId?pluginInstance.i18n.manage.actionSetAlready:pluginInstance.i18n.manage.actionSetHome}</a>&nbsp;&nbsp;
            <a href="javascript:;" onclick="window.viewDocFromSharePro('${doc.docId}','${doc.data.title}')">${pluginInstance.i18n.manage.actionViewDoc}</a>&nbsp;&nbsp;
            <a href="javascript:;" onclick="window.goToOriginalDocFromSharePro('${doc.docId}')">${pluginInstance.i18n.manage.actionGotoDoc}</a>
            `,
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
    if(isSet){
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

  .loading-indicator-container
    position: fixed
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
</style>
