/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import { ShareHistory, ShareHistoryItem } from "../../models/ShareHistory"
import { simpleLogger } from "zhi-lib-base"
import { isDev } from "../../Constants"

/**
 * Mock 分享历史记录实现
 * 
 * 📝 TODO: 真实实现需要调用以下 API
 * ========================================
 * 1. 存储：使用思源笔记的属性存储或数据库
 *    - 方案A：存储在文档属性中（推荐）
 *      kernelApi.setBlockAttrs(docId, { "custom-share-history": JSON.stringify(item) })
 *    - 方案B：存储在插件数据目录
 *      fs.writeFile(`${pluginDir}/share-history.json`, JSON.stringify(items))
 * 
 * 2. 读取：从存储中读取历史记录
 *    - kernelApi.getBlockAttrs(docId)
 *    - 或读取插件数据文件
 */
export class MockShareHistory implements ShareHistory {
  private logger = simpleLogger("mock-share-history", "share-pro", isDev)
  private mockData: Map<string, ShareHistoryItem> = new Map()

  constructor() {
    // 初始化 Mock 数据
    this.initMockData()
  }

  private initMockData() {
    // Mock 数据：3个已分享的文档
    const mockItems: ShareHistoryItem[] = [
      {
        docId: "20231201-mock001",
        docTitle: "Mock 文档1 - 已分享",
        shareTime: Date.now() - 1000 * 60 * 60 * 24 * 7, // 7天前
        shareStatus: "success",
        shareUrl: "https://siyuan.wiki/s/20231201-mock001",
        docModifiedTime: Date.now() - 1000 * 60 * 60 * 24 * 8, // 8天前修改
      },
      {
        docId: "20231202-mock002",
        docTitle: "Mock 文档2 - 已更新",
        shareTime: Date.now() - 1000 * 60 * 60 * 24 * 3, // 3天前
        shareStatus: "success",
        shareUrl: "https://siyuan.wiki/s/20231202-mock002",
        docModifiedTime: Date.now() - 1000 * 60 * 60, // 1小时前修改（说明有更新）
      },
      {
        docId: "20231203-mock003",
        docTitle: "Mock 文档3 - 分享失败",
        shareTime: Date.now() - 1000 * 60 * 60 * 24, // 1天前
        shareStatus: "failed",
        errorMessage: "网络错误",
        docModifiedTime: Date.now() - 1000 * 60 * 60 * 24 * 2,
      },
    ]

    mockItems.forEach((item) => this.mockData.set(item.docId, item))
    this.logger.info(`Mock ShareHistory initialized with ${mockItems.length} items`)
  }

  async getAllHistory(): Promise<ShareHistoryItem[]> {
    this.logger.info("📖 [Mock] getAllHistory called")
    return Array.from(this.mockData.values())
  }

  async addHistory(item: ShareHistoryItem): Promise<void> {
    this.logger.info(`➕ [Mock] addHistory: ${item.docTitle}`)
    this.mockData.set(item.docId, item)
  }

  async updateHistory(docId: string, updates: Partial<ShareHistoryItem>): Promise<void> {
    this.logger.info(`🔄 [Mock] updateHistory: ${docId}`)
    const existing = this.mockData.get(docId)
    if (existing) {
      this.mockData.set(docId, { ...existing, ...updates })
    }
  }

  async removeHistory(docId: string): Promise<void> {
    this.logger.info(`🗑️ [Mock] removeHistory: ${docId}`)
    this.mockData.delete(docId)
  }

  async clearHistory(): Promise<void> {
    this.logger.info("🧹 [Mock] clearHistory called")
    this.mockData.clear()
  }

  async getHistoryByDocId(docId: string): Promise<ShareHistoryItem | undefined> {
    this.logger.info(`🔍 [Mock] getHistoryByDocId: ${docId}`)
    return this.mockData.get(docId)
  }

  async getHistoryByTimeRange(startTime: number, endTime: number): Promise<ShareHistoryItem[]> {
    this.logger.info(`📅 [Mock] getHistoryByTimeRange: ${startTime} - ${endTime}`)
    return Array.from(this.mockData.values()).filter(
      (item) => item.shareTime >= startTime && item.shareTime <= endTime
    )
  }
}
