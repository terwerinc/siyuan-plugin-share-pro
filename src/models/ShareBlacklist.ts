/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

/**
 * 黑名单项类型
 */
export type BlacklistItemType = "notebook" | "document"

/**
 * 黑名单项
 */
export interface BlacklistItem {
  /**
   * 项目ID（笔记本ID或文档ID）
   */
  id: string

  /**
   * 项目名称（笔记本名称或文档标题）
   */
  name: string

  /**
   * 项目类型
   */
  type: BlacklistItemType

  /**
   * 添加时间戳
   */
  addedTime: number

  /**
   * 备注信息
   */
  note?: string
}

/**
 * 黑名单管理接口
 */
export interface ShareBlacklist {
  /**
   * 获取所有黑名单项
   */
  getAllItems(): Promise<BlacklistItem[]>

  /**
   * 添加黑名单项
   */
  addItem(item: BlacklistItem): Promise<void>

  /**
   * 移除黑名单项
   */
  removeItem(id: string): Promise<void>

  /**
   * 检查指定ID是否在黑名单中
   */
  isInBlacklist(id: string): Promise<boolean>

  /**
   * 批量检查多个ID是否在黑名单中
   */
  areInBlacklist(ids: string[]): Promise<Record<string, boolean>>

  /**
   * 清空黑名单
   */
  clearBlacklist(): Promise<void>

  /**
   * 获取指定类型的黑名单项
   */
  getItemsByType(type: BlacklistItemType): Promise<BlacklistItem[]>

  /**
   * 搜索黑名单项
   */
  searchItems(query: string): Promise<BlacklistItem[]>
}

/**
 * 黑名单配置
 */
export interface BlacklistConfig {
  /**
   * 笔记本黑名单列表
   */
  notebookBlacklist: string[]

  /**
   * 文档黑名单列表
   */
  docBlacklist: string[]

  /**
   * 是否启用黑名单功能
   */
  enabled: boolean
}