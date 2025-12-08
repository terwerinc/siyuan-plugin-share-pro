/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2024-2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import { simpleLogger } from "zhi-lib-base"
import { SiYuanApiAdaptor, SiyuanConfig, SiyuanKernelApi } from "zhi-siyuan-api"
import { isDev } from "../Constants"
import { ShareProConfig } from "../models/ShareProConfig"

/**
 * 通用 Siyuan API 封装
 */
export const useSiyuanApi = (cfg: ShareProConfig) => {
  const logger = simpleLogger("use-siyuan-api", "share-pro", isDev)

  if (cfg.siyuanConfig.apiUrl !== window.location.origin) {
    logger.warn("siyuan api url not match, use default")
    cfg.siyuanConfig.apiUrl = window.location.origin
  }
  cfg.siyuanConfig.token = ""
  const siyuanConfig = new SiyuanConfig(cfg.siyuanConfig.apiUrl, cfg.siyuanConfig.token)
  // 开启了授权码可能不可用
  siyuanConfig.cookie = ""
  // siyuanConfig.cookie = cfg.siyuanConfig.cookie
  // 一些常用设置
  siyuanConfig.preferenceConfig.fixTitle = cfg.siyuanConfig?.preferenceConfig?.fixTitle ?? false
  siyuanConfig.preferenceConfig.docTreeEnable = cfg.appConfig?.docTreeEnabled ?? true
  siyuanConfig.preferenceConfig.docTreeLevel = cfg.appConfig?.docTreeLevel ?? 3
  siyuanConfig.preferenceConfig.outlineEnable = cfg.appConfig?.outlineEnabled ?? true
  siyuanConfig.preferenceConfig.outlineLevel = cfg.appConfig?.outlineLevel ?? 6
  siyuanConfig.preferenceConfig.removeFirstH1 = true
  siyuanConfig.preferenceConfig.removeMdWidgetTag = true
  const blogApi = new SiYuanApiAdaptor(siyuanConfig)
  const kernelApi = new SiyuanKernelApi(siyuanConfig)
  logger.debug("siyuan api inited")

  return {
    blogApi,
    kernelApi,
  }
}

/**
 * 分页获取所有文档
 * @param kernelApi 思源内核 API
 * @param pageNum 页码（从 0 开始）
 * @param pageSize 每页大小
 * @param lastShareTime 上次分享时间戳（用于增量检测）
 */
export const getDocumentsPaged = async (
  kernelApi: SiyuanKernelApi,
  pageNum: number,
  pageSize: number,
  lastShareTime?: number // 增量时间戳
): Promise<
  Array<{
    docId: string
    docTitle: string
    modifiedTime: number
    notebookId?: string
    notebookName?: string
  }>
> => {
  const offset = pageNum * pageSize

  // SQL 查询：获取所有文档，按更新时间排序，支持分页
  // 如果有 lastShareTime，则只获取自该时间以来修改的文档
  // 注意：SiYuan 使用的是 Unix 时间戳格式（毫秒），需要直接比较
  // 当 lastShareTime 为 0 时，表示获取所有文档
  const timeCondition = lastShareTime && lastShareTime > 0 ? `AND b.updated > ${lastShareTime}` : ""

  const sql = `
    SELECT DISTINCT 
      b.root_id as docId,
      b.content as docTitle,
      b.updated as modifiedTime,
      b.box as notebookId
    FROM blocks b
    WHERE b.id = b.root_id
      AND b.type = 'd'
      ${timeCondition}
    ORDER BY b.updated DESC, b.created DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `

  const result = await kernelApi.sql(sql)

  if (result.code !== 0 || !result.data) {
    return []
  }

  return result.data.map((row: any) => ({
    docId: row.docId,
    docTitle: row.docTitle || "未命名文档",
    // modifiedTime 看起来是形如 "20251208000004" 的字符串，需要转换为 Unix 时间戳
    modifiedTime:
      row.modifiedTime && typeof row.modifiedTime === "string"
        ? new Date(
            parseInt(row.modifiedTime.substring(0, 4)), // 年
            parseInt(row.modifiedTime.substring(4, 6)) - 1, // 月（需要减1，因为月份从0开始）
            parseInt(row.modifiedTime.substring(6, 8)), // 日
            parseInt(row.modifiedTime.substring(8, 10)), // 时
            parseInt(row.modifiedTime.substring(10, 12)), // 分
            parseInt(row.modifiedTime.substring(12, 14)) // 秒
          ).getTime()
        : parseInt(row.modifiedTime) || 0,
    notebookId: row.notebookId,
    notebookName: row.notebookId, // 这里可以后续优化获取笔记本名称
  }))
}

/**
 * 获取文档总数
 * @param kernelApi 思源内核 API
 * @param lastShareTime 上次分享时间戳（用于增量检测）
 */
export const getDocumentsCount = async (kernelApi: SiyuanKernelApi, lastShareTime?: number): Promise<number> => {
  // 如果有 lastShareTime，则只计算自该时间以来修改的文档数量
  // 注意：SiYuan 使用的是 Unix 时间戳格式（毫秒），需要直接比较
  // 当 lastShareTime 为 0 时，表示获取所有文档
  const timeCondition = lastShareTime && lastShareTime > 0 ? `AND b.updated > ${lastShareTime}` : ""

  const sql = `
    SELECT COUNT(DISTINCT b.root_id) as total
    FROM blocks b
    WHERE b.id = b.root_id
      AND b.type = 'd'
      ${timeCondition}
  `

  const result = await kernelApi.sql(sql)

  if (result.code !== 0 || !result.data || result.data.length === 0) {
    return 0
  }

  return parseInt(result.data[0].total) || 0
}
