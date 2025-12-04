/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import { simpleLogger } from "zhi-lib-base"
import { isDev } from "../Constants"
import { ShareService } from "./ShareService"
import { ShareProConfig } from "../models/ShareProConfig"
import type { ShareHistoryItem, ShareBlacklist } from "../types"
import { docDTOToHistoryItem } from "../utils/ShareHistoryUtils"
import { SettingService } from "./SettingService"
import { showMessage } from "siyuan"
import { ShareApi } from "../api/share-api"

/**
 * 变更检测的结果
 */
export interface ChangeDetectionResult {
  /**
   * 新增文档列表
   */
  newDocuments: ShareHistoryItem[]

  /**
   * 已更新文档列表
   */
  updatedDocuments: ShareHistoryItem[]

  /**
   * 无变更文档列表
   */
  unchangedDocuments: ShareHistoryItem[]

  /**
   * 被黑名单过滤的文档数量
   */
  blacklistedCount: number
}

/**
 * 批量分享的结果
 */
export interface BulkShareResult {
  /**
   * 成功分享的文档数量
   */
  successCount: number

  /**
   * 失败的文档数量
   */
  failedCount: number

  /**
   * 跳过的文档数量（已在黑名单中）
   */
  skippedCount: number

  /**
   * 详细的分享结果
   */
  results: Array<{
    docId: string
    docTitle: string
    success: boolean
    errorMessage?: string
    shareUrl?: string
  }>
}

/**
 * 增量分享服务
 *
 * @author terwer
 * @since 1.13.0
 */
export class IncrementalShareService {
  private logger = simpleLogger("incremental-share-service", "share-pro", isDev)
  private shareService: ShareService
  private settingService: SettingService
  private shareApi: ShareApi
  private shareBlacklist: ShareBlacklist
  private pluginInstance: any

  constructor(pluginInstance: any, shareService: ShareService, settingService: SettingService) {
    this.pluginInstance = pluginInstance
    this.shareService = shareService
    this.settingService = settingService
    this.shareApi = new ShareApi(pluginInstance)
  }

  /**
   * 设置黑名单管理器
   */
  public setShareBlacklist(shareBlacklist: ShareBlacklist): void {
    this.shareBlacklist = shareBlacklist
  }

  /**
   * 获取所有分享历史记录（从服务端，支持分页）
   * 
   * @private
   * @param pageNum 页码（从0开始），默认0
   * @param pageSize 每页大小，默认100
   * @param search 搜索关键词（可选）
   * @returns 分页后的分享历史记录
   */
  private async getShareHistoryPaged(
    pageNum: number = 0,
    pageSize: number = 100,
    search?: string
  ): Promise<{
    items: ShareHistoryItem[]
    total: number
    hasMore: boolean
  }> {
    try {
      const response = await this.shareApi.listDoc({
        pageNum,
        pageSize,
        search,
      })

      const items: ShareHistoryItem[] = []
      let total = 0
      
      if (response.code === 0 && response.data) {
        total = response.data.total || 0
        
        if (response.data.data) {
          response.data.data.forEach((doc: any) => {
            items.push(docDTOToHistoryItem(doc))
          })
        }
      }

      const hasMore = (pageNum + 1) * pageSize < total

      return { items, total, hasMore }
    } catch (error) {
      this.logger.error("获取分页分享历史失败:", error)
      return { items: [], total: 0, hasMore: false }
    }
  }

  /**
   * 获取所有分享历史记录（自动处理分页）
   * 
   * @private
   * @returns 所有分享历史记录列表
   */
  private async getAllShareHistory(): Promise<ShareHistoryItem[]> {
    const PAGE_SIZE = 100
    const allItems: ShareHistoryItem[] = []
    let currentPage = 0
    let hasMore = true

    try {
      while (hasMore) {
        const { items, hasMore: more } = await this.getShareHistoryPaged(currentPage, PAGE_SIZE)
        
        allItems.push(...items)
        hasMore = more
        currentPage++

        // 安全检查：避免无限循环
        if (currentPage > 100) {
          this.logger.warn("分页查询超过100页，停止查询")
          break
        }
      }

      this.logger.info(`获取分享历史完成，共 ${allItems.length} 条记录`)
      return allItems
    } catch (error) {
      this.logger.error("获取所有分享历史失败:", error)
      return []
    }
  }

  /**
   * 根据文档ID获取分享历史（从服务端）
   * 
   * @private
   * @param docId 文档ID
   * @returns 分享历史记录，不存在则返回 undefined
   */
  private async getShareHistoryByDocId(docId: string): Promise<ShareHistoryItem | undefined> {
    const allHistory = await this.getAllShareHistory()
    return allHistory.find((item) => item.docId === docId)
  }

  /**
   * 获取分享历史列表（分页，供外部使用）
   * 
   * @param pageNum 页码（从0开始）
   * @param pageSize 每页大小
   * @param search 搜索关键词（可选）
   * @returns 分页结果
   */
  public async getShareHistoryList(
    pageNum: number = 0,
    pageSize: number = 10,
    search?: string
  ): Promise<{
    items: ShareHistoryItem[]
    total: number
    pageNum: number
    pageSize: number
    totalPages: number
  }> {
    try {
      const response = await this.shareApi.listDoc({
        pageNum,
        pageSize,
        search,
      })

      const items: ShareHistoryItem[] = []
      let total = 0
      
      if (response.code === 0 && response.data) {
        total = response.data.total || 0
        
        if (response.data.data) {
          response.data.data.forEach((doc: any) => {
            items.push(docDTOToHistoryItem(doc))
          })
        }
      }

      const totalPages = Math.ceil(total / pageSize)

      return {
        items,
        total,
        pageNum,
        pageSize,
        totalPages,
      }
    } catch (error) {
      this.logger.error("获取分享历史列表失败:", error)
      return {
        items: [],
        total: 0,
        pageNum,
        pageSize,
        totalPages: 0,
      }
    }
  }

  /**
   * 检测文档变更
   * @param allDocuments 所有待检测的文档
   * @param config 插件配置
   */
  public async detectChangedDocuments(
    allDocuments: Array<{
      docId: string
      docTitle: string
      modifiedTime: number
      notebookId?: string
      notebookName?: string
    }>,
    config: ShareProConfig
  ): Promise<ChangeDetectionResult> {
    // 🔧 Mock 测试阶段：暂时注释掉 enabled 检查
    // TODO: 正式发布时需要恢复此检查
    // if (!config.incrementalShareConfig?.enabled) {
    //   return {
    //     newDocuments: [],
    //     updatedDocuments: [],
    //     unchangedDocuments: [],
    //     blacklistedCount: 0
    //   }
    // }

    const result: ChangeDetectionResult = {
      newDocuments: [],
      updatedDocuments: [],
      unchangedDocuments: [],
      blacklistedCount: 0,
    }

    try {
      // 获取黑名单状态
      const docIds = allDocuments.map((doc) => doc.docId)
      const blacklistStatus = await this.shareBlacklist.areInBlacklist(docIds)

      // 获取笔记本黑名单配置（避免 undefined）
      const notebookBlacklistConfig = config.incrementalShareConfig?.notebookBlacklist || []
      const notebookBlacklistSet = new Set(notebookBlacklistConfig)

      // 从服务端获取所有已分享文档（使用封装方法）
      const allHistory = await this.getAllShareHistory()
      const historyMap = new Map<string, ShareHistoryItem>()
      allHistory.forEach((item) => {
        historyMap.set(item.docId, item)
      })

      for (const doc of allDocuments) {
        // 检查笔记本黑名单
        if (doc.notebookId && notebookBlacklistSet.has(doc.notebookId)) {
          this.logger.info(`文档 ${doc.docTitle} 被笔记本黑名单过滤，笔记本ID: ${doc.notebookId}`)
          result.blacklistedCount++
          continue
        }

        // 检查文档黑名单
        if (blacklistStatus[doc.docId]) {
          result.blacklistedCount++
          continue
        }

        // 从服务端历史记录中获取
        const history = historyMap.get(doc.docId)

        if (!history) {
          // 新文档
          result.newDocuments.push({
            docId: doc.docId,
            docTitle: doc.docTitle,
            shareTime: 0,
            shareStatus: "pending",
            docModifiedTime: doc.modifiedTime,
          })
        } else if (doc.modifiedTime > history.docModifiedTime) {
          // 已更新的文档
          result.updatedDocuments.push({
            ...history,
            shareStatus: "pending",
            docModifiedTime: doc.modifiedTime,
          })
        } else {
          // 无变更的文档
          result.unchangedDocuments.push(history)
        }
      }

      this.logger.info("变更检测结果:", result)
    } catch (error) {
      this.logger.error("检测文档变更失败:", error)
      throw error
    }

    return result
  }

  /**
   * 批量分享文档
   * @param documents 要分享的文档列表
   * @param config 插件配置
   */
  public async bulkShareDocuments(
    documents: Array<{ docId: string; docTitle: string }>,
    config: ShareProConfig
  ): Promise<BulkShareResult> {
    const result: BulkShareResult = {
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
      results: [],
    }

    try {
      // 检查是否在黑名单中
      const docIds = documents.map((doc) => doc.docId)
      const blacklistStatus = await this.shareBlacklist.areInBlacklist(docIds)

      // 过滤黑名单文档
      const validDocIds: string[] = []
      const docIdTitleMap = new Map<string, string>()

      for (const doc of documents) {
        docIdTitleMap.set(doc.docId, doc.docTitle)

        if (blacklistStatus[doc.docId]) {
          result.skippedCount++
          result.results.push({
            docId: doc.docId,
            docTitle: doc.docTitle,
            success: false,
            errorMessage: "文档在黑名单中，跳过分享",
          })
        } else {
          validDocIds.push(doc.docId)
        }
      }

      if (validDocIds.length === 0) {
        this.logger.warn("所有文档都在黑名单中，跳过分享")
        return result
      }

      // 调用 ShareService 的批量分享方法
      this.logger.info(`开始批量分享 ${validDocIds.length} 个文档`)
      const bulkResult = await this.shareService.bulkCreateShare(validDocIds)

      // 处理结果
      for (const item of bulkResult.results) {
        const docTitle = docIdTitleMap.get(item.docId) || item.docId

        if (item.success) {
          result.successCount++
          result.results.push({
            docId: item.docId,
            docTitle,
            success: true,
            shareUrl: item.shareUrl,
          })

          const successMsg = this.pluginInstance.i18n?.shareService?.success || "分享成功"
          showMessage(`${docTitle}: ${successMsg}`, 3000, "info")
        } else {
          result.failedCount++
          result.results.push({
            docId: item.docId,
            docTitle,
            success: false,
            errorMessage: item.errorMessage,
          })
        }
      }

      // 更新最后分享时间
      await this.updateLastShareTime()

      this.logger.info("批量分享完成:", result)
    } catch (error) {
      this.logger.error("批量分享失败:", error)
      throw error
    }

    return result
  }

  /**
   * 获取增量分享统计信息
   */
  public async getIncrementalShareStats(): Promise<{
    totalShared: number
    lastShareTime: number
    newDocumentsCount: number
    updatedDocumentsCount: number
  }> {
    try {
      const config = await this.settingService.getSettingConfig()
      const lastShareTime = config.incrementalShareConfig?.lastShareTime || 0

      // 从服务端获取所有分享记录（使用封装方法）
      const allHistory = await this.getAllShareHistory()

      const newDocumentsCount = allHistory.filter((item) => item.shareTime > lastShareTime).length
      const updatedDocumentsCount = allHistory.filter(
        (item) => item.shareTime <= lastShareTime && item.shareStatus === "success"
      ).length

      return {
        totalShared: allHistory.length,
        lastShareTime,
        newDocumentsCount,
        updatedDocumentsCount,
      }
    } catch (error) {
      this.logger.error("获取增量分享统计信息失败:", error)
      throw error
    }
  }

  /**
   * 更新最后分享时间
   */
  private async updateLastShareTime(): Promise<void> {
    try {
      const config = await this.settingService.getSettingConfig()
      if (!config.incrementalShareConfig) {
        config.incrementalShareConfig = {
          enabled: false,
          lastShareTime: 0,
          shareHistory: [],
          notebookBlacklist: [],
          docBlacklist: [],
          defaultSelectionBehavior: "all",
          cacheStrategy: "memory",
        }
      }
      config.incrementalShareConfig.lastShareTime = Date.now()
      await this.settingService.saveSettingConfig(config)
    } catch (error) {
      this.logger.error("更新最后分享时间失败:", error)
      throw error
    }
  }
}
