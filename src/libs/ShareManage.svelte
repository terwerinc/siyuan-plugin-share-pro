<!--
  -            GNU GENERAL PUBLIC LICENSE
  -               Version 3, 29 June 2007
  -
  -  Copyright (C) 2024 Terwer, Inc. <https://terwer.space/>
  -  Everyone is permitted to copy and distribute verbatim copies
  -  of this license document, but changing it is not allowed.
  -->
<script lang="ts">
  import ShareProPlugin from "../index"
  import { KeyInfo } from "../models/KeyInfo"
  import { onMount } from "svelte"
  import { ShareService } from "../service/ShareService"
  import { simpleLogger } from "zhi-lib-base"
  import { isDev, SHARE_LIST_PAGE_SIZE } from "../Constants"
  import Bench from "./components/bench/Bench.svelte"
  import { confirm, openTab, showMessage } from "siyuan"

  const logger = simpleLogger("share-manage", "share-pro", isDev)
  export let pluginInstance: ShareProPlugin
  export let keyInfo: KeyInfo
  const shareService = new ShareService(pluginInstance)
  let docs = []

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
</style>
