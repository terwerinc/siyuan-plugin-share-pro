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
        documents: []
      }
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
        ...settings
      }
    }
    return await this.shareApi.saveSetting(token, updatedSetting)
  }

  /**
   * Add blacklist item
   */
  public async addBlacklistItem(token: string, type: 'notebook' | 'document', pattern: string, description?: string) {
    const settings = await this.getIncrementalShareSettings(token)
    const key = type === 'notebook' ? 'notebooks' : 'documents'
    
    const newItem = {
      pattern,
      description: description || '',
      createdAt: new Date().toISOString()
    }
    
    settings.blacklist[key].push(newItem)
    
    return await this.saveIncrementalShareSettings(token, settings)
  }

  /**
   * Remove blacklist item
   */
  public async removeBlacklistItem(token: string, type: 'notebook' | 'document', pattern: string) {
    const settings = await this.getIncrementalShareSettings(token)
    const key = type === 'notebook' ? 'notebooks' : 'documents'
    
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
}

export { SettingService }
