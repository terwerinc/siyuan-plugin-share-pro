/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import { simpleLogger } from "zhi-lib-base"
import { isDev, SHARE_PRO_STORE_NAME } from "../Constants"
import { ShareService } from "./ShareService"
import { ShareProConfig } from "../models/ShareProConfig"
import type { ShareHistoryItem } from "../types"
import { docDTOToHistoryItem } from "../utils/ShareHistoryUtils"
import { SettingService } from "./SettingService"
import { showMessage } from "siyuan"
import { ShareApi } from "../api/share-api"
import { syncAppConfig, DefaultAppConfig } from "../utils/ShareConfigUtils"
import ShareProPlugin from "../index"
import { BlacklistService } from "./BlacklistService"

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
  private blacklistService: BlacklistService
  private pluginInstance: ShareProPlugin

  constructor(
    pluginInstance: ShareProPlugin,
    shareService: ShareService,
    settingService: SettingService,
    blacklistService: BlacklistService
  ) {
    this.pluginInstance = pluginInstance
    this.shareService = shareService
    this.settingService = settingService
    this.shareApi = new ShareApi(pluginInstance)
    this.blacklistService = blacklistService
  }

  /**
   * 获取所有分享历史记录（从服务端，支持分页）
   */
  private async getShareHistoryPaged(
    pageNum = 0,
    pageSize = 100,
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
   * 检测文档变更
   */
  public async detectChangedDocuments(
    allDocuments: Array<{
      docId: string
      docTitle: string
      modifiedTime: number
      notebookId?: string
      notebookName?: string
    }>
  ): Promise<ChangeDetectionResult> {
    const result: ChangeDetectionResult = {
      newDocuments: [],
      updatedDocuments: [],
      unchangedDocuments: [],
      blacklistedCount: 0,
    }

    if (!allDocuments || allDocuments.length === 0) {
      return result
    }

    try {
      const docIds = allDocuments.map((doc) => doc.docId)
      const blacklistStatus = await this.blacklistService.areInBlacklist(docIds)

      const allHistory = await this.getAllShareHistory()
      const historyMap = new Map<string, ShareHistoryItem>()
      allHistory.forEach((item) => historyMap.set(item.docId, item))

      for (const doc of allDocuments) {
        if (blacklistStatus[doc.docId]) {
          result.blacklistedCount++
          continue
        }

        const history = historyMap.get(doc.docId)

        if (!history) {
          result.newDocuments.push({
            docId: doc.docId,
            docTitle: doc.docTitle,
            shareTime: 0,
            shareStatus: "pending",
            docModifiedTime: doc.modifiedTime,
          })
        } else if (doc.modifiedTime > history.docModifiedTime) {
          result.updatedDocuments.push({
            ...history,
            docTitle: doc.docTitle,
            shareStatus: "pending",
            docModifiedTime: doc.modifiedTime,
          })
        } else {
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
   */
  public async bulkShareDocuments(documents: Array<{ docId: string; docTitle: string }>): Promise<BulkShareResult> {
    const result: BulkShareResult = {
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
      results: [],
    }

    if (!documents || documents.length === 0) {
      this.logger.warn("没有文档需要分享")
      return result
    }

    try {
      const docIds = documents.map((doc) => doc.docId)
      const blacklistStatus = await this.blacklistService.areInBlacklist(docIds)
      const validDocs: Array<{ docId: string; docTitle: string }> = []

      for (const doc of documents) {
        if (blacklistStatus[doc.docId]) {
          result.skippedCount++
          result.results.push({
            docId: doc.docId,
            docTitle: doc.docTitle,
            success: false,
            errorMessage: "文档在黑名单中，跳过分享",
          })
        } else {
          validDocs.push(doc)
        }
      }

      if (validDocs.length === 0) {
        this.logger.warn("所有文档都在黑名单中，跳过分享")
        return result
      }

      this.logger.info(`开始批量分享 ${validDocs.length} 个文档`)

      for (const doc of validDocs) {
        try {
          await this.shareService.createShare(doc.docId, undefined, undefined)
          result.successCount++
          result.results.push({
            docId: doc.docId,
            docTitle: doc.docTitle,
            success: true,
          })
          this.logger.info(`分享文档成功: ${doc.docTitle}`)
        } catch (error) {
          result.failedCount++
          const errorMsg = error?.message || String(error)
          result.results.push({
            docId: doc.docId,
            docTitle: doc.docTitle,
            success: false,
            errorMessage: errorMsg,
          })
          this.logger.error(`分享文档失败: ${doc.docTitle}`, error)
        }
      }

      showMessage(
        `批量分享完成：成功 ${result.successCount} 个，失败 ${result.failedCount} 个，跳过 ${result.skippedCount} 个`,
        5000,
        result.failedCount > 0 ? "error" : "info"
      )

      if (result.successCount > 0) {
        await this.updateLastShareTime()
      }

      this.logger.info("批量分享完成:", result)
    } catch (error) {
      this.logger.error("批量分享失败:", error)
      throw error
    }

    return result
  }

  /**
   * 更新最后分享时间
   */
  private async updateLastShareTime(): Promise<void> {
    try {
      const config = await this.pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
      config.appConfig ||= DefaultAppConfig
      if (typeof config.appConfig.incrementalShareConfig === "undefined") {
        config.appConfig.incrementalShareConfig = { enabled: true }
      }
      config.appConfig.incrementalShareConfig.lastShareTime = Date.now()

      // 保存到本地
      await this.pluginInstance.saveData(SHARE_PRO_STORE_NAME, config)

      // 同步到服务端
      await syncAppConfig(this.settingService, config)

      this.logger.info("最后分享时间已更新:", config.appConfig.incrementalShareConfig.lastShareTime)
    } catch (error) {
      this.logger.error("更新最后分享时间失败:", error)
      throw error
    }
  }
}
