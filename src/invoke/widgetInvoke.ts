/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2024 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import ShareProPlugin from "../index"
import { ILogger, simpleLogger } from "zhi-lib-base"
import { isDev } from "../Constants"
import { openTab } from "siyuan"
import ShareManage from "../libs/ShareManage.svelte"
import { KeyInfo } from "../models/KeyInfo"

class WidgetInvoke {
  private logger: ILogger
  private pluginInstance: ShareProPlugin

  constructor(pluginInstance: ShareProPlugin) {
    this.logger = simpleLogger("widget-invoke", "share-pro", isDev)
    this.pluginInstance = pluginInstance
  }

  public async showShareManageTab(keyInfo: KeyInfo) {
    const tabInstance = await this.showTab(this.pluginInstance.i18n.manageDoc)
    // 重新挂载 svelte
    tabInstance.panelElement.innerHTML = ""
    new ShareManage({
      target: tabInstance.panelElement,
      props: {
        pluginInstance: this.pluginInstance,
        keyInfo: keyInfo,
      } as any,
    })
  }

  private async showTab(title: string) {
    if (this.pluginInstance.tabInstance) {
      this.logger.info("页签已存在，重复使用")
      return this.pluginInstance.tabInstance
    }

    // 自定义tab
    const tabInstance = await openTab({
      app: this.pluginInstance.app,
      custom: {
        id: "share-manage-tab",
        icon: "iconDock",
        title: title,
        data: {},
      },
    })
    this.pluginInstance.tabInstance = tabInstance
    return tabInstance
  }
}

export { WidgetInvoke }
