/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import type { DocDTO } from "./service-dto"

/**
 * 分享历史记录项（客户端使用）
 * 
 * 注意：这是 DocDTO 的客户端适配类型，数据来源于服务端
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
