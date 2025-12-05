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
import ShareProPlugin from "../index"
import { ShareProConfig } from "../models/ShareProConfig"
import type { ShareQueue, QueueTask, ShareQueueStatus, QueueProgress } from "../types/share-queue"

const QUEUE_STORAGE_KEY = "share_queue"

/**
 * 分享队列管理服务
 * 
 * @author terwer
 * @since 1.14.0
 */
export class ShareQueueService {
  private logger = simpleLogger("share-queue-service", "share-pro", isDev)
  private pluginInstance: ShareProPlugin
  private currentQueue: ShareQueue | null = null
  private isPaused = false
  private progressCallbacks: Array<(progress: QueueProgress) => void> = []

  constructor(pluginInstance: ShareProPlugin) {
    this.pluginInstance = pluginInstance
  }

  /**
   * 创建新队列
   */
  public async createQueue(documents: Array<{ docId: string; docTitle: string }>): Promise<string> {
    const queueId = `queue_${Date.now()}_${Math.random().toString(36).substring(7)}`

    const tasks: QueueTask[] = documents.map((doc) => ({
      docId: doc.docId,
      docTitle: doc.docTitle,
      status: "pending" as const,
      createdAt: Date.now(),
      retryCount: 0,
    }))

    this.currentQueue = {
      queueId,
      status: "idle",
      tasks,
      createdAt: Date.now(),
    }

    await this.saveQueue()
    this.logger.info(`创建队列: ${queueId}, 任务数: ${tasks.length}`)

    return queueId
  }

  /**
   * 获取当前队列
   */
  public getCurrentQueue(): ShareQueue | null {
    return this.currentQueue
  }

  /**
   * 暂停队列
   */
  public pauseQueue(): void {
    if (this.currentQueue && this.currentQueue.status === "running") {
      this.isPaused = true
      this.currentQueue.status = "paused"
      this.currentQueue.pausedAt = Date.now()
      this.saveQueue()
      this.logger.info("队列已暂停")
    }
  }

  /**
   * 继续队列
   */
  public resumeQueue(): void {
    if (this.currentQueue && this.currentQueue.status === "paused") {
      this.isPaused = false
      this.currentQueue.status = "running"
      this.currentQueue.pausedAt = undefined
      this.saveQueue()
      this.logger.info("队列已继续")
    }
  }

  /**
   * 检查是否暂停
   */
  public isPausedState(): boolean {
    return this.isPaused
  }

  /**
   * 更新任务状态
   */
  public async updateTaskStatus(
    docId: string,
    status: QueueTask["status"],
    errorMessage?: string,
    shareUrl?: string
  ): Promise<void> {
    if (!this.currentQueue) return

    const task = this.currentQueue.tasks.find((t) => t.docId === docId)
    if (task) {
      task.status = status
      if (errorMessage) task.errorMessage = errorMessage
      if (shareUrl) task.shareUrl = shareUrl
      if (status === "success" || status === "failed" || status === "skipped") {
        task.completedAt = Date.now()
      }

      await this.saveQueue()
      this.notifyProgress()
    }
  }

  /**
   * 获取队列进度
   */
  public getProgress(): QueueProgress {
    if (!this.currentQueue) {
      return {
        total: 0,
        completed: 0,
        success: 0,
        failed: 0,
        skipped: 0,
        processing: 0,
        pending: 0,
      }
    }

    const tasks = this.currentQueue.tasks
    const total = tasks.length
    const success = tasks.filter((t) => t.status === "success").length
    const failed = tasks.filter((t) => t.status === "failed").length
    const skipped = tasks.filter((t) => t.status === "skipped").length
    const processing = tasks.filter((t) => t.status === "processing").length
    const pending = tasks.filter((t) => t.status === "pending").length
    const completed = success + failed + skipped

    // 计算预估剩余时间
    let estimatedTimeRemaining: number | undefined
    if (this.currentQueue.startedAt && completed > 0) {
      const elapsed = Date.now() - this.currentQueue.startedAt
      const avgTimePerTask = elapsed / completed
      estimatedTimeRemaining = Math.ceil(avgTimePerTask * pending)
    }

    return {
      total,
      completed,
      success,
      failed,
      skipped,
      processing,
      pending,
      estimatedTimeRemaining,
    }
  }

  /**
   * 获取失败的任务
   */
  public getFailedTasks(): QueueTask[] {
    if (!this.currentQueue) return []
    return this.currentQueue.tasks.filter((t) => t.status === "failed")
  }

  /**
   * 重置失败任务为待处理状态
   */
  public async retryFailedTasks(): Promise<void> {
    if (!this.currentQueue) return

    const failedTasks = this.getFailedTasks()
    for (const task of failedTasks) {
      task.status = "pending"
      task.errorMessage = undefined
      task.retryCount = (task.retryCount || 0) + 1
    }

    await this.saveQueue()
    this.logger.info(`重置 ${failedTasks.length} 个失败任务为待处理状态`)
  }

  /**
   * 标记队列为开始状态
   */
  public async markQueueStarted(): Promise<void> {
    if (this.currentQueue) {
      this.currentQueue.status = "running"
      this.currentQueue.startedAt = Date.now()
      await this.saveQueue()
    }
  }

  /**
   * 标记队列为完成状态
   */
  public async markQueueCompleted(): Promise<void> {
    if (this.currentQueue) {
      this.currentQueue.status = "completed"
      this.currentQueue.completedAt = Date.now()
      await this.saveQueue()
    }
  }

  /**
   * 清除当前队列
   */
  public async clearQueue(): Promise<void> {
    this.currentQueue = null
    this.isPaused = false
    await this.saveQueue()
    this.logger.info("队列已清除")
  }

  /**
   * 恢复队列（从持久化存储）
   */
  public async restoreQueue(): Promise<boolean> {
    try {
      const config = await this.pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
      const queueData = (config as any)[QUEUE_STORAGE_KEY]

      if (queueData) {
        this.currentQueue = queueData
        // 如果队列正在运行，恢复为暂停状态，等待用户手动继续
        if (this.currentQueue.status === "running") {
          this.currentQueue.status = "paused"
          this.isPaused = true
        }
        this.logger.info(`恢复队列: ${this.currentQueue.queueId}, 任务数: ${this.currentQueue.tasks.length}`)
        return true
      }

      return false
    } catch (error) {
      this.logger.error("恢复队列失败:", error)
      return false
    }
  }

  /**
   * 保存队列到持久化存储
   */
  private async saveQueue(): Promise<void> {
    try {
      const config = await this.pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
      ;(config as any)[QUEUE_STORAGE_KEY] = this.currentQueue
      await this.pluginInstance.saveData(SHARE_PRO_STORE_NAME, config)
    } catch (error) {
      this.logger.error("保存队列失败:", error)
    }
  }

  /**
   * 注册进度回调
   */
  public onProgress(callback: (progress: QueueProgress) => void): void {
    this.progressCallbacks.push(callback)
  }

  /**
   * 移除进度回调
   */
  public removeProgressCallback(callback: (progress: QueueProgress) => void): void {
    const index = this.progressCallbacks.indexOf(callback)
    if (index > -1) {
      this.progressCallbacks.splice(index, 1)
    }
  }

  /**
   * 通知进度更新
   */
  private notifyProgress(): void {
    const progress = this.getProgress()
    for (const callback of this.progressCallbacks) {
      try {
        callback(progress)
      } catch (error) {
        this.logger.error("进度回调执行失败:", error)
      }
    }
  }
}
