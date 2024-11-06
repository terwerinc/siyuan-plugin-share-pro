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
  import { isDev, SHARE_LIST_PAGE_SIZE } from "../../Constants"
  import Bench from "../components/bench/Bench.svelte"
  import { confirm, openTab, showMessage } from "siyuan"

  const logger = simpleLogger("share-manage", "share-pro", isDev)
  export let pluginInstance: ShareProPlugin
  export let keyInfo: KeyInfo
  const shareService = new ShareService(pluginInstance)
  let docs = []
  let loading = false

  let tableData,
    tableLimit = SHARE_LIST_PAGE_SIZE,
    tableOffset = 0,
    tableOrder,
    tableDir,
    tableSearch

  const tableColumns = [
    { id: "docId", name: "文档ID", hidden: false },
    {
      id: "author",
      name: "作者",
      sort: false,
      onClick: (e) => {},
    },
    {
      id: "title",
      name: "文档标题",
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
      name: "分享时间",
      formatter: (cell) => {
        return cell
      },
    },
    {
      id: "media_count",
      name: "附件数量",
      sort: false,
    },
    {
      id: "status",
      name: "分享状态",
      html: true,
      formatter: (cell) => {
        // 根据枚举来
        // ING("ing")
        // COMPLETED("completed")
        // FAILED("failed")
        const statusMap = {
          ING: "分享进行中",
          COMPLETED: "分享完成",
          FAILED: "分享失败",
        }
        return statusMap[cell]
      },
      onClick: (e) => {},
    },
    {
      id: "action",
      name: "操作",
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
            docId: doc.docId,
            author: keyInfo.email,
            title: doc.data.title,
            media_count: doc.media.length,
            createdAt: doc.createdAt,
            status: doc.status,
            action: `
            <a href="javascript:;" onclick="window.cancelShareFromSharePro('${doc.docId}','${doc.data.title}')">取消分享</a>&nbsp;&nbsp;
            <a href="javascript:;" onclick="window.goToOriginalDocFromSharePro('${doc.docId}')">转到该文档</a>
            `,
          }
        }),
        recordsTotal: resp.data.total,
      }
      logger.info(`loaded docs for ${keyInfo.email}`, docs)
    } catch (e) {
      showMessage("数据加载失败:", e)
    } finally {
      loading = false
    }
  }

  // @ts-ignore
  window.cancelShareFromSharePro = async function (docId: string, docTitle) {
    confirm(pluginInstance.i18n.tipTitle, pluginInstance.i18n.confirmDelete + "【" + docTitle + "】", async () => {
      const ret = await shareService.deleteDoc(docId)
      if (ret.code === 0) {
        showMessage("文档已取消分享", 3000, "info")
      } else {
        showMessage("取消分享失败=>" + ret.msg, 7000, "error")
      }
    })
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
    await updateTable()
  })

  $: tableLimit, tableOffset, tableOrder, tableDir, tableSearch, updateTable()
</script>

<div id="share-manage">
  {#if loading}
    <div class="loading-indicator-container">
      <div class="loading-indicator">
        <div class="spinner" />
        <span>数据加载中...</span>
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
    searchPlaceholder="请输入关键字..."
    textPrevious="上一页"
    textNext="下一页"
    textShowing="当前数据为索引从"
    textTo="到"
    textOf="，共"
    textEntries="条记录"
    textFiltered="筛选"
    textPage="页码"
    textFirstPage="首页"
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
    z-index: 1000 /* 确保蒙版层在最上层 */

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
    margin-right: 10px /* 使文字与加载图标之间有间距 */

  @keyframes spin
    0%
      transform: rotate(0deg)
    100%
      transform: rotate(360deg)
</style>
