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
}

export { SettingService }
