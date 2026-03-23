/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import { simpleLogger } from "zhi-lib-base"
import { isDev, NULL_VALUE_FOR_SIYUAN_ATTR_REMOVE, SHARE_PRO_STORE_NAME } from "../Constants"
import ShareProPlugin from "../index"
import { BlacklistItem, BlacklistItemType, ShareBlacklist } from "../models/ShareBlacklist"
import { ShareProConfig } from "../models/ShareProConfig"
import { ApiUtils } from "../utils/ApiUtils"
import { SettingKeys } from "../utils/SettingKeys"
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
  public async getItemsPaged(
    pageNum: number,
    pageSize: number,
    type: "notebook" | "document" | "all" = "all",
    query = ""
  ): Promise<BlacklistItem[]> {
    this.logger.debug(
      `📋 [Local] getItemsPaged called: page=${pageNum}, size=${pageSize}, type=${type}, query=${query}`
    )
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
  public async getItemsCount(type: "notebook" | "document" | "all" = "all", query = ""): Promise<number> {
    this.logger.debug(`📊 [Local] getItemsCount called: type=${type}, query=${query}`)
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
  public async addItem(item: BlacklistItem): Promise<void> {
    this.logger.debug(`🚫 [Local] addItem: ${item.name} (${item.type})`)
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
  public async removeItem(id: string, type: "notebook" | "document"): Promise<void> {
    this.logger.debug(`✅ [Local] removeItem: ${id}, type=${type}`)
    try {
      if (type === "notebook") {
        await this.removeNotebookFromBlacklist(id)
      } else {
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
  public async isInBlacklist(id: string): Promise<boolean> {
    this.logger.debug(`🔍 [Local] isInBlacklist: ${id}`)
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
    this.logger.debug(`🔍 [Local] areInBlacklist: ${ids.length} items`)
    try {
      const result: Record<string, boolean> = {}

      // 分离笔记本ID和文档ID
      // 其实无法区分，传过来的都是文档ID，那么我们换个思路
      // 1、documentIds直接使用ids
      // 2、notebookIds可以查询呀，封装一个方法 getNotebookIdsFromBlacklist(ds: string[])
      // 注意各自在内部判断即可，外部无需担心

      // 统一检查笔记本/文档黑名单
      if (ids.length > 0) {
        // 检测笔记本黑名单
        const notebookResult = await this.areNotebooksInBlacklist(ids)
        Object.assign(result, notebookResult)
        // 检测文档黑名单
        const documentResult = await this.areDocumentsInBlacklist(ids)
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
  public async clearBlacklist(): Promise<void> {
    this.logger.debug("🧹 [Local] clearBlacklist called")
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
   *
   * @deprecated 未分页，不推荐使用
   */
  public async getItemsByType(type: BlacklistItemType): Promise<BlacklistItem[]> {
    this.logger.debug(`📑 [Local] getItemsByType: ${type}`)
    try {
      if (type === "notebook") {
        return await this.getNotebookBlacklistItems()
      } else {
        return await this.getDocumentBlacklistItems()
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

      this.logger.debug(`添加笔记本到黑名单: ${item.name}`)
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

        this.logger.debug(`从黑名单中移除笔记本: ${id}`)
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
      const dbNotebookIdSet = new Set(notebookBlacklist.map((item) => item.id))

      // 获取当前文档所在的笔记本列表
      const docNotebookIds: string[] = await this.getNotebookIdsFromBlacklist(ids)

      const result: Record<string, boolean> = {}
      for (const id of docNotebookIds) {
        result[id] = dbNotebookIdSet.has(id)
      }

      return result
    } catch (error) {
      this.logger.error("批量检查笔记本黑名单失败:", error)
      const result: Record<string, boolean> = {}
      ids.forEach((id) => (result[id] = false))
      return result
    }
  }

  private async getNotebookIdsFromBlacklist(ids: string[]): Promise<string[]> {
    try {
      // 直接用 sql 查询思源笔记
      // 查询当前文档所在的笔记本集合
      const { kernelApi } = await ApiUtils.getSiyuanKernelApi(this.pluginInstance)
      // 正确转义ID并添加引号
      const escapedIds = ids.map((id) => `'${id.replace(/'/g, "''")}'`).join(",")
      const sql = `
        SELECT DISTINCT b.root_id as id, b.box as notebookId
        FROM blocks b
        WHERE b.type = 'd' and b.root_id in (${escapedIds})
      `
      this.logger.debug("getNotebookIdsFromBlacklist SQL:", sql)
      const resData = await kernelApi.sql(sql)
      // 注意box去重，因为多个文档可共享笔记本
      const notebookIdSet = new Set<string>(resData.map((row: any) => row.notebookId as string))
      return Array.from(notebookIdSet)
    } catch (error) {
      this.logger.error("获取笔记本黑名单失败:", error)
      return []
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

        this.logger.debug("清空笔记本黑名单")
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
   *
   * @deprecated 未分页，不推荐使用
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
        [SettingKeys.CUSTOM_SHARE_BLACKLIST_DOCUMENT]: "true",
      }

      await kernelApi.setBlockAttrs(item.id, attrs)
      this.logger.debug(`添加文档到黑名单: ${item.name}`)
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
        [SettingKeys.CUSTOM_SHARE_BLACKLIST_DOCUMENT]: NULL_VALUE_FOR_SIYUAN_ATTR_REMOVE,
      }

      await kernelApi.setBlockAttrs(id, attrs)
      this.logger.debug(`从黑名单中移除文档: ${id}`)
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
          result[id] = !!attrs[SettingKeys.CUSTOM_SHARE_BLACKLIST_DOCUMENT]
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
