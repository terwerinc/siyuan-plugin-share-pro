/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2022-2024 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import { App, IObject, Plugin } from "siyuan"
import { ILogger, simpleLogger } from "zhi-lib-base"

import "../index.styl"
import { isDev } from "./Constants"
import { Topbar } from "./topbar"

export default class ShareProPlugin extends Plugin {
  private logger: ILogger
  private topbar: Topbar

  constructor(options: { app: App; id: string; name: string; i18n: IObject }) {
    super(options)

    this.logger = simpleLogger("index", "share-pro", isDev)
    this.topbar = new Topbar(this)
  }

  onload() {
    // 初始化菜单
    this.topbar.initTopbar()
    this.logger.info("Share pro loaded")
  }

  onunload() {
    this.logger.info("Share pro unloaded")
  }
}
