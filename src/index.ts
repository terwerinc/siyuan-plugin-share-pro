/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2022-2024 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import { App, getFrontend, IObject, Plugin } from "siyuan"
import { ILogger, simpleLogger } from "zhi-lib-base"

import "../index.styl"
import { isDev, SHARE_PRO_STORE_NAME, SHARE_SERVICE_ENDPOINT_DEV, SHARE_SERVICE_ENDPOINT_PROD } from "./Constants"
import { Topbar } from "./topbar"
import { ShareProConfig } from "./models/ShareProConfig"

export default class ShareProPlugin extends Plugin {
  private logger: ILogger
  private topbar: Topbar
  public isMobile: boolean

  constructor(options: { app: App; id: string; name: string; i18n: IObject }) {
    super(options)

    this.logger = simpleLogger("index", "share-pro", isDev)
    const frontEnd = getFrontend()
    this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile"
    this.topbar = new Topbar(this)
  }

  async onload() {
    // 初始化菜单
    this.topbar.initTopbar()
    await this.initCfg()
    this.logger.info("Share pro loaded")
  }

  onunload() {
    this.logger.info("Share pro unloaded")
  }

  // ================
  // private function
  // ================
  /**
   * 安全的加载配置
   *
   * @param storeName 存储 key
   */
  public async safeLoad<T>(storeName: string) {
    let storeConfig = {}
    try {
      storeConfig = await this.loadData(storeName)
    } catch (e) {
      this.logger.error("Share pro config load error", e)
    }

    if (typeof storeConfig !== "object") {
      storeConfig = {} as T
    }

    return storeConfig as T
  }

  private async initCfg() {
    const cfg = await this.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
    const latestApiUrl = isDev ? SHARE_SERVICE_ENDPOINT_DEV : SHARE_SERVICE_ENDPOINT_PROD
    if (cfg?.serviceApiConfig?.apiUrl !== latestApiUrl) {
      cfg.serviceApiConfig = {
        apiUrl: latestApiUrl,
        token: "",
      }
      await this.saveData(SHARE_PRO_STORE_NAME, cfg)
      this.logger.info("Share pro config inited")
    }
  }
}
