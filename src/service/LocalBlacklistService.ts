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
   * 分页获取黑名单项
   * @param pageNum 页码（从 0 开始）
   * @param pageSize 每页大小
   * @param type 类型筛选（可选，默认为"all"）
   * @param query 搜索关键词（可选，默认为空）
   */
  async getItemsPaged(
    pageNum: number,
    pageSize: number,
    type: "notebook" | "document" | "all" = "all",
    query = ""
  ): Promise<BlacklistItem[]> {
    this.logger.info(`📋 [Local] getItemsPaged called: page=${pageNum}, size=${pageSize}, type=${type}, query=${query}`)
    try {
      const offset = pageNum * pageSize

      // 根据类型筛选获取数据
      if (type === "notebook") {
        // 只获取笔记本数据
        const notebookItems = await this.getNotebookBlacklistItems()
        let filteredItems = notebookItems

        // 关键词搜索
        if (query) {
          filteredItems = notebookItems.filter(
            (item) =>
              item.name.toLowerCase().includes(query.toLowerCase()) ||
              item.note?.toLowerCase().includes(query.toLowerCase())
          )
        }

        // 分页处理
        return filteredItems.slice(offset, offset + pageSize)
      } else if (type === "document") {
        // 只获取文档数据
        return await this.getDocumentBlacklistItemsPaged(pageNum, pageSize, query)
      } else {
        // 获取所有数据（笔记本 + 文档）
        // 先获取笔记本数据
        const notebookItems = await this.getNotebookBlacklistItems()
        let filteredNotebookItems = notebookItems

        // 关键词搜索
        if (query) {
          filteredNotebookItems = notebookItems.filter(
            (item) =>
              item.name.toLowerCase().includes(query.toLowerCase()) ||
              item.note?.toLowerCase().includes(query.toLowerCase())
          )
        }

        // 检查请求的数据是否完全在笔记本范围内
        if (offset + pageSize <= filteredNotebookItems.length) {
          // 完全在笔记本范围内
          return filteredNotebookItems.slice(offset, offset + pageSize)
        } else if (offset < filteredNotebookItems.length) {
          // 跨越笔记本和文档范围
          const notebookSlice = filteredNotebookItems.slice(offset)
          const remainingSlots = pageSize - notebookSlice.length
          // 获取文档级别的黑名单项
          const documentItems = await this.getDocumentBlacklistItemsPaged(0, remainingSlots, query)
          return [...notebookSlice, ...documentItems]
        } else {
          // 完全在文档范围内
          const documentOffset = offset - filteredNotebookItems.length
          return await this.getDocumentBlacklistItemsPaged(Math.floor(documentOffset / pageSize), pageSize, query)
        }
      }
    } catch (error) {
      this.logger.error("分页获取黑名单项失败:", error)
      return []
    }
  }

  /**
   * 获取黑名单项总数
   * @param type 类型筛选（可选，默认为"all"）
   * @param query 搜索关键词（可选，默认为空）
   */
  async getItemsCount(type: "notebook" | "document" | "all" = "all", query = ""): Promise<number> {
    this.logger.info(`📊 [Local] getItemsCount called: type=${type}, query=${query}`)
    try {
      if (type === "notebook") {
        // 只计算笔记本数据
        const notebookItems = await this.getNotebookBlacklistItems()
        if (query) {
          return notebookItems.filter(
            (item) =>
              item.name.toLowerCase().includes(query.toLowerCase()) ||
              item.note?.toLowerCase().includes(query.toLowerCase())
          ).length
        }
        return notebookItems.length
      } else if (type === "document") {
        // 只计算文档数据
        return await this.getDocumentBlacklistCount(query)
      } else {
        // 计算所有数据（笔记本 + 文档）
        const notebookItems = await this.getNotebookBlacklistItems()
        let notebookCount = notebookItems.length

        // 关键词搜索
        if (query) {
          notebookCount = notebookItems.filter(
            (item) =>
              item.name.toLowerCase().includes(query.toLowerCase()) ||
              item.note?.toLowerCase().includes(query.toLowerCase())
          ).length
        }

        const documentCount = await this.getDocumentBlacklistCount(query)
        return notebookCount + documentCount
      }
    } catch (error) {
      this.logger.error("获取黑名单项总数失败:", error)
      return 0
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

      const notebookBlacklist: any[] = config.appConfig.incrementalShareConfig.notebookBlacklist || []

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
   * 获取文档级别的黑名单项（通过SQL查询）
   */
  private async getDocumentBlacklistItems(): Promise<BlacklistItem[]> {
    try {
      const { kernelApi } = await ApiUtils.getSiyuanKernelApi(this.pluginInstance)

      // 使用LEFT JOIN查询包含 custom-share-blacklist-document 属性的文档
      // 参考您提供的示例查询方式
      const sql = `
        SELECT DISTINCT b.root_id as id, b.content as content
        FROM blocks b
        LEFT JOIN attributes a ON b.root_id = a.block_id
        WHERE b.type = 'd'
        AND a.name = 'custom-share-blacklist-document' 
        AND a.value = 'true'
      `
      const result = await kernelApi.sql(sql)

      // 构造最小化的黑名单项
      const items: BlacklistItem[] = result.map((row) => ({
        id: row.id,
        name: row.content || "未命名文档",
        type: "document",
        addedTime: Date.now(), // 实际添加时间无法获取，使用当前时间
        note: "文档黑名单项",
      }))

      return items
    } catch (error) {
      this.logger.error("获取文档黑名单项失败:", error)
      return []
    }
  }

  /**
   * 获取文档级别的黑名单项数量（通过SQL查询）
   */
  private async getDocumentBlacklistCount(query = ""): Promise<number> {
    try {
      const { kernelApi } = await ApiUtils.getSiyuanKernelApi(this.pluginInstance)

      // 使用LEFT JOIN查询包含 custom-share-blacklist-document 属性的文档数量
      let sql = `
        SELECT COUNT(DISTINCT b.root_id) as count
        FROM blocks b
        LEFT JOIN attributes a ON b.root_id = a.block_id
        WHERE b.type = 'd'
        AND a.name = 'custom-share-blacklist-document' 
        AND a.value = 'true'
      `

      // 如果有搜索关键词，添加搜索条件
      if (query) {
        sql += ` AND (b.content LIKE '%${query}%' OR b.tag LIKE '%${query}%')`
      }

      this.logger.debug("getDocumentBlacklistCount SQL:", sql)
      const result = await kernelApi.sql(sql)
      return result.length > 0 ? parseInt(result[0].count) : 0
    } catch (error) {
      this.logger.error("获取文档黑名单项数量失败:", error)
      return 0
    }
  }

  /**
   * 获取文档级别的黑名单项（通过SQL查询，支持分页）
   * @param pageNum 页码（从0开始）
   * @param pageSize 每页大小
   */
  private async getDocumentBlacklistItemsPaged(
    pageNum: number,
    pageSize: number,
    query = ""
  ): Promise<BlacklistItem[]> {
    try {
      const { kernelApi } = await ApiUtils.getSiyuanKernelApi(this.pluginInstance)
      const offset = pageNum * pageSize

      // 使用LEFT JOIN查询包含 custom-share-blacklist-document 属性的文档
      // 参考您提供的示例查询方式，添加分页支持
      let sql = `
        SELECT DISTINCT b.root_id as id, b.content as content
        FROM blocks b
        LEFT JOIN attributes a ON b.root_id = a.block_id
        WHERE b.type = 'd'
        AND a.name = 'custom-share-blacklist-document' 
        AND a.value = 'true'
      `

      // 如果有搜索关键词，添加搜索条件
      if (query) {
        sql += ` AND (b.content LIKE '%${query}%' OR b.tag LIKE '%${query}%')`
      }

      // 添加分页
      sql += ` LIMIT ${pageSize} OFFSET ${offset}`

      this.logger.debug("getDocumentBlacklistItemsPaged SQL:", sql)
      const result = await kernelApi.sql(sql)

      // 构造最小化的黑名单项
      const items: BlacklistItem[] = result.map((row) => ({
        id: row.id,
        name: row.content || "未命名文档",
        type: "document",
        addedTime: Date.now(), // 实际添加时间无法获取，使用当前时间
        note: "文档黑名单项",
      }))

      return items
    } catch (error) {
      this.logger.error("获取文档黑名单项失败:", error)
      return []
    }
  }

  /**
   * 添加文档到黑名单
   */
  private async addDocumentToBlacklist(item: BlacklistItem): Promise<void> {
    try {
      const { kernelApi } = await ApiUtils.getSiyuanKernelApi(this.pluginInstance)

      // 只存储简单的标识，避免属性爆炸
      const attrs = {
        "custom-share-blacklist-document": "true",
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
