/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2024-2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import { ILogger, simpleLogger } from "zhi-lib-base"
import { isDev } from "../Constants"
import { ShareApi } from "../api/share-api"
import ShareProPlugin from "../index"
import { normalizeAppConfigForViewerContract } from "../utils/ViewerContractUtils"

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

  public async syncSetting(token: string, setting: any, signal?: AbortSignal) {
    return await this.shareApi.saveSetting(token, normalizeAppConfigForViewerContract(setting), signal)
  }

  public async getSettingByAuthor(author: string, signal?: AbortSignal) {
    const setting = await this.shareApi.getSettingByAuthor(author, signal)
    if (setting && typeof setting.code === "number" && setting.code !== 0 && typeof setting.errorCode === "string") {
      throw Object.assign(new Error(setting.msg || this.pluginInstance.i18n.serviceErrors.UNKNOWN_ERROR), {errorCode:setting.errorCode})
    }
    return normalizeAppConfigForViewerContract(setting)
  }
}

export { SettingService }
