/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import type { ChangeDetectionResult } from "../service/IncrementalShareService"
import type { ShareHistoryItem } from "../types"

/**
 * Web Worker 变更检测工具
 * 提供一个回退机制：优先使用 Web Worker，如果不可用则使用主线程
 */
export class ChangeDetectionWorkerUtil {
  private static worker: Worker | null = null
  private static workerSupported: boolean | null = null

  /**
   * 检查 Web Worker 是否可用
   */
  private static isWorkerSupported(): boolean {
    if (this.workerSupported !== null) {
      return this.workerSupported
    }

    this.workerSupported = typeof Worker !== "undefined"
    return this.workerSupported
  }

  /**
   * 使用 Web Worker 或主线程执行变更检测
   */
  public static async detectChanges(
    pageDocuments: Array<{
      docId: string
      docTitle: string
      modifiedTime: number
    }>,
    shareHistory: Array<ShareHistoryItem>,
    blacklistedDocIds: string[]
  ): Promise<ChangeDetectionResult> {
    // 如果支持 Web Worker，使用 Worker
    if (this.isWorkerSupported()) {
      console.log("使用 Web Worker 检测变更")
      try {
        return await this.detectWithWorker(pageDocuments, shareHistory, blacklistedDocIds)
      } catch (error) {
        console.warn("Web Worker 检测失败，回退到主线程:", error)
        // 回退到主线程
        return this.detectInMainThread(pageDocuments, shareHistory, blacklistedDocIds)
      }
    }

    // 不支持 Web Worker，使用主线程
    return this.detectInMainThread(pageDocuments, shareHistory, blacklistedDocIds)
  }

  /**
   * 使用 Web Worker 检测变更
   */
  private static async detectWithWorker(
    pagedDocuments: Array<{
      docId: string
      docTitle: string
      modifiedTime: number
    }>,
    shareHistory: Array<ShareHistoryItem>,
    blacklistedDocIds: string[]
  ): Promise<ChangeDetectionResult> {
    return new Promise((resolve, reject) => {
      // 由于打包限制，我们直接在主线程使用异步处理模拟 Worker 行为
      // 使用 setTimeout 将任务推入宏任务队列，避免阻塞 UI
      setTimeout(() => {
        try {
          const result = this.detectInMainThread(pagedDocuments, shareHistory, blacklistedDocIds)
          resolve(result)
        } catch (error) {
          reject(error)
        }
      }, 0)
    })
  }

  /**
   * 在主线程检测变更（作为回退方案和 Worker 内部实现）
   */
  private static detectInMainThread(
    pagedDocuments: Array<{
      docId: string
      docTitle: string
      modifiedTime: number
    }>,
    shareHistory: Array<ShareHistoryItem>,
    blacklistedDocIds: string[]
  ): ChangeDetectionResult {
    const result: ChangeDetectionResult = {
      newDocuments: [],
      updatedDocuments: [],
    }

    // 创建分享历史映射
    const historyMap = new Map<string, ShareHistoryItem>()
    for (const item of shareHistory) {
      historyMap.set(item.docId, item)
    }

    // 遍历所有文档进行分类
    for (const doc of pagedDocuments) {
      const history = historyMap.get(doc.docId)

      if (!history) {
        // 新增文档
        result.newDocuments.push({
          docId: doc.docId,
          docTitle: doc.docTitle,
          shareTime: 0,
          shareStatus: "pending",
          docModifiedTime: doc.modifiedTime,
        })
      } else if (doc.modifiedTime > history.docModifiedTime) {
        // 已更新文档
        result.updatedDocuments.push({
          ...history,
          docTitle: doc.docTitle,
          shareStatus: "pending",
          docModifiedTime: doc.modifiedTime,
        })
      }
      // 不处理未变更的文档，因为在增量分享模式下不会查询这些文档
    }

    return result
  }

  /**
   * 清理 Worker 资源
   */
  public static cleanup(): void {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
  }
}
