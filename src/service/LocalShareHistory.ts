/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import { simpleLogger } from "zhi-lib-base"
import { isDev, NULL_VALUE_FOR_SIYUAN_ATTR_REMOVE } from "../Constants"
import ShareProPlugin from "../index"
import { ShareHistory, ShareHistoryItem } from "../models/ShareHistory"
import { ApiUtils } from "../utils/ApiUtils"

/**
 * 本地分享历史记录实现
 *
 * 使用思源笔记的文档属性存储分享历史记录，每个文档的分享状态存储在其自身的属性中
 * 属性名称: custom-share-history
 */
export class LocalShareHistory implements ShareHistory {
  private logger = simpleLogger("local-share-history", "share-pro", isDev)
  private pluginInstance: ShareProPlugin

  constructor(pluginInstance: ShareProPlugin) {
    this.pluginInstance = pluginInstance
  }

  public async addHistory(item: ShareHistoryItem): Promise<void> {
    this.logger.info(`➕ [Local] addHistory: ${item.docTitle}`)
    try {
      const { kernelApi } = await ApiUtils.getSiyuanKernelApi(this.pluginInstance)

      // 验证docId有效性
      try {
        // 尝试获取文档属性以验证文档是否存在
        await kernelApi.getBlockAttrs(item.docId)
      } catch (error) {
        this.logger.warn(`文档不存在或无效: ${item.docId}`, error)
        // 如果文档不存在，则不执行任何操作
        return
      }

      // 添加版本信息和更新时间用于兼容性检查
      const historyData = {
        ...item,
        _version: "1.0",
        _updatedAt: Date.now(),
      }

      const attrs = {
        "custom-share-history": JSON.stringify(historyData),
      }

      await kernelApi.setBlockAttrs(item.docId, attrs)
    } catch (error) {
      this.logger.error(`添加分享历史记录失败: ${item.docId}`, error)
      throw error
    }
  }

  async updateHistory(docId: string, updates: Partial<ShareHistoryItem>): Promise<void> {
    this.logger.info(`🔄 [Local] updateHistory: ${docId}`)
    try {
      const { kernelApi } = await ApiUtils.getSiyuanKernelApi(this.pluginInstance)

      // 验证docId有效性
      try {
        // 尝试获取文档属性以验证文档是否存在
        await kernelApi.getBlockAttrs(docId)
      } catch (error) {
        this.logger.warn(`文档不存在或无效: ${docId}`, error)
        // 如果文档不存在，则不执行任何操作
        return
      }

      // 先获取现有记录
      const existingItem = await this.getHistoryByDocId(docId)
      if (!existingItem) {
        throw new Error(`文档 ${docId} 没有找到历史记录`)
      }

      // 合并更新
      const updatedItem = {
        ...existingItem,
        ...updates,
        _version: "1.0",
        _updatedAt: Date.now(),
      }

      const attrs = {
        "custom-share-history": JSON.stringify(updatedItem),
      }

      await kernelApi.setBlockAttrs(docId, attrs)
    } catch (error) {
      this.logger.error(`更新分享历史记录失败: ${docId}`, error)
      throw error
    }
  }

  async removeHistory(docId: string): Promise<void> {
    this.logger.info(`🗑️ [Local] removeHistory: ${docId}`)
    try {
      const { kernelApi } = await ApiUtils.getSiyuanKernelApi(this.pluginInstance)

      // 验证docId有效性
      try {
        // 尝试获取文档属性以验证文档是否存在
        await kernelApi.getBlockAttrs(docId)
      } catch (error) {
        this.logger.warn(`文档不存在或无效: ${docId}`, error)
        // 如果文档不存在，则不执行任何操作
        return
      }

      // 删除分享历史属性
      const attrs = {
        "custom-share-history": NULL_VALUE_FOR_SIYUAN_ATTR_REMOVE,
      }

      await kernelApi.setBlockAttrs(docId, attrs)
    } catch (error) {
      this.logger.error(`删除分享历史记录失败: ${docId}`, error)
      throw error
    }
  }

  public async getHistoryByDocId(docId: string): Promise<ShareHistoryItem | undefined> {
    this.logger.info(`🔍 [Local] getHistoryByDocId: ${docId}`)
    try {
      const { kernelApi } = await ApiUtils.getSiyuanKernelApi(this.pluginInstance)
      const attrs = await kernelApi.getBlockAttrs(docId)

      if (attrs["custom-share-history"]) {
        const item = JSON.parse(attrs["custom-share-history"])

        // 版本兼容性检查
        if (item._version === "1.0") {
          // 移除内部字段
          delete item._version
          delete item._updatedAt
          return item
        }

        // 如果没有版本信息，假设是旧版本格式
        return item
      }

      return undefined
    } catch (error) {
      this.logger.error(`获取文档${docId}的分享历史失败:`, error)
      return undefined
    }
  }
}
