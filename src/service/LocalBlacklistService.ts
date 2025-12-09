import { simpleLogger } from "zhi-lib-base"
import { isDev, SHARE_PRO_STORE_NAME } from "../Constants"
import ShareProPlugin from "../index"
import { BlacklistItem, BlacklistItemType, ShareBlacklist } from "../models/ShareBlacklist"
import { ShareProConfig } from "../models/ShareProConfig"
import { ApiUtils } from "../utils/ApiUtils"
import { DefaultAppConfig, syncAppConfig } from "../utils/ShareConfigUtils"
import { BlacklistApiService } from "./BlacklistApiService"
import { SettingService } from "./SettingService"

/**
 * 本地黑名单服务实现
 *
 * 存储方案：
 * - 文档级别的黑名单存储在文档属性中（custom-share-blacklist-document）
 * - 笔记本级别的黑名单存储在插件配置中
 *
 * @author terwer
 * @since 1.15.0
 */
export class LocalBlacklistService implements ShareBlacklist {
  private logger = simpleLogger("local-blacklist-service", "share-pro", isDev)
  private pluginInstance: ShareProPlugin
  private settingService: SettingService
  private blacklistApiService: BlacklistApiService

  constructor(pluginInstance: ShareProPlugin, settingService: SettingService) {
    this.pluginInstance = pluginInstance
    this.settingService = settingService
    this.blacklistApiService = new BlacklistApiService(pluginInstance)
  }

  /**
   * 获取所有黑名单项
   */
  async getAllItems(): Promise<BlacklistItem[]> {
    this.logger.info("📋 [Local] getAllItems called")
    try {
      const items: BlacklistItem[] = []

      // 获取笔记本级别的黑名单项（从插件配置中获取）
      const notebookItems = await this.getNotebookBlacklistItems()
      items.push(...notebookItems)

      // 文档级别的黑名单项存储在各个文档的属性中，无法直接获取所有项
      // 这里返回空数组，由调用方通过其他方式获取文档级别的黑名单项

      return items
    } catch (error) {
      this.logger.error("获取所有黑名单项失败:", error)
      return []
    }
  }

  /**
   * 添加黑名单项
   */
  async addItem(item: BlacklistItem): Promise<void> {
    this.logger.info(`🚫 [Local] addItem: ${item.name} (${item.type})`)
    try {
      if (item.type === "notebook") {
        // 笔记本级别的黑名单存储在插件配置中
        await this.addNotebookToBlacklist(item)
      } else {
        // 文档级别的黑名单存储在文档属性中
        await this.addDocumentToBlacklist(item)
      }
    } catch (error) {
      this.logger.error("添加黑名单项失败:", error)
      throw error
    }
  }

  /**
   * 移除黑名单项
   */
  async removeItem(id: string): Promise<void> {
    this.logger.info(`✅ [Local] removeItem: ${id}`)
    try {
      // 需要先确定是笔记本还是文档级别的黑名单项
      // 这里采用一种简单的方式：先尝试从笔记本黑名单中移除，如果失败再尝试从文档黑名单中移除
      try {
        await this.removeNotebookFromBlacklist(id)
      } catch (notebookError) {
        // 如果从笔记本黑名单中移除失败，尝试从文档黑名单中移除
        await this.removeDocumentFromBlacklist(id)
      }
    } catch (error) {
      this.logger.error("删除黑名单项失败:", error)
      throw error
    }
  }

  /**
   * 检查指定ID是否在黑名单中
   */
  async isInBlacklist(id: string): Promise<boolean> {
    this.logger.info(`🔍 [Local] isInBlacklist: ${id}`)
    try {
      const result = await this.areInBlacklist([id])
      return result[id] ?? false
    } catch (error) {
      this.logger.error("检查黑名单失败:", error)
      return false
    }
  }

  /**
   * 批量检查多个ID是否在黑名单中
   */
  async areInBlacklist(ids: string[]): Promise<Record<string, boolean>> {
    this.logger.info(`🔍 [Local] areInBlacklist: ${ids.length} items`)
    try {
      const result: Record<string, boolean> = {}

      // 分离笔记本ID和文档ID
      const notebookIds: string[] = []
      const documentIds: string[] = []

      // 简单区分：假设笔记本ID较短，文档ID较长（这只是一个启发式方法，实际可能需要更好的区分方式）
      for (const id of ids) {
        if (id.length < 20) {
          notebookIds.push(id)
        } else {
          documentIds.push(id)
        }
      }

      // 检查笔记本黑名单
      if (notebookIds.length > 0) {
        const notebookResult = await this.areNotebooksInBlacklist(notebookIds)
        Object.assign(result, notebookResult)
      }

      // 检查文档黑名单
      if (documentIds.length > 0) {
        const documentResult = await this.areDocumentsInBlacklist(documentIds)
        Object.assign(result, documentResult)
      }

      return result
    } catch (error) {
      this.logger.error("批量检查黑名单失败:", error)
      const result: Record<string, boolean> = {}
      ids.forEach((id) => (result[id] = false))
      return result
    }
  }

  /**
   * 清空黑名单
   */
  async clearBlacklist(): Promise<void> {
    this.logger.info("🧹 [Local] clearBlacklist called")
    try {
      // 清空笔记本黑名单
      await this.clearNotebookBlacklist()

      // 注意：无法清空所有文档的黑名单属性，因为不知道所有文档的ID
      // 如果需要清空文档黑名单，需要调用方提供文档ID列表
    } catch (error) {
      this.logger.error("清空黑名单失败:", error)
      throw error
    }
  }

  /**
   * 获取指定类型的黑名单项
   */
  async getItemsByType(type: BlacklistItemType): Promise<BlacklistItem[]> {
    this.logger.info(`📑 [Local] getItemsByType: ${type}`)
    try {
      if (type === "notebook") {
        return await this.getNotebookBlacklistItems()
      } else {
        // 无法直接获取所有文档级别的黑名单项
        // 需要调用方通过其他方式获取
        return []
      }
    } catch (error) {
      this.logger.error("按类型获取黑名单失败:", error)
      return []
    }
  }

  /**
   * 搜索黑名单项
   */
  async searchItems(query: string): Promise<BlacklistItem[]> {
    this.logger.info(`🔎 [Local] searchItems: ${query}`)
    try {
      // 获取所有项，然后在客户端过滤
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

  /**
   * 搜索文档列表
   * @param keyword 搜索关键词
   */
  public async searchDocuments(keyword: string): Promise<Array<{ id: string; name: string }>> {
    return await this.blacklistApiService.searchDocuments(keyword)
  }

  /**
   * 搜索笔记本列表
   * @param keyword 搜索关键词
   */
  public async searchNotebooks(keyword: string): Promise<Array<{ id: string; name: string }>> {
    return await this.blacklistApiService.searchNotebooks(keyword)
  }

  // ====================
  // 私有方法 - 笔记本黑名单
  // ====================

  /**
   * 获取笔记本黑名单项
   */
  private async getNotebookBlacklistItems(): Promise<BlacklistItem[]> {
    try {
      const config = await this.pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
      config.appConfig ||= DefaultAppConfig

      const notebookBlacklist = config.appConfig.incrementalShareConfig?.notebookBlacklist || []
      return notebookBlacklist
    } catch (error) {
      this.logger.error("获取笔记本黑名单项失败:", error)
      return []
    }
  }

  /**
   * 添加笔记本到黑名单
   */
  private async addNotebookToBlacklist(item: BlacklistItem): Promise<void> {
    try {
      const config = await this.pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
      config.appConfig ||= DefaultAppConfig

      if (!config.appConfig.incrementalShareConfig) {
        config.appConfig.incrementalShareConfig = { enabled: true }
      }

      const notebookBlacklist = config.appConfig.incrementalShareConfig.notebookBlacklist || []

      // 检查是否已存在
      const existingIndex = notebookBlacklist.findIndex((nb) => nb.id === item.id)
      if (existingIndex >= 0) {
        // 更新现有项
        notebookBlacklist[existingIndex] = item
      } else {
        // 添加新项
        notebookBlacklist.push(item)
      }

      config.appConfig.incrementalShareConfig.notebookBlacklist = notebookBlacklist

      // 保存到本地
      await this.pluginInstance.saveData(SHARE_PRO_STORE_NAME, config)

      // 同步到服务端
      await syncAppConfig(this.settingService, config)

      this.logger.info(`添加笔记本到黑名单: ${item.name}`)
    } catch (error) {
      this.logger.error("添加笔记本到黑名单失败:", error)
      throw error
    }
  }

  /**
   * 从黑名单中移除笔记本
   */
  private async removeNotebookFromBlacklist(id: string): Promise<void> {
    try {
      const config = await this.pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
      config.appConfig ||= DefaultAppConfig

      if (config.appConfig.incrementalShareConfig?.notebookBlacklist) {
        const notebookBlacklist = config.appConfig.incrementalShareConfig.notebookBlacklist
        const filteredList = notebookBlacklist.filter((item) => item.id !== id)

        config.appConfig.incrementalShareConfig.notebookBlacklist = filteredList

        // 保存到本地
        await this.pluginInstance.saveData(SHARE_PRO_STORE_NAME, config)

        // 同步到服务端
        await syncAppConfig(this.settingService, config)

        this.logger.info(`从黑名单中移除笔记本: ${id}`)
      }
    } catch (error) {
      this.logger.error("从黑名单中移除笔记本失败:", error)
      throw error
    }
  }

  /**
   * 批量检查笔记本是否在黑名单中
   */
  private async areNotebooksInBlacklist(ids: string[]): Promise<Record<string, boolean>> {
    try {
      const config = await this.pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
      const notebookBlacklist = config.appConfig?.incrementalShareConfig?.notebookBlacklist || []

      const notebookIdSet = new Set(notebookBlacklist.map((item) => item.id))

      const result: Record<string, boolean> = {}
      for (const id of ids) {
        result[id] = notebookIdSet.has(id)
      }

      return result
    } catch (error) {
      this.logger.error("批量检查笔记本黑名单失败:", error)
      const result: Record<string, boolean> = {}
      ids.forEach((id) => (result[id] = false))
      return result
    }
  }

  /**
   * 清空笔记本黑名单
   */
  private async clearNotebookBlacklist(): Promise<void> {
    try {
      const config = await this.pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
      config.appConfig ||= DefaultAppConfig

      if (config.appConfig.incrementalShareConfig) {
        config.appConfig.incrementalShareConfig.notebookBlacklist = []

        // 保存到本地
        await this.pluginInstance.saveData(SHARE_PRO_STORE_NAME, config)

        // 同步到服务端
        await syncAppConfig(this.settingService, config)

        this.logger.info("清空笔记本黑名单")
      }
    } catch (error) {
      this.logger.error("清空笔记本黑名单失败:", error)
      throw error
    }
  }

  // ====================
  // 私有方法 - 文档黑名单
  // ====================

  /**
   * 添加文档到黑名单
   */
  private async addDocumentToBlacklist(item: BlacklistItem): Promise<void> {
    try {
      const { kernelApi } = await ApiUtils.getSiyuanKernelApi(this.pluginInstance)

      // 添加版本信息和更新时间用于兼容性检查
      const blacklistData = {
        ...item,
        _version: "1.0",
        _addedAt: Date.now(),
      }

      const attrs = {
        "custom-share-blacklist-document": JSON.stringify(blacklistData),
      }

      await kernelApi.setBlockAttrs(item.id, attrs)
      this.logger.info(`添加文档到黑名单: ${item.name}`)
    } catch (error) {
      this.logger.error("添加文档到黑名单失败:", error)
      throw error
    }
  }

  /**
   * 从黑名单中移除文档
   */
  private async removeDocumentFromBlacklist(id: string): Promise<void> {
    try {
      const { kernelApi } = await ApiUtils.getSiyuanKernelApi(this.pluginInstance)

      // 删除文档黑名单属性
      const attrs = {
        "custom-share-blacklist-document": null,
      }

      await kernelApi.setBlockAttrs(id, attrs)
      this.logger.info(`从黑名单中移除文档: ${id}`)
    } catch (error) {
      this.logger.error("从黑名单中移除文档失败:", error)
      throw error
    }
  }

  /**
   * 批量检查文档是否在黑名单中
   */
  private async areDocumentsInBlacklist(ids: string[]): Promise<Record<string, boolean>> {
    try {
      const { kernelApi } = await ApiUtils.getSiyuanKernelApi(this.pluginInstance)

      const result: Record<string, boolean> = {}

      // 批量获取文档属性
      for (const id of ids) {
        try {
          const attrs = await kernelApi.getBlockAttrs(id)
          result[id] = !!attrs["custom-share-blacklist-document"]
        } catch (error) {
          // 如果获取文档属性失败，认为不在黑名单中
          this.logger.warn(`获取文档${id}属性失败:`, error)
          result[id] = false
        }
      }

      return result
    } catch (error) {
      this.logger.error("批量检查文档黑名单失败:", error)
      const result: Record<string, boolean> = {}
      ids.forEach((id) => (result[id] = false))
      return result
    }
  }
}
