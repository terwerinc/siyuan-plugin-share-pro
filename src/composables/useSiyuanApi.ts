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
import { cleanDocTitle } from "../utils/utils"

/**
 * 通用 Siyuan API 封装
 *
 * @author terwer
 * @since 1.15.0
 */
export const useSiyuanApi = (cfg: ShareProConfig) => {
  const logger = simpleLogger("use-siyuan-api", "share-pro", isDev)

  if (cfg.siyuanConfig.apiUrl !== window.location.origin) {
    // logger.warn("siyuan api url not match, use default")
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

// =====================================================================================================================
// 子文档获取相关方法
// =====================================================================================================================

/**
 * 获取指定文档的子文档总数
 *
 * @param kernelApi 思源内核 API
 * @param docId 文档ID
 */
export const getSubdocCount = async (kernelApi: SiyuanKernelApi, docId: string): Promise<number> => {
  const logger = simpleLogger("use-siyuan-api", "share-pro", isDev)
  const escapedDocId = docId.replace(/'/g, "''")

  const sql = `
    SELECT COUNT(DISTINCT b1.root_id) AS count
    FROM blocks b1
    WHERE b1.root_id = '${escapedDocId}' OR b1.path LIKE '%/${escapedDocId}%'
  `

  logger.debug("getSubdocCount SQL:", sql)
  const data = await kernelApi.sql(sql)
  return data?.[0]?.count || 0
}

/**
 * 分页获取子文档列表
 *
 * @deprecated 已经废弃，必须使用思源笔记官方的 filetree/listDocsByPath API 获取子文档列表
 * @param kernelApi 思源内核 API
 * @param docId 文档ID
 * @param page 页码（从0开始）
 * @param pageSize 每页大小
 */
export const getSubdocsPaged = async (
  kernelApi: SiyuanKernelApi,
  docId: string,
  page: number,
  pageSize: number
): Promise<
  Array<{
    docId: string
    docTitle: string
    path: string
    modifiedTime: number
    createdTime: number
  }>
> => {
  const logger = simpleLogger("use-siyuan-api", "share-pro", isDev)
  const offset = page * pageSize
  const escapedDocId = docId.replace(/'/g, "''")

  const sql = `
    SELECT DISTINCT b2.root_id, b2.content, b2.path, b2.updated, b2.created
    FROM blocks b2
    WHERE b2.id IN (
        SELECT DISTINCT b1.root_id
        FROM blocks b1
        WHERE b1.root_id = '${escapedDocId}' OR b1.path LIKE '%/${escapedDocId}%'
        ORDER BY b1.updated DESC, b1.created DESC
        LIMIT ${pageSize} OFFSET ${offset}
    )
    ORDER BY b2.updated DESC, b2.created DESC, b2.id
  `

  logger.debug("getSubdocsPaged SQL:", sql)
  const resData = await kernelApi.sql(sql)
  if (!resData || resData.length === 0) {
    return []
  }

  return resData.map((row: any) => ({
    docId: row.root_id,
    docTitle: row.content || "Untitled Document",
    path: row.path,
    // 转换思源的时间格式为Unix时间戳
    modifiedTime:
      row.updated && typeof row.updated === "string"
        ? new Date(
            parseInt(row.updated.substring(0, 4)),
            parseInt(row.updated.substring(4, 6)) - 1,
            parseInt(row.updated.substring(6, 8)),
            parseInt(row.updated.substring(8, 10)),
            parseInt(row.updated.substring(10, 12)),
            parseInt(row.updated.substring(12, 14))
          ).getTime()
        : parseInt(row.updated) || 0,
    createdTime:
      row.created && typeof row.created === "string"
        ? new Date(
            parseInt(row.created.substring(0, 4)),
            parseInt(row.created.substring(4, 6)) - 1,
            parseInt(row.created.substring(6, 8)),
            parseInt(row.created.substring(8, 10)),
            parseInt(row.created.substring(10, 12)),
            parseInt(row.created.substring(12, 14))
          ).getTime()
        : parseInt(row.created) || 0,
  }))
}

/**
 * 使用思源官方 API 获取子文档树结构（支持懒加载）
 *
 * @param kernelApi 思源内核 API
 * @param notebookId 笔记本ID
 * @param docPath 文档路径（用于构建完整的路径）
 * @returns 子文档列表
 */
export const getSubdocTreeByPath = async (
  kernelApi: SiyuanKernelApi,
  notebookId: string,
  docPath: string
): Promise<
  Array<{
    docId: string
    docTitle: string
    path: string
    parentId: string | null
    depth: number
    modifiedTime: number
    createdTime: number
    hasChildren: boolean
  }>
> => {
  const logger = simpleLogger("use-siyuan-api", "share-pro", isDev)

  try {
    // 构建API请求参数
    const requestData = {
      notebook: notebookId,
      path: docPath,
      app: "jwis",
    }

    logger.debug("Calling filetree/listDocsByPath with:", requestData)

    // 调用思源官方API
    const response = await kernelApi.siyuanRequest("/api/filetree/listDocsByPath", requestData)

    // 思源API直接返回数据对象，没有code/data包装层
    // response 结构: { box: "...", files: [...], path: "..." }
    if (!response || !Array.isArray(response.files)) {
      logger.error("Invalid response from filetree/listDocsByPath:", response)
      return []
    }

    const files = response.files || []
    const basePath = response.path || ""

    // 转换数据格式
    const subdocs = files.map((file: any) => {
      // 安全处理路径和名称
      const fullPath = file.path || ""
      const fileName = file.name || "Untitled Document"

      // 从路径中提取父文档ID
      const pathParts = fullPath.split("/").filter((part: string) => part.trim() !== "" && !part.endsWith(".sy"))
      const parentId = pathParts.length > 1 ? pathParts[pathParts.length - 2] : null

      // 计算深度（基于basePath）
      const safeBasePath = basePath || ""
      const baseParts = safeBasePath.split("/").filter((part: string) => part.trim() !== "" && !part.endsWith(".sy"))
      const depth = pathParts.length - baseParts.length

      return {
        docId: file.id || "",
        docTitle: cleanDocTitle(fileName),
        path: fullPath,
        parentId: parentId,
        depth: depth,
        modifiedTime: file.mtime || 0,
        createdTime: file.ctime || 0,
        hasChildren: (file.subFileCount || 0) > 0,
      }
    })

    logger.debug("Got subdoc tree:", subdocs)
    return subdocs
  } catch (error) {
    logger.error("Error getting subdoc tree by path:", error)
    return []
  }
}

/**
 * 获取文档的笔记本信息
 *
 * @param kernelApi 思源内核 API
 * @param docId 文档ID
 * @returns 笔记本ID和文档路径，如果文档不存在则返回 null
 */
export const getDocNotebookInfo = async (
  kernelApi: SiyuanKernelApi,
  docId: string
): Promise<{ notebookId: string; docPath: string } | null> => {
  const logger = simpleLogger("use-siyuan-api", "share-pro", isDev)

  try {
    // 先获取文档的基本信息
    const blockInfo = await kernelApi.getBlockByID(docId)
    if (!blockInfo) {
      logger.warn(`Document ${docId} not found`)
      return null
    }

    const notebookId = blockInfo.box || ""
    const docPath = blockInfo.path || `/${docId}.sy`

    logger.debug(`Document ${docId} belongs to notebook ${notebookId}, path: ${docPath}`)
    return { notebookId, docPath }
  } catch (error) {
    logger.error("Error getting document notebook info:", error)
    return null
  }
}
