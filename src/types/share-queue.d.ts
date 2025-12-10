/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

/**
 * 分享队列状态
 */
export type ShareQueueStatus = "idle" | "running" | "paused" | "completed" | "error"

/**
 * 队列任务状态
 */
export type QueueTaskStatus = "pending" | "processing" | "success" | "failed" | "skipped"

/**
 * 队列任务
 */
export interface QueueTask {
  /**
   * 文档ID
   */
  docId: string

  /**
   * 文档标题
   */
  docTitle: string

  /**
   * 任务状态
   */
  status: QueueTaskStatus

  /**
   * 错误信息（如果失败）
   */
  errorMessage?: string

  /**
   * 重试次数
   */
  retryCount?: number

  /**
   * 分享URL（如果成功）
   */
  shareUrl?: string

  /**
   * 创建时间
   */
  createdAt: number

  /**
   * 完成时间
   */
  completedAt?: number
}

/**
 * 分享队列
 */
export interface ShareQueue {
  /**
   * 队列ID
   */
  queueId: string

  /**
   * 队列状态
   */
  status: ShareQueueStatus

  /**
   * 任务列表
   */
  tasks: QueueTask[]

  /**
   * 创建时间
   */
  createdAt: number

  /**
   * 开始时间
   */
  startedAt?: number

  /**
   * 完成时间
   */
  completedAt?: number

  /**
   * 暂停时间
   */
  pausedAt?: number
}

/**
 * 队列进度
 */
export interface QueueProgress {
  /**
   * 总任务数
   */
  total: number

  /**
   * 已完成数
   */
  completed: number

  /**
   * 成功数
   */
  success: number

  /**
   * 失败数
   */
  failed: number

  /**
   * 跳过数
   */
  skipped: number

  /**
   * 处理中数
   */
  processing: number

  /**
   * 待处理数
   */
  pending: number

  /**
   * 预估剩余时间（毫秒）
   */
  estimatedTimeRemaining?: number
}
