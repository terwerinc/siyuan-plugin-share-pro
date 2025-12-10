/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import { Dialog, openTab } from "siyuan"
import { ILogger, simpleLogger } from "zhi-lib-base"
import { isDev } from "../Constants"
import ShareProPlugin from "../index"
import ShareManage from "../libs/pages/ShareManage.svelte"
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

  public async showShareManageDialog(keyInfo: KeyInfo) {
    // 创建弹窗
    const dialog = new Dialog({
      title: this.pluginInstance.i18n.manageDoc,
      content: `<div id="share-manage-dialog-content"></div>`,
      width: "75vw",
      height: this.pluginInstance.isMobile ? "90vh" : document.body.clientHeight > 768 ? "62vh" : "75vh",
    })

    // 等待DOM更新后挂载ShareManage组件
    setTimeout(() => {
      const container = document.getElementById("share-manage-dialog-content")
      if (container) {
        new ShareManage({
          target: container,
          props: {
            pluginInstance: this.pluginInstance,
            keyInfo: keyInfo,
            pageSize: 5,
          } as any,
        })
      }
    }, 0)
  }

  private async showTab(title: string) {
    // 自定义tab
    return await openTab({
      app: this.pluginInstance.app,
      custom: {
        id: "share-manage-tab",
        icon: "iconDock",
        title: title,
        data: {},
      },
      removeCurrentTab: true,
    })
  }
}

export { WidgetInvoke }
