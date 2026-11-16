import { DATA_VIEW_TYPES, normalizeDataViewEntry } from "../utils/DataViewContract"
import * as cheerio from "cheerio"
import { ShareProConfig } from "../models/ShareProConfig"
import { useSiyuanApi } from "./useSiyuanApi"
import { simpleLogger } from "zhi-lib-base"
import { isDev } from "../Constants"

/**
 * 数据库视图数据采集。
 *
 * 采集范围由真实思源视图契约确定：table、list、gallery、kanban、calendar。
 * 未知类型不进入共享 payload，避免查看端把未知响应错误当成表格。
 */
const useDataTable = (cfg: ShareProConfig) => {
  const logger = simpleLogger("use-data-table", "share-pro", isDev)
  const { kernelApi } = useSiyuanApi(cfg)

  const getDataViews = async (editorDom: string) => {
    const $ = cheerio.load(editorDom)
    const dataTableIds: { dataTableId: string; defaultViewId?: string }[] = []
    const seen = new Set<string>()

    $("div[data-av-type]").each((_index, element) => {
      const dataAvType = $(element).attr("data-av-type")
      const dataTableId = $(element).attr("data-av-id")
      const defaultViewId = $(element).attr("custom-sy-av-view")
      if (!dataTableId || !dataAvType || !DATA_VIEW_TYPES.includes(dataAvType as any) || seen.has(dataTableId)) {
        return
      }
      seen.add(dataTableId)
      dataTableIds.push({ dataTableId, defaultViewId })
    })

    const results = await Promise.all(
      dataTableIds.map(async (item) => {
        const resultMap: Record<string, any> = {
          [item.dataTableId]: { order: [], viewTypes: {} },
        }

        const storeView = (viewId: string, response: any) => {
          const normalized = normalizeDataViewEntry(response, viewId)
          resultMap[item.dataTableId][viewId] = normalized
          resultMap[item.dataTableId].viewTypes[viewId] = normalized.viewType
          if (!resultMap[item.dataTableId].order.includes(viewId)) {
            resultMap[item.dataTableId].order.push(viewId)
          }
        }

        const initialRes = await kernelApi.siyuanRequest("/api/av/renderAttributeView", {
          id: item.dataTableId,
          viewID: item.defaultViewId || "",
          query: "",
        })
        logger.debug(`renderAttributeView res for ${item.dataTableId}:`, initialRes)

        let fallbackViewId = item.defaultViewId
        if (!fallbackViewId && initialRes.view?.id) {
          fallbackViewId = initialRes.view.id
        }

        if (fallbackViewId && initialRes.view) {
          storeView(fallbackViewId, initialRes)
        }

        if (initialRes.views) {
          const otherViewPromises = initialRes.views
            .filter((view: any) => view.id !== fallbackViewId && DATA_VIEW_TYPES.includes(view.type))
            .map(async (view: any) => {
              const response = await kernelApi.siyuanRequest("/api/av/renderAttributeView", {
                id: item.dataTableId,
                viewID: view.id,
                query: "",
              })
              logger.debug(`renderAttributeView res for view ${view.id}:`, response)
              storeView(view.id, response)
            })
          await Promise.all(otherViewPromises)
        }

        return resultMap
      })
    )

    const mergedResults = results.reduce((acc, cur) => ({ ...acc, ...cur }), {})
    logger.debug("Merged results:", mergedResults)
    return mergedResults
  }

  return { getDataViews }
}

export { useDataTable }
