/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import type { ShareHistoryItem } from "../types"
import type { ChangeDetectionResult } from "../service/IncrementalShareService"

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
    allDocuments: Array<{
      docId: string
      docTitle: string
      modifiedTime: number
    }>,
    shareHistory: ShareHistoryItem[],
    blacklistedDocIds: string[]
  ): Promise<ChangeDetectionResult> {
    // 如果支持 Web Worker，使用 Worker
    if (this.isWorkerSupported()) {
      try {
        return await this.detectWithWorker(allDocuments, shareHistory, blacklistedDocIds)
      } catch (error) {
        console.warn("Web Worker 检测失败，回退到主线程:", error)
        // 回退到主线程
        return this.detectInMainThread(allDocuments, shareHistory, blacklistedDocIds)
      }
    }

    // 不支持 Web Worker，使用主线程
    return this.detectInMainThread(allDocuments, shareHistory, blacklistedDocIds)
  }

  /**
   * 使用 Web Worker 检测变更
   */
  private static async detectWithWorker(
    allDocuments: Array<{
      docId: string
      docTitle: string
      modifiedTime: number
    }>,
    shareHistory: ShareHistoryItem[],
    blacklistedDocIds: string[]
  ): Promise<ChangeDetectionResult> {
    return new Promise((resolve, reject) => {
      // 由于打包限制，我们直接在主线程使用异步处理模拟 Worker 行为
      // 使用 setTimeout 将任务推入宏任务队列，避免阻塞 UI
      setTimeout(() => {
        try {
          const result = this.detectInMainThread(allDocuments, shareHistory, blacklistedDocIds)
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
    allDocuments: Array<{
      docId: string
      docTitle: string
      modifiedTime: number
    }>,
    shareHistory: ShareHistoryItem[],
    blacklistedDocIds: string[]
  ): ChangeDetectionResult {
    const result: ChangeDetectionResult = {
      newDocuments: [],
      updatedDocuments: [],
      unchangedDocuments: [],
      blacklistedCount: 0,
    }

    // 创建黑名单集合以提高查询效率（O(1)）
    const blacklistedSet = new Set(blacklistedDocIds)

    // 创建分享历史映射
    const historyMap = new Map<string, ShareHistoryItem>()
    for (const item of shareHistory) {
      historyMap.set(item.docId, item)
    }

    // 遍历所有文档进行分类
    for (const doc of allDocuments) {
      // 黑名单过滤
      if (blacklistedSet.has(doc.docId)) {
        result.blacklistedCount++
        continue
      }

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
      } else {
        // 未变更文档
        result.unchangedDocuments.push(history)
      }
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
