/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2024 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import { icons } from "./utils/svg"
import { Dialog, showMessage } from "siyuan"
import { ILogger, simpleLogger } from "zhi-lib-base"
import ShareProPlugin from "./index"
import { isDev } from "./Constants"
import pkg from "../package.json"
import ShareMain from "./libs/ShareMain.svelte"

class TopDialog {
  private logger: ILogger
  private pluginInstance: ShareProPlugin

  constructor(pluginInstance: ShareProPlugin) {
    this.logger = simpleLogger("top-dialog", "share-pro", isDev)
    this.pluginInstance = pluginInstance
  }

  public initTopDialog() {
    const topBarElement = this.pluginInstance.addTopBar({
      icon: icons.iconShare,
      title: this.pluginInstance.i18n.sharePro,
      position: "right",
      callback: () => {},
    })
    topBarElement.addEventListener("click", async () => {
      // 初始化菜单
      try {
        await this.showShareMainDialog()
      } catch (e) {
        showMessage("分享服务异常，请联系 youweics@163.com：" + e, 7000, "error")
      }
    })
  }

  private async showShareMainDialog() {
    const settingId = "share-pro-setting"
    const d = new Dialog({
      title: `${this.pluginInstance.i18n.createShare} - ${this.pluginInstance.i18n.sharePro} v${pkg.version}`,
      content: `<div id="${settingId}"></div>`,
      width: this.pluginInstance.isMobile ? "92vw" : "720px",
    })
    new ShareMain({
      target: document.getElementById(settingId) as HTMLElement,
      props: {
        pluginInstance: this.pluginInstance,
        dialog: d,
      },
    })
  }
}

export { TopDialog }
