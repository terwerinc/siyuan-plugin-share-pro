/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2024 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import { ILogger, simpleLogger } from "zhi-lib-base"
import ShareProPlugin from "../index"
import { isDev } from "../Constants"
import { ShareApi } from "../api/share-api"

/**
 * 设置
 */
class SettingService {
  private logger: ILogger
  private pluginInstance: ShareProPlugin
  private shareApi: ShareApi

  constructor(pluginInstance: ShareProPlugin) {
    this.pluginInstance = pluginInstance
    this.logger = simpleLogger("setting-service", "share-pro", isDev)
    this.shareApi = new ShareApi(pluginInstance)
  }

  public async syncSetting(token: string, setting: any) {
    return await this.shareApi.saveSetting(token, setting)
  }

  public async getSettingByAuthor(author: string) {
    return await this.shareApi.getSettingByAuthor(author)
  }

  /**
   * Get incremental share settings
   */
  public async getIncrementalShareSettings(author: string) {
    const setting = await this.getSettingByAuthor(author)
    return {
      enabled: setting?.incrementalShare?.enabled ?? false,
      autoDetectInterval: setting?.incrementalShare?.autoDetectInterval ?? 3600, // 1 hour default
      maxBulkShareCount: setting?.incrementalShare?.maxBulkShareCount ?? 50,
      blacklist: setting?.incrementalShare?.blacklist ?? {
        notebooks: [],
        documents: [],
      },
    }
  }

  /**
   * Save incremental share settings
   */
  public async saveIncrementalShareSettings(token: string, settings: any) {
    const currentSetting = await this.shareApi.getSetting(token)
    const updatedSetting = {
      ...currentSetting,
      incrementalShare: {
        ...currentSetting?.incrementalShare,
        ...settings,
      },
    }
    return await this.shareApi.saveSetting(token, updatedSetting)
  }

  /**
   * Add blacklist item
   */
  public async addBlacklistItem(token: string, type: "notebook" | "document", pattern: string, description?: string) {
    const settings = await this.getIncrementalShareSettings(token)
    const key = type === "notebook" ? "notebooks" : "documents"

    const newItem = {
      pattern,
      description: description || "",
      createdAt: new Date().toISOString(),
    }

    settings.blacklist[key].push(newItem)

    return await this.saveIncrementalShareSettings(token, settings)
  }

  /**
   * Remove blacklist item
   */
  public async removeBlacklistItem(token: string, type: "notebook" | "document", pattern: string) {
    const settings = await this.getIncrementalShareSettings(token)
    const key = type === "notebook" ? "notebooks" : "documents"

    settings.blacklist[key] = settings.blacklist[key].filter((item: any) => item.pattern !== pattern)

    return await this.saveIncrementalShareSettings(token, settings)
  }

  /**
   * Get blacklist items
   */
  public async getBlacklistItems(author: string) {
    const settings = await this.getIncrementalShareSettings(author)
    return settings.blacklist
  }

  /**
   * 获取配置（为 IncrementalShareService 提供）
   *
   * 📝 TODO: 真实 API 调用说明
   * ========================================
   * 1. 使用 getSettingByAuthor(author) 获取配置
   * 2. author 可以从 config.serviceApiConfig.token 解析
   * 3. 或者使用 pluginInstance.safeLoad(SHARE_PRO_STORE_NAME)
   */
  public async getSettingConfig(): Promise<any> {
    // 🔧 Mock 实现
    // TODO: 替换为真实调用
    // const author = extractAuthorFromToken(config.serviceApiConfig.token)
    // return await this.getSettingByAuthor(author)

    this.logger.info("🔧 [Mock] getSettingConfig called")
    return {
      incrementalShareConfig: {
        enabled: true,
        lastShareTime: Date.now() - 1000 * 60 * 60 * 24, // 1天前
        notebookBlacklist: [],
        docBlacklist: [],
      },
    }
  }

  /**
   * 保存配置（为 IncrementalShareService 提供）
   *
   * 📝 TODO: 真实 API 调用说明
   * ========================================
   * 1. 使用 syncSetting(token, setting) 保存配置
   * 2. token 从 config.serviceApiConfig.token 获取
   * 3. 或者使用 pluginInstance.saveData(SHARE_PRO_STORE_NAME, config)
   */
  public async saveSettingConfig(config: any): Promise<void> {
    // 🔧 Mock 实现
    // TODO: 替换为真实调用
    // const token = config.serviceApiConfig.token
    // await this.syncSetting(token, config)

    this.logger.info("🔧 [Mock] saveSettingConfig called", config)
  }
}

export { SettingService }
