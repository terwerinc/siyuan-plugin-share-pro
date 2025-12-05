/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import { ShareBlacklist, BlacklistItem, BlacklistItemType } from "../types"
import { simpleLogger } from "zhi-lib-base"
import { isDev } from "../Constants"
import { ShareApi } from "../api/share-api"
import ShareProPlugin from "../index"
import type { BlacklistDTO, AddBlacklistRequest, DeleteBlacklistRequest, CheckBlacklistRequest } from "../types"

/**
 * 黑名单服务 - 调用 Java 后端 API
 *
 * @author terwer
 * @since 1.13.0
 */
export class BlacklistService implements ShareBlacklist {
  private logger = simpleLogger("blacklist-service", "share-pro", isDev)
  private shareApi: ShareApi

  constructor(pluginInstance: ShareProPlugin) {
    this.shareApi = new ShareApi(pluginInstance)
  }

  async getAllItems(): Promise<BlacklistItem[]> {
    this.logger.info("📋 getAllItems called")
    try {
      const response = await this.shareApi.getBlacklistList({ pageNum: 0, pageSize: 1000 })
      if (response.code === 0 && response.data?.data) {
        return this.convertDTOsToItems(response.data.data)
      }
      return []
    } catch (error) {
      this.logger.error("获取黑名单列表失败:", error)
      return []
    }
  }

  async addItem(item: BlacklistItem): Promise<void> {
    this.logger.info(`🚫 addItem: ${item.name}`)
    try {
      const request: AddBlacklistRequest = {
        type: item.type === "notebook" ? "NOTEBOOK" : "DOCUMENT",
        targetId: item.id,
        targetName: item.name,
        note: item.note,
      }
      await this.shareApi.addBlacklist(request)
    } catch (error) {
      this.logger.error("添加黑名单项失败:", error)
      throw error
    }
  }

  async removeItem(id: string): Promise<void> {
    this.logger.info(`✅ removeItem: ${id}`)
    try {
      // 注意：后端使用数字 ID，这里需要先查找对应的数据库 ID
      // 这是一个简化实现，实际可能需要维护 ID 映射
      const allItems = await this.getAllItems()
      const item = allItems.find((i) => i.id === id)
      if (item && item.dbId) {
        const request: DeleteBlacklistRequest = { id: item.dbId }
        await this.shareApi.deleteBlacklist(request)
      } else {
        this.logger.warn(`未找到 ID 为 ${id} 的黑名单项`)
      }
    } catch (error) {
      this.logger.error("删除黑名单项失败:", error)
      throw error
    }
  }

  async isInBlacklist(id: string): Promise<boolean> {
    this.logger.info(`🔍 isInBlacklist: ${id}`)
    try {
      const result = await this.areInBlacklist([id])
      return result[id] ?? false
    } catch (error) {
      this.logger.error("检查黑名单失败:", error)
      return false
    }
  }

  async areInBlacklist(ids: string[]): Promise<Record<string, boolean>> {
    this.logger.info(`🔍 areInBlacklist: ${ids.length} items`)
    try {
      const request: CheckBlacklistRequest = { docIds: ids }
      const response = await this.shareApi.checkBlacklist(request)
      if (response.code === 0 && response.data) {
        return response.data
      }
      // 返回空结果（所有都不在黑名单中）
      const result: Record<string, boolean> = {}
      ids.forEach((id) => (result[id] = false))
      return result
    } catch (error) {
      this.logger.error("批量检查黑名单失败:", error)
      // 发生错误时，返回空结果（所有都不在黑名单中）
      const result: Record<string, boolean> = {}
      ids.forEach((id) => (result[id] = false))
      return result
    }
  }

  async clearBlacklist(): Promise<void> {
    this.logger.info("🧹 clearBlacklist called")
    try {
      const allItems = await this.getAllItems()
      for (const item of allItems) {
        await this.removeItem(item.id)
      }
    } catch (error) {
      this.logger.error("清空黑名单失败:", error)
      throw error
    }
  }

  async getItemsByType(type: BlacklistItemType): Promise<BlacklistItem[]> {
    this.logger.info(`📑 getItemsByType: ${type}`)
    try {
      const apiType = type === "notebook" ? "NOTEBOOK" : "DOCUMENT"
      const response = await this.shareApi.getBlacklistList({ pageNum: 0, pageSize: 1000, type: apiType })
      if (response.code === 0 && response.data?.data) {
        return this.convertDTOsToItems(response.data.data)
      }
      return []
    } catch (error) {
      this.logger.error("按类型获取黑名单失败:", error)
      return []
    }
  }

  async searchItems(query: string): Promise<BlacklistItem[]> {
    this.logger.info(`🔎 searchItems: ${query}`)
    try {
      // 获取所有项，然后在客户端过滤（后端暂不支持搜索）
      const allItems = await this.getAllItems()
      return allItems.filter(
        (item) =>
          item.name.toLowerCase().includes(query.toLowerCase()) ||
          item.note?.toLowerCase().includes(query.toLowerCase())
      )
    } catch (error) {
      this.logger.error("搜索黑名单失败:", error)
      return []
    }
  }

  // ================
  // Helper Methods
  // ================

  /**
   * 将 DTO 转换为 BlacklistItem
   */
  private convertDTOsToItems(dtos: BlacklistDTO[]): BlacklistItem[] {
    return dtos.map((dto) => this.convertDTOToItem(dto))
  }

  /**
   * 将单个 DTO 转换为 BlacklistItem
   */
  private convertDTOToItem(dto: BlacklistDTO): BlacklistItem {
    return {
      id: dto.targetId,
      name: dto.targetName,
      type: dto.type === "NOTEBOOK" ? "notebook" : "document",
      addedTime: new Date(dto.createdAt).getTime(),
      note: dto.note,
      dbId: dto.id, // 保存数据库 ID，用于删除操作
    }
  }
}
