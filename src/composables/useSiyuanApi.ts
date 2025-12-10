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
import { SettingKeys } from "../utils/SettingKeys"

/**
 * 通用 Siyuan API 封装
 *
 * @author terwer
 * @since 1.15.0
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
 * 分页获取增量分享文档（查询上次分享时间之后有变化的文档 + 从未分享过的文档）
 *
 * @param kernelApi 思源内核 API
 * @param pageNum 页码（从 0 开始）
 * @param pageSize 每页大小
 * @param lastShareTime 上次分享时间戳（用于增量检测）
 * @param searchTerm 搜索词
 * @param notebookBlacklist 笔记本黑名单列表
 */
export const getIncrementalDocumentsPaged = async (
  kernelApi: SiyuanKernelApi,
  pageNum: number,
  pageSize: number,
  lastShareTime?: number, // 增量时间戳
  searchTerm?: string, // 搜索词
  notebookBlacklist?: string[] // 笔记本黑名单列表
): Promise<
  Array<{
    docId: string
    docTitle: string
    modifiedTime: number
    notebookId?: string
  }>
> => {
  const logger = simpleLogger("use-siyuan-api", "share-pro", isDev)
  const offset = pageNum * pageSize

  // 构建完整的WHERE条件
  let whereCondition = " AND b.type = 'd'"

  // 1. 添加增量分享条件
  const timeCondition = generateTimeCondition(lastShareTime)
  const unsharedDocumentCondition = "a.block_id IS NULL" // 从未分享过的文档
  let sharedDocumentWithUpdatesCondition = "" // 已分享但在上次分享时间之后有更新的文档
  if (timeCondition && timeCondition.length > 0) {
    sharedDocumentWithUpdatesCondition = `(a.block_id IS NOT NULL AND ${timeCondition})`
  }
  if (sharedDocumentWithUpdatesCondition && sharedDocumentWithUpdatesCondition.length > 0) {
    // 有时间条件时：查询从未分享的文档 或 已分享但在上次分享时间之后有更新的文档
    whereCondition += ` AND (${unsharedDocumentCondition} OR ${sharedDocumentWithUpdatesCondition})`
  } else {
    // 没有时间条件时（首次分享）：只查询从未分享的文档
    whereCondition += ` AND ${unsharedDocumentCondition}`
  }

  // 2. 添加文档黑名单条件
  whereCondition += ` AND (a2.block_id IS NULL OR (a2.block_id IS NOT NULL AND a2.value != 'true'))`
  // 3. 添加笔记本黑名单条件
  if (notebookBlacklist && notebookBlacklist.length > 0) {
    const escapedNotebookIds = notebookBlacklist.map((id) => `'${id.replace(/'/g, "''")}'`).join(",")
    whereCondition += ` AND b.box NOT IN (${escapedNotebookIds})`
  }

  // 4. 添加搜索条件
  if (searchTerm && searchTerm.trim() !== "") {
    whereCondition += ` AND b.content LIKE '%${searchTerm.replace(/'/g, "''")}%'`
  }

  const sql = `
    SELECT DISTINCT 
      b.root_id as docId,
      b.content as docTitle,
      b.updated as modifiedTime,
      b.box as notebookId
    FROM blocks b
    LEFT JOIN attributes a ON a.block_id = b.id AND a.name = '${SettingKeys.CUSTOM_SHARE_HISTORY}'
    LEFT JOIN attributes a2 ON a2.block_id = b.id AND a2.name = '${SettingKeys.CUSTOM_SHARE_BLACKLIST_DOCUMENT}'
    WHERE b.id = b.root_id
      ${whereCondition}
    ORDER BY b.updated DESC, b.created DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `
  logger.debug("getIncrementalDocumentsPaged SQL:", sql)
  const resData = await kernelApi.sql(sql)
  if (!resData || resData.length === 0) {
    return []
  }

  return resData.map((row: any) => ({
    docId: row.docId,
    docTitle: row.docTitle || "Untitled Document",
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
  }))
}

/**
 * 获取增量分享文档总数（查询上次分享时间之后有变化的文档 + 从未分享过的文档）
 *
 * @param kernelApi 思源内核 API
 * @param lastShareTime 上次分享时间戳（用于增量检测）
 * @param searchTerm 搜索词
 * @param notebookBlacklist 笔记本黑名单列表
 */
export const getIncrementalDocumentsCount = async (
  kernelApi: SiyuanKernelApi,
  lastShareTime?: number,
  searchTerm?: string,
  notebookBlacklist?: string[]
): Promise<number> => {
  const logger = simpleLogger("use-siyuan-api", "share-pro", isDev)

  // 构建完整的WHERE条件
  let whereCondition = " AND b.type = 'd'"

  // 1. 添加增量分享条件
  const timeCondition = generateTimeCondition(lastShareTime)
  const unsharedDocumentCondition = "a.block_id IS NULL" // 从未分享过的文档
  let sharedDocumentWithUpdatesCondition = "" // 已分享但在上次分享时间之后有更新的文档
  if (timeCondition && timeCondition.length > 0) {
    sharedDocumentWithUpdatesCondition = `(a.block_id IS NOT NULL AND ${timeCondition})`
  }
  if (sharedDocumentWithUpdatesCondition && sharedDocumentWithUpdatesCondition.length > 0) {
    // 有时间条件时：查询从未分享的文档 或 已分享但在上次分享时间之后有更新的文档
    whereCondition += ` AND (${unsharedDocumentCondition} OR ${sharedDocumentWithUpdatesCondition})`
  } else {
    // 没有时间条件时（首次分享）：只查询从未分享的文档
    whereCondition += ` AND ${unsharedDocumentCondition}`
  }

  // 2. 添加文档黑名单条件
  whereCondition += ` AND (a2.block_id IS NULL OR (a2.block_id IS NOT NULL AND a2.value != 'true'))`
  // 3. 添加笔记本黑名单条件
  if (notebookBlacklist && notebookBlacklist.length > 0) {
    const escapedNotebookIds = notebookBlacklist.map((id) => `'${id.replace(/'/g, "''")}'`).join(",")
    whereCondition += ` AND b.box NOT IN (${escapedNotebookIds})`
  }

  // 4. 添加搜索条件
  if (searchTerm && searchTerm.trim() !== "") {
    whereCondition += ` AND b.content LIKE '%${searchTerm.replace(/'/g, "''")}%'`
  }

  const sql = `
    SELECT COUNT(DISTINCT b.root_id) as total
    FROM blocks b
    LEFT JOIN attributes a ON a.block_id = b.id AND a.name = '${SettingKeys.CUSTOM_SHARE_HISTORY}'
    LEFT JOIN attributes a2 ON a2.block_id = b.id AND a2.name = '${SettingKeys.CUSTOM_SHARE_BLACKLIST_DOCUMENT}'
    WHERE b.id = b.root_id
      ${whereCondition}
  `
  logger.debug("getIncrementalDocumentsCount SQL:", sql)
  const resData = await kernelApi.sql(sql)
  if (!resData || resData.length === 0 || !resData[0].total) {
    return 0
  }
  return parseInt(resData[0].total) || 0
}

// =====================================================================================================================
// Private utility functions
// =====================================================================================================================

/**
 * 将时间戳转换为思源数据库使用的日期字符串格式 (YYYYMMDDHHmmss)
 * @param timestamp 时间戳（毫秒）
 */
const convertTimestampToSiyuanDate = (timestamp?: number): string => {
  const date = timestamp && timestamp > 0 ? new Date(timestamp) : new Date()
  return (
    date.getFullYear() +
    (date.getMonth() + 1).toString().padStart(2, "0") +
    date.getDate().toString().padStart(2, "0") +
    date.getHours().toString().padStart(2, "0") +
    date.getMinutes().toString().padStart(2, "0") +
    date.getSeconds().toString().padStart(2, "0")
  )
}

/**
 * 生成时间条件SQL片段（不包含 AND 前缀）
 * @param lastShareTime 上次分享时间戳
 */
const generateTimeCondition = (lastShareTime?: number): string => {
  if (lastShareTime && lastShareTime > 0) {
    const lastUpdated = convertTimestampToSiyuanDate(lastShareTime)
    return `b.updated > '${lastUpdated}'`
  }
  return ""
}
