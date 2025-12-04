/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import { ShareBlacklist, BlacklistItem, BlacklistItemType } from "../../types"
import { simpleLogger } from "zhi-lib-base"
import { isDev } from "../../Constants"

/**
 * Mock 黑名单实现
 * 
 * 📝 TODO: 真实实现需要调用以下 API
 * ========================================
 * 1. 存储：使用插件配置或数据库
 *    - pluginInstance.saveData("blacklist.json", JSON.stringify(items))
 *    - 或存储在插件设置中
 * 
 * 2. 读取：从存储中读取黑名单
 *    - pluginInstance.loadData("blacklist.json")
 */
export class MockShareBlacklist implements ShareBlacklist {
  private logger = simpleLogger("mock-share-blacklist", "share-pro", isDev)
  private mockData: Map<string, BlacklistItem> = new Map()

  constructor() {
    this.initMockData()
  }

  private initMockData() {
    // Mock 数据：2个黑名单项
    const mockItems: BlacklistItem[] = [
      {
        id: "20231204-blacklist001",
        name: "Mock 黑名单文档",
        type: "document",
        addedTime: Date.now() - 1000 * 60 * 60 * 24 * 5,
        note: "测试黑名单文档",
      },
      {
        id: "mock-notebook-001",
        name: "Mock 黑名单笔记本",
        type: "notebook",
        addedTime: Date.now() - 1000 * 60 * 60 * 24 * 10,
        note: "测试黑名单笔记本",
      },
    ]

    mockItems.forEach((item) => this.mockData.set(item.id, item))
    this.logger.info(`Mock ShareBlacklist initialized with ${mockItems.length} items`)
  }

  async getAllItems(): Promise<BlacklistItem[]> {
    this.logger.info("📋 [Mock] getAllItems called")
    return Array.from(this.mockData.values())
  }

  async addItem(item: BlacklistItem): Promise<void> {
    this.logger.info(`🚫 [Mock] addItem: ${item.name}`)
    this.mockData.set(item.id, item)
  }

  async removeItem(id: string): Promise<void> {
    this.logger.info(`✅ [Mock] removeItem: ${id}`)
    this.mockData.delete(id)
  }

  async isInBlacklist(id: string): Promise<boolean> {
    this.logger.info(`🔍 [Mock] isInBlacklist: ${id}`)
    return this.mockData.has(id)
  }

  async areInBlacklist(ids: string[]): Promise<Record<string, boolean>> {
    this.logger.info(`🔍 [Mock] areInBlacklist: ${ids.length} items`)
    const result: Record<string, boolean> = {}
    ids.forEach((id) => {
      result[id] = this.mockData.has(id)
    })
    return result
  }

  async clearBlacklist(): Promise<void> {
    this.logger.info("🧹 [Mock] clearBlacklist called")
    this.mockData.clear()
  }

  async getItemsByType(type: BlacklistItemType): Promise<BlacklistItem[]> {
    this.logger.info(`📑 [Mock] getItemsByType: ${type}`)
    return Array.from(this.mockData.values()).filter((item) => item.type === type)
  }

  async searchItems(query: string): Promise<BlacklistItem[]> {
    this.logger.info(`🔎 [Mock] searchItems: ${query}`)
    return Array.from(this.mockData.values()).filter(
      (item) => item.name.toLowerCase().includes(query.toLowerCase()) || item.note?.toLowerCase().includes(query.toLowerCase())
    )
  }
}
