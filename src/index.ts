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
import {
  DEFAULT_SIYUAN_API_URL,
  DEFAULT_SIYUAN_AUTH_TOKEN,
  DEFAULT_SIYUAN_COOKIE,
  isDev,
  SHARE_PRO_STORE_NAME,
  SHARE_SERVICE_ENDPOINT_DEV,
  SHARE_SERVICE_ENDPOINT_PROD,
} from "./Constants"
import { Main } from "./main"
import { ShareProConfig } from "./models/ShareProConfig"
import { initStatusBar } from "./statusBar"

export default class ShareProPlugin extends Plugin {
  private logger: ILogger
  public isMobile: boolean
  public statusBarElement: any
  private main: Main

  constructor(options: { app: App; id: string; name: string; i18n: IObject }) {
    super(options)

    this.logger = simpleLogger("index", "share-pro", isDev)
    const frontEnd = getFrontend()
    this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile"
    this.main = new Main(this)
  }

  async onload() {
    // 初始化菜单
    initStatusBar(this)
    await this.initCfg()
    this.main.start()
    this.logger.info("Share pro loaded")
  }

  onunload() {
    this.logger.info("Share pro unloaded")
  }

  // ================
  // private function
  // ================
  /**
   * 默认配置
   */
  public getDefaultCfg() {
    const latestServiceApiUrl = isDev ? SHARE_SERVICE_ENDPOINT_DEV : SHARE_SERVICE_ENDPOINT_PROD
    return {
      siyuanConfig: {
        apiUrl: DEFAULT_SIYUAN_API_URL,
        token: DEFAULT_SIYUAN_AUTH_TOKEN,
        cookie: DEFAULT_SIYUAN_COOKIE,
        preferenceConfig: {
          fixTitle: false,
        },
      },
      serviceApiConfig: {
        apiUrl: latestServiceApiUrl,
        token: "",
      },
    } as any as ShareProConfig
  }

  /**
   * 安全的加载配置
   *
   * @param storeName 存储 key
   */
  public async safeLoad<T>(storeName: string) {
    const defaultCfg = this.getDefaultCfg() as T
    let storeConfig = defaultCfg
    try {
      storeConfig = await this.loadData(storeName)
    } catch (e) {
      this.logger.error("Share pro config load error", e)
    }

    if (typeof storeConfig !== "object") {
      storeConfig = defaultCfg as T
    }

    return storeConfig as T
  }

  public async safeParse<T>(str: string, def = {}) {
    try {
      return JSON.parse(str) as T
    } catch (e) {
      return def as T
    }
  }

  private async initCfg() {
    const cfg = await this.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
    if (!cfg.inited) {
      cfg.inited = true
      await this.saveData(SHARE_PRO_STORE_NAME, cfg)
      this.logger.info("Share pro config inited")
    } else {
      // 开发阶段
      if (isDev && cfg.serviceApiConfig.apiUrl !== SHARE_SERVICE_ENDPOINT_DEV) {
        cfg.serviceApiConfig = {
          apiUrl: DEFAULT_SIYUAN_API_URL,
          token: DEFAULT_SIYUAN_AUTH_TOKEN,
          cookie: DEFAULT_SIYUAN_COOKIE,
        } as any
        cfg.serviceApiConfig.apiUrl = SHARE_SERVICE_ENDPOINT_DEV
        await this.saveData(SHARE_PRO_STORE_NAME, cfg)
        this.logger.info("Share pro updated for dev mode")
      }
    }
  }
}
