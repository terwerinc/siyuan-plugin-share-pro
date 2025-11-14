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
import { ShareHistory, ShareHistoryItem } from "../models/ShareHistory"
import { ShareBlacklist, BlacklistItem } from "../models/ShareBlacklist"
import { SettingService } from "./SettingService"
import { SettingKeys } from "../models/SettingKeys"
import { useSiyuanApi } from "../composables/useSiyuanApi"
import { showMessage } from "siyuan"

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
  private shareHistory: ShareHistory
  private shareBlacklist: ShareBlacklist
  private pluginInstance: any

  constructor(pluginInstance: any, shareService: ShareService, settingService: SettingService) {
    this.pluginInstance = pluginInstance
    this.shareService = shareService
    this.settingService = settingService
  }

  /**
   * 设置分享历史管理器
   */
  public setShareHistory(shareHistory: ShareHistory): void {
    this.shareHistory = shareHistory
  }

  /**
   * 设置黑名单管理器
   */
  public setShareBlacklist(shareBlacklist: ShareBlacklist): void {
    this.shareBlacklist = shareBlacklist
  }

  /**
   * 检测文档变更
   * @param allDocuments 所有待检测的文档
   * @param config 插件配置
   */
  public async detectChangedDocuments(
    allDocuments: Array<{ docId: string; docTitle: string; modifiedTime: number; notebookId?: string; notebookName?: string }>,
    config: ShareProConfig
  ): Promise<ChangeDetectionResult> {
    if (!config.incrementalShareConfig?.enabled) {
      return {
        newDocuments: [],
        updatedDocuments: [],
        unchangedDocuments: [],
        blacklistedCount: 0
      }
    }

    const result: ChangeDetectionResult = {
      newDocuments: [],
      updatedDocuments: [],
      unchangedDocuments: [],
      blacklistedCount: 0
    }

    try {
      // 获取黑名单状态
      const docIds = allDocuments.map(doc => doc.docId)
      const blacklistStatus = await this.shareBlacklist.areInBlacklist(docIds)
      
      // 获取笔记本黑名单配置
      const notebookBlacklistConfig = config.incrementalShareConfig.notebookBlacklist || []
      const notebookBlacklistSet = new Set(notebookBlacklistConfig.map(item => item.id))

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

        // 获取历史记录
        const history = await this.shareHistory.getHistoryByDocId(doc.docId)

        if (!history) {
          // 新文档
          result.newDocuments.push({
            docId: doc.docId,
            docTitle: doc.docTitle,
            shareTime: 0,
            shareStatus: "pending",
            docModifiedTime: doc.modifiedTime
          })
        } else if (doc.modifiedTime > history.docModifiedTime) {
          // 已更新的文档
          result.updatedDocuments.push({
            ...history,
            shareStatus: "pending",
            docModifiedTime: doc.modifiedTime
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
      results: []
    }

    try {
      // 检查是否在黑名单中
      const docIds = documents.map(doc => doc.docId)
      const blacklistStatus = await this.shareBlacklist.areInBlacklist(docIds)

      for (const doc of documents) {
        // 检查是否在黑名单中
        if (blacklistStatus[doc.docId]) {
          result.skippedCount++
          result.results.push({
            docId: doc.docId,
            docTitle: doc.docTitle,
            success: false,
            errorMessage: "文档在黑名单中，跳过分享"
          })
          continue
        }

        try {
          // 执行分享
          const shareResult = await this.shareService.shareDoc(doc.docId, true)

          if (shareResult) {
            result.successCount++
            result.results.push({
              docId: doc.docId,
              docTitle: doc.docTitle,
              success: true,
              shareUrl: shareResult
            })

            // 更新历史记录
            const historyItem: ShareHistoryItem = {
              docId: doc.docId,
              docTitle: doc.docTitle,
              shareTime: Date.now(),
              shareStatus: "success",
              shareUrl: shareResult,
              docModifiedTime: Date.now()
            }
            await this.shareHistory.addHistory(historyItem)

            const successMsg = this.pluginInstance.i18n?.shareService?.success || "分享成功"
            showMessage(`${doc.docTitle}: ${successMsg}`, 3000, "info")
          } else {
            result.failedCount++
            result.results.push({
              docId: doc.docId,
              docTitle: doc.docTitle,
              success: false,
              errorMessage: "分享失败"
            })

            // 更新历史记录
            const historyItem: ShareHistoryItem = {
              docId: doc.docId,
              docTitle: doc.docTitle,
              shareTime: Date.now(),
              shareStatus: "failed",
              errorMessage: "分享失败",
              docModifiedTime: Date.now()
            }
            await this.shareHistory.addHistory(historyItem)
          }
        } catch (error) {
          result.failedCount++
          const errorMessage = error instanceof Error ? error.message : "未知错误"
          result.results.push({
            docId: doc.docId,
            docTitle: doc.docTitle,
            success: false,
            errorMessage
          })

          // 更新历史记录
          const historyItem: ShareHistoryItem = {
            docId: doc.docId,
            docTitle: doc.docTitle,
            shareTime: Date.now(),
            shareStatus: "failed",
            errorMessage,
            docModifiedTime: Date.now()
          }
          await this.shareHistory.addHistory(historyItem)

          this.logger.error(`文档 ${doc.docTitle} 分享失败:`, error)
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
      const allHistory = await this.shareHistory.getAllHistory()
      const lastShareTime = config.incrementalShareConfig?.lastShareTime || 0

      const newDocumentsCount = allHistory.filter(item => item.shareTime > lastShareTime).length
      const updatedDocumentsCount = allHistory.filter(item => item.shareTime <= lastShareTime && item.shareStatus === "success").length

      return {
        totalShared: allHistory.length,
        lastShareTime,
        newDocumentsCount,
        updatedDocumentsCount
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
          cacheStrategy: "memory"
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