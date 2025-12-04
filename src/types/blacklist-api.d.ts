/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

/**
 * 黑名单类型
 */
export type BlacklistType = "NOTEBOOK" | "DOCUMENT"

/**
 * 黑名单项 DTO（服务端返回）
 */
export interface BlacklistDTO {
  /**
   * 黑名单项ID
   */
  id: number

  /**
   * 类型：笔记本或文档
   */
  type: BlacklistType

  /**
   * 目标ID（笔记本ID或文档ID）
   */
  targetId: string

  /**
   * 目标名称（笔记本名称或文档标题）
   */
  targetName: string

  /**
   * 备注说明
   */
  note?: string

  /**
   * 创建时间（ISO 8601格式）
   */
  createdAt: string

  /**
   * 更新时间（ISO 8601格式）
   */
  updatedAt: string
}

/**
 * 添加黑名单请求
 */
export interface AddBlacklistRequest {
  /**
   * 类型：笔记本或文档
   */
  type: BlacklistType

  /**
   * 目标ID（笔记本ID或文档ID）
   */
  targetId: string

  /**
   * 目标名称（笔记本名称或文档标题）
   */
  targetName: string

  /**
   * 备注说明
   */
  note?: string
}

/**
 * 删除黑名单请求
 */
export interface DeleteBlacklistRequest {
  /**
   * 黑名单项ID
   */
  id: number
}

/**
 * 检查黑名单请求
 */
export interface CheckBlacklistRequest {
  /**
   * 需要检查的文档ID列表
   */
  docIds: string[]
}
