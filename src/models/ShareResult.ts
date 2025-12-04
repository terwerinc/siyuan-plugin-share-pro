/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

/**
 * 单个文档分享结果
 */
export interface SingleShareResult {
  /**
   * 文档ID
   */
  docId: string

  /**
   * 文档标题
   */
  title: string

  /**
   * 分享状态
   */
  success: boolean

  /**
   * 分享链接
   */
  shareUrl?: string

  /**
   * 错误信息
   */
  error?: string

  /**
   * 处理时间
   */
  processedAt: number
}

/**
 * 批量分享结果
 */
export interface BulkShareResult {
  /**
   * 总文档数
   */
  totalCount: number

  /**
   * 成功分享数
   */
  successCount: number

  /**
   * 失败分享数
   */
  failedCount: number

  /**
   * 跳过的文档数（已在黑名单中）
   */
  skippedCount: number

  /**
   * 详细结果列表
   */
  results: SingleShareResult[]

  /**
   * 开始时间
   */
  startTime: number

  /**
   * 结束时间
   */
  endTime: number

  /**
   * 总耗时（毫秒）
   */
  duration: number
}

/**
 * 变更检测结果
 */
export interface ChangeDetectionResult {
  /**
   * 已变更的文档
   */
  changedDocs: Array<{
    docId: string
    title: string
    notebookId: string
    notebookName: string
    lastModified: number
    currentShareUrl?: string
  }>

  /**
   * 新增的文档
   */
  newDocs: Array<{
    docId: string
    title: string
    notebookId: string
    notebookName: string
    createdAt: number
  }>

  /**
   * 被黑名单过滤的文档
   */
  blacklistedDocs: Array<{
    docId: string
    title: string
    notebookId: string
    notebookName: string
    reason: string
  }>

  /**
   * 统计信息
   */
  stats: {
    totalDocs: number
    changedCount: number
    newCount: number
    blacklistedCount: number
  }

  /**
   * 检测时间
   */
  detectedAt: number
}

/**
 * 分享统计信息
 */
export interface ShareStatistics {
  /**
   * 总分享文档数
   */
  totalSharedDocs: number

  /**
   * 今日分享数
   */
  todaySharedDocs: number

  /**
   * 本周分享数
   */
  weekSharedDocs: number

  /**
   * 本月分享数
   */
  monthSharedDocs: number

  /**
   * 总访问量
   */
  totalVisits: number

  /**
   * 黑名单过滤数
   */
  blacklistedCount: number

  /**
   * 最后更新时间
   */
  lastUpdated: number
}

/**
 * 增量分享配置
 */
export interface IncrementalShareConfig {
  /**
   * 是否启用增量分享
   */
  enabled: boolean

  /**
   * 自动检测间隔（秒）
   */
  autoDetectInterval: number

  /**
   * 批量分享最大数量
   */
  maxBulkShareCount: number

  /**
   * 黑名单配置
   */
  blacklist: {
    /**
     * 笔记本黑名单
     */
    notebooks: Array<{
      pattern: string
      description?: string
      createdAt: string
    }>

    /**
     * 文档黑名单
     */
    documents: Array<{
      pattern: string
      description?: string
      createdAt: string
    }>
  }
}