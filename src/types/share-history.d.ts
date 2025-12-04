/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

/**
 * 分享历史记录项
 */
export interface ShareHistoryItem {
  /**
   * 文档ID
   */
  docId: string

  /**
   * 文档标题
   */
  docTitle: string

  /**
   * 分享时间戳
   */
  shareTime: number

  /**
   * 分享状态
   */
  shareStatus: "success" | "failed" | "pending"

  /**
   * 分享链接
   */
  shareUrl?: string

  /**
   * 错误信息（如果分享失败）
   */
  errorMessage?: string

  /**
   * 文档修改时间戳（用于变更检测）
   */
  docModifiedTime: number
}

/**
 * 分享历史记录管理
 */
export interface ShareHistory {
  /**
   * 获取所有历史记录
   */
  getAllHistory(): Promise<ShareHistoryItem[]>

  /**
   * 添加历史记录
   */
  addHistory(item: ShareHistoryItem): Promise<void>

  /**
   * 更新历史记录
   */
  updateHistory(docId: string, updates: Partial<ShareHistoryItem>): Promise<void>

  /**
   * 删除历史记录
   */
  removeHistory(docId: string): Promise<void>

  /**
   * 清空所有历史记录
   */
  clearHistory(): Promise<void>

  /**
   * 获取指定文档的历史记录
   */
  getHistoryByDocId(docId: string): Promise<ShareHistoryItem | undefined>

  /**
   * 获取指定时间范围内的历史记录
   */
  getHistoryByTimeRange(startTime: number, endTime: number): Promise<ShareHistoryItem[]>
}
