/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import { simpleLogger } from "zhi-lib-base"
import { isDev } from "../Constants"
import { ShareHistoryItem } from "../types"

/**
 * 分享历史记录缓存
 *
 * 提供内存级别的缓存机制，减少重复查询的开销
 */
class ShareHistoryCache {
  private logger = simpleLogger("share-history-cache", "share-pro", isDev)
  private cache: Map<string, ShareHistoryItem> = new Map()
  private timestamps: Map<string, number> = new Map()
  private readonly TTL = 5 * 60 * 1000 // 5分钟

  /**
   * 获取缓存的分享历史记录
   *
   * @param docId 文档ID
   * @returns 分享历史记录，如果不存在或已过期则返回undefined
   */
  get(docId: string): ShareHistoryItem | undefined {
    const timestamp = this.timestamps.get(docId)
    if (timestamp && Date.now() - timestamp < this.TTL) {
      const item = this.cache.get(docId)
      this.logger.debug(`缓存命中: ${docId}`)
      return item
    }

    // 过期则清除
    this.cache.delete(docId)
    this.timestamps.delete(docId)
    this.logger.debug(`缓存未命中或已过期: ${docId}`)
    return undefined
  }

  /**
   * 设置分享历史记录缓存
   *
   * @param docId 文档ID
   * @param item 分享历史记录
   */
  set(docId: string, item: ShareHistoryItem): void {
    this.cache.set(docId, item)
    this.timestamps.set(docId, Date.now())
    this.logger.debug(`缓存已设置: ${docId}`)
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    this.cache.clear()
    this.timestamps.clear()
    this.logger.info("所有缓存已清除")
  }

  /**
   * 清除特定文档的缓存
   *
   * @param docId 文档ID
   */
  invalidate(docId: string): void {
    this.cache.delete(docId)
    this.timestamps.delete(docId)
    this.logger.debug(`缓存已失效: ${docId}`)
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): { size: number; ttl: number } {
    return {
      size: this.cache.size,
      ttl: this.TTL,
    }
  }
}

// 全局单例
export const shareHistoryCache = new ShareHistoryCache()
