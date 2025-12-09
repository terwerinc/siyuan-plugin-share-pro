/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import { showMessage } from "siyuan"
import { simpleLogger } from "zhi-lib-base"
import { ShareApi } from "../api/share-api"
import { isDev, SHARE_PRO_STORE_NAME } from "../Constants"
import ShareProPlugin from "../index"
import { ShareProConfig } from "../models/ShareProConfig"
import type { ShareHistoryItem } from "../types"
import { ChangeDetectionWorkerUtil } from "../utils/ChangeDetectionWorkerUtil"
import { DefaultAppConfig, syncAppConfig } from "../utils/ShareConfigUtils"
import { shareHistoryCache } from "../utils/ShareHistoryCache"
import { BlacklistService } from "./BlacklistService"
import { LocalShareHistory } from "./LocalShareHistory"
import { SettingService } from "./SettingService"
import { ShareQueueService } from "./ShareQueueService"
import { ShareService } from "./ShareService"

/**
 * 重试配置
 */
interface RetryConfig {
  /**
   * 最大重试次数
   */
  maxRetries: number

  /**
   * 初始延迟时间（毫秒）
   */
  initialDelay: number

  /**
   * 5xx错误的延迟时间（毫秒）
   */
  serverErrorDelay: number
}

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
  public queueService: ShareQueueService
  private localShareHistory: LocalShareHistory

  // 缓存相关
  private detectionCache: ChangeDetectionResult | null = null
  private cacheTimestamp = 0
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5分钟

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
    this.localShareHistory = new LocalShareHistory(pluginInstance)
    this.queueService = new ShareQueueService(pluginInstance)

    // 启动时尝试恢复队列
    void this.restoreQueueOnStartup()
  }

  /**
   * 启动时恢复队列
   */
  private async restoreQueueOnStartup(): Promise<void> {
    const restored = await this.queueService.restoreQueue()
    if (restored) {
      this.logger.info("检测到未完成的队列，已恢复并暂停")
    }
  }

  public async getLatestShareDoc(): Promise<any> {
    const params = {
      pageNum: 0,
      pageSize: 1,
    }
    const result = await this.shareApi.listDoc(params)
    if (result.code === 0 && result.data && result.data.data && result.data.data.length > 0) {
      return result.data.data[0]
    }
  }

  /**
   * 单页检测文档变更
   *
   * @param getDocumentsPageFn 获取文档的分页函数
   * @param pageNum 页码
   * @param pageSize 每页大小
   * @param totalCount 文档总数（可选，用于进度显示）
   */
  public async detectChangedDocumentsSinglePage(
    getDocumentsPageFn: (
      pageNum: number,
      pageSize: number
    ) => Promise<
      Array<{
        docId: string
        docTitle: string
        modifiedTime: number
        notebookId?: string
      }>
    >,
    pageNum: number,
    pageSize: number,
    totalCount?: number
  ): Promise<ChangeDetectionResult> {
    const result: ChangeDetectionResult = {
      newDocuments: [],
      updatedDocuments: [],
      unchangedDocuments: [],
      blacklistedCount: 0,
    }

    try {
      // 获取当前页的文档
      const pageDocuments = await getDocumentsPageFn(pageNum, pageSize)
      if (!pageDocuments || pageDocuments.length === 0) {
        return result
      }

      const progressStart = pageNum * pageSize + 1
      const progressEnd = Math.min((pageNum + 1) * pageSize, totalCount || (pageNum + 1) * pageSize)
      const progressText = totalCount
        ? `${progressStart}-${progressEnd}/${totalCount}`
        : `${progressStart}-${progressEnd}`
      this.logger.info(`变更检测进度: ${progressText}`)

      const docIds = pageDocuments.map((doc) => doc.docId)

      // 检查黑名单
      const blacklistStatus = await this.checkBlacklist(docIds)
      const blacklistedDocIds = docIds.filter((id) => blacklistStatus[id])

      // 获取当前页分享历史（使用本地存储和缓存）
      const shareHistory = await this.getLocalHistoryByIds(docIds)

      // 使用 Web Worker 进行变更检测
      const pageResult = await ChangeDetectionWorkerUtil.detectChanges(pageDocuments, shareHistory, blacklistedDocIds)

      // 返回单页结果
      return pageResult
    } catch (error) {
      this.logger.error("检测文档变更失败:", error)
      throw error
    }
  }

  /**
   * 通过本地存储获取文档历史记录
   *
   * @param docIds 文档ID列表
   * @returns 分享历史记录列表
   */
  private async getLocalHistoryByIds(docIds: string[]): Promise<ShareHistoryItem[]> {
    const historyItems: ShareHistoryItem[] = []

    for (const docId of docIds) {
      // 首先尝试从缓存获取
      let item = shareHistoryCache.get(docId)

      // 如果缓存中没有，则从本地存储获取
      if (!item) {
        item = await this.localShareHistory.getHistoryByDocId(docId)
        // 如果获取到了，放入缓存
        if (item) {
          shareHistoryCache.set(docId, item)
        }
      }

      if (item) {
        historyItems.push(item)
      }
    }

    return historyItems
  }

  /**
   * 检查缓存是否有效
   */
  private isCacheValid(): boolean {
    if (!this.detectionCache || this.cacheTimestamp === 0) {
      return false
    }

    const now = Date.now()
    const elapsed = now - this.cacheTimestamp

    return elapsed < this.CACHE_DURATION
  }

  /**
   * 清除缓存
   */
  public clearCache(): void {
    this.detectionCache = null
    this.cacheTimestamp = 0
    // 同时清除共享缓存
    shareHistoryCache.clear()
    this.logger.info("缓存已清除")
  }

  /**
   * 批量分享文档（支持并发控制和队列管理）
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

      // 分页检查黑名单，避免一次性查询过多文档给服务端造成压力
      const blacklistStatus = await this.checkBlacklist(docIds)
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

      this.logger.info(`开始批量分享 ${validDocs.length} 个文档，并发数限制为5`)

      // 创建队列
      await this.queueService.createQueue(validDocs)
      await this.queueService.markQueueStarted()

      // 使用并发控制批量分享（最多5个并发）
      const shareResults = await this.concurrentBatchShareWithQueue(validDocs, 5)

      // 统计结果
      for (const shareResult of shareResults) {
        if (shareResult.success) {
          result.successCount++
        } else {
          result.failedCount++
        }
        result.results.push(shareResult)
      }

      showMessage(
        `批量分享完成：成功 ${result.successCount} 个，失败 ${result.failedCount} 个，跳过 ${result.skippedCount} 个`,
        5000,
        result.failedCount > 0 ? "error" : "info"
      )

      if (result.successCount > 0) {
        await this.updateLastShareTime()
        // 清除缓存，因为分享状态已变更
        this.clearCache()
      }

      // 标记队列完成
      await this.queueService.markQueueCompleted()

      this.logger.info("批量分享完成:", result)
    } catch (error) {
      this.logger.error("批量分享失败:", error)
      throw error
    }

    return result
  }

  /**
   * 分页检查黑名单（避免一次性查询过多文档）
   *
   * @param docIds 文档ID列表
   * @returns 黑名单状态映射
   */
  private async checkBlacklist(docIds: string[]): Promise<Record<string, boolean>> {
    // 分页处理
    const result = await this.blacklistService.areInBlacklist(docIds)
    this.logger.debug(`黑名单检查完成=>`, result)
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

  /**
   * 并发批量分享文档
   * @param documents 待分享文档列表
   * @param concurrency 并发数限制
   */
  private async concurrentBatchShare(
    documents: Array<{ docId: string; docTitle: string }>,
    concurrency: number
  ): Promise<Array<{ docId: string; docTitle: string; success: boolean; errorMessage?: string; shareUrl?: string }>> {
    const results: Array<{
      docId: string
      docTitle: string
      success: boolean
      errorMessage?: string
      shareUrl?: string
    }> = []

    const queue = [...documents]
    const executing: Promise<void>[] = []

    while (queue.length > 0 || executing.length > 0) {
      // 当还有任务且未达到并发限制时，启动新任务
      while (executing.length < concurrency && queue.length > 0) {
        const doc = queue.shift()!

        const task = (async () => {
          try {
            // 使用智能重试机制分享文档
            const shareResult = await this.shareDocumentWithRetry(doc.docId)

            // 更新本地历史记录
            if (shareResult.success) {
              const historyItem: ShareHistoryItem = {
                docId: doc.docId,
                docTitle: doc.docTitle,
                shareTime: Date.now(),
                shareStatus: "success",
                shareUrl: shareResult.shareUrl,
                docModifiedTime: Date.now(), // 这里应该获取文档的实际修改时间
              }

              // 保存到本地存储和缓存
              await this.localShareHistory.addHistory(historyItem)
              shareHistoryCache.set(doc.docId, historyItem)
            }

            results.push({
              docId: doc.docId,
              docTitle: doc.docTitle,
              success: shareResult.success,
              shareUrl: shareResult.shareUrl,
            })
            this.logger.info(`分享文档成功: ${doc.docTitle}`)
          } catch (error) {
            const errorMsg = error?.message || String(error)
            results.push({
              docId: doc.docId,
              docTitle: doc.docTitle,
              success: false,
              errorMessage: errorMsg,
            })
            this.logger.error(`分享文档失败: ${doc.docTitle}`, error)
          }
        })()

        executing.push(task)

        // 任务完成后从执行队列中移除
        task.finally(() => {
          const index = executing.indexOf(task)
          if (index > -1) {
            executing.splice(index, 1)
          }
        })
      }

      // 等待至少一个任务完成
      if (executing.length > 0) {
        await Promise.race(executing)
      }
    }

    return results
  }

  /**
   * 带队列管理的并发批量分享
   */
  private async concurrentBatchShareWithQueue(
    documents: Array<{ docId: string; docTitle: string }>,
    concurrency: number
  ): Promise<Array<{ docId: string; docTitle: string; success: boolean; errorMessage?: string; shareUrl?: string }>> {
    const results: Array<{
      docId: string
      docTitle: string
      success: boolean
      errorMessage?: string
      shareUrl?: string
    }> = []

    const queue = [...documents]
    const executing: Promise<void>[] = []

    while (queue.length > 0 || executing.length > 0) {
      // 检查是否暂停
      while (this.queueService.isPausedState()) {
        this.logger.info("队列已暂停，等待继续...")
        await this.delay(1000) // 每秒检查一次
      }

      // 当还有任务且未达到并发限制时，启动新任务
      while (executing.length < concurrency && queue.length > 0) {
        const doc = queue.shift()!

        const task = (async () => {
          try {
            // 更新任务状态为处理中
            await this.queueService.updateTaskStatus(doc.docId, "processing")

            // 使用智能重试机制分享文档
            const shareResult = await this.shareDocumentWithRetry(doc.docId)

            // 更新本地历史记录
            if (shareResult.success) {
              const historyItem: ShareHistoryItem = {
                docId: doc.docId,
                docTitle: doc.docTitle,
                shareTime: Date.now(),
                shareStatus: "success",
                shareUrl: shareResult.shareUrl,
                docModifiedTime: Date.now(), // 这里应该获取文档的实际修改时间
              }

              // 保存到本地存储和缓存
              await this.localShareHistory.addHistory(historyItem)
              shareHistoryCache.set(doc.docId, historyItem)

              // 更新任务状态为成功
              await this.queueService.updateTaskStatus(doc.docId, "success")
            } else {
              // 更新任务状态为失败
              await this.queueService.updateTaskStatus(doc.docId, "failed", shareResult.errorMessage)
            }

            results.push({
              docId: doc.docId,
              docTitle: doc.docTitle,
              success: shareResult.success,
              shareUrl: shareResult.shareUrl,
              errorMessage: shareResult.errorMessage,
            })
            this.logger.info(`分享文档成功: ${doc.docTitle}`)
          } catch (error) {
            const errorMsg = error?.message || String(error)

            // 更新任务状态为失败
            await this.queueService.updateTaskStatus(doc.docId, "failed", errorMsg)

            results.push({
              docId: doc.docId,
              docTitle: doc.docTitle,
              success: false,
              errorMessage: errorMsg,
            })
            this.logger.error(`分享文档失败: ${doc.docTitle}`, error)
          }
        })()

        executing.push(task)

        // 任务完成后从执行队列中移除
        task.finally(() => {
          const index = executing.indexOf(task)
          if (index > -1) {
            executing.splice(index, 1)
          }
        })
      }

      // 等待至少一个任务完成
      if (executing.length > 0) {
        await Promise.race(executing)
      }
    }

    return results
  }

  /**
   * 带智能重试机制的文档分享
   * - 网络错误：自动重试3次（指数退避策略）
   * - 服务端5xx错误：延迟30秒后重试
   * - 4xx错误：立即失败并记录详细日志
   */
  private async shareDocumentWithRetry(
    docId: string
  ): Promise<{ success: boolean; shareUrl?: string; errorMessage?: string }> {
    const retryConfig: RetryConfig = {
      maxRetries: 3,
      initialDelay: 1000, // 1秒
      serverErrorDelay: 30000, // 30秒
    }

    let lastError: any = null

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        await this.shareService.createShare(docId, undefined, undefined)

        // 获取分享信息以获得分享链接
        try {
          const shareInfo = await this.shareService.getSharedDocInfo(docId)
          if (shareInfo.code === 0 && shareInfo.data) {
            return {
              success: true,
              shareUrl: shareInfo.data.shareUrl,
            }
          }
        } catch (infoError) {
          this.logger.warn(`获取分享链接失败: ${docId}`, infoError)
        }

        return { success: true }
      } catch (error: any) {
        lastError = error
        const errorMsg = error?.message || String(error)
        const statusCode = this.extractStatusCode(error)

        // 4xx错误：立即失败，不重试
        if (statusCode >= 400 && statusCode < 500) {
          this.logger.error(`[4xx错误] 文档 ${docId} 分享失败，状态码: ${statusCode}，错误信息: ${errorMsg}`)
          return { success: false, errorMessage: errorMsg }
        }

        // 5xx错误：延迟30秒后重试
        if (statusCode >= 500 && statusCode < 600) {
          if (attempt < retryConfig.maxRetries) {
            this.logger.warn(
              `[5xx错误] 文档 ${docId} 分享失败，状态码: ${statusCode}，将在30秒后重试 (${attempt + 1}/${
                retryConfig.maxRetries
              })`
            )
            await this.delay(retryConfig.serverErrorDelay)
            continue
          }
        }

        // 网络错误或其他错误：使用指数退避策略重试
        if (attempt < retryConfig.maxRetries) {
          const delay = retryConfig.initialDelay * Math.pow(2, attempt) // 指数退避：1s, 2s, 4s
          this.logger.warn(
            `[网络错误] 文档 ${docId} 分享失败，将在 ${delay}ms 后重试 (${attempt + 1}/${
              retryConfig.maxRetries
            })，错误: ${errorMsg}`
          )
          await this.delay(delay)
          continue
        }

        // 达到最大重试次数，返回错误
        this.logger.error(
          `文档 ${docId} 分享失败，已达到最大重试次数 (${retryConfig.maxRetries})，最后错误: ${errorMsg}`
        )
        return { success: false, errorMessage: errorMsg }
      }
    }

    return { success: false, errorMessage: lastError?.message || String(lastError) }
  }

  /**
   * 从错误对象中提取HTTP状态码
   */
  private extractStatusCode(error: any): number {
    // 尝试从不同的错误格式中提取状态码
    if (error?.response?.status) {
      return error.response.status
    }
    if (error?.status) {
      return error.status
    }
    if (error?.statusCode) {
      return error.statusCode
    }
    // 尝试从错误消息中解析状态码
    const match = error?.message?.match(/status[:\s]+(\d{3})/i)
    if (match) {
      return parseInt(match[1], 10)
    }
    return 0 // 未知状态码
  }

  /**
   * 延迟执行
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
