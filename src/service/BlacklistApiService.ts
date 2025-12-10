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
import ShareProPlugin from "../index"
import { ApiUtils } from "../utils/ApiUtils"

/**
 * 黑名单API服务类
 * 封装所有与黑名单相关的内核API调用
 *
 * @author terwer
 * @since 1.15.0
 */
export class BlacklistApiService {
  private logger = simpleLogger("blacklist-api-service", "share-pro", isDev)
  private pluginInstance: ShareProPlugin

  constructor(pluginInstance: ShareProPlugin) {
    this.pluginInstance = pluginInstance
  }

  /**
   * 搜索文档列表
   * @param keyword 搜索关键词
   */
  public async searchDocuments(keyword: string): Promise<Array<{ id: string; name: string }>> {
    this.logger.debug(`🔍 [API] searchDocuments: ${keyword}`)
    try {
      const { kernelApi } = await ApiUtils.getSiyuanKernelApi(this.pluginInstance)

      // 搜索文档
      const sql = `SELECT root_id as id, content as name FROM blocks 
                   WHERE type = 'd' AND (content LIKE '%${keyword}%' OR tag LIKE '%${keyword}%')
                   ORDER BY updated DESC LIMIT 10`
      const res = await kernelApi.sql(sql)
      return res || []
    } catch (error) {
      this.logger.error("搜索文档失败:", error)
      return []
    }
  }

  /**
   * 搜索笔记本列表
   * @param keyword 搜索关键词
   */
  public async searchNotebooks(keyword: string): Promise<Array<{ id: string; name: string }>> {
    this.logger.debug(`🔍 [API] searchNotebooks: ${keyword}`)
    try {
      const { kernelApi } = await ApiUtils.getSiyuanKernelApi(this.pluginInstance)

      // 搜索笔记本
      const res: any = await kernelApi.lsNotebooks()
      if (res && res.notebooks) {
        return res.notebooks
          .filter((nb: any) => nb.name.includes(keyword))
          .map((nb: any) => ({ id: nb.id, name: nb.name }))
          .slice(0, 10)
      } else {
        return []
      }
    } catch (error) {
      this.logger.error("搜索笔记本失败:", error)
      return []
    }
  }
}
