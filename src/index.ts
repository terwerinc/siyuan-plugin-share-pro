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

export default class ShareProPlugin extends Plugin {
  private logger: ILogger

  constructor(options: { app: App; id: string; name: string; i18n: IObject }) {
    super(options)

    this.logger = simpleLogger("index", "share-pro", isDev)
  }

  onload() {
    this.logger.info("Share pro loaded")
  }

  onunload() {
    this.logger.info("Share pro unloaded")
  }
}
