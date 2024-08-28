/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2024 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import ShareProPlugin from "./index"
import { ILogger, simpleLogger } from "zhi-lib-base"
import { isDev } from "./Constants"
import { icons } from "./utils/svg"
import { confirm, Menu } from "siyuan"
import { ShareServiceApi } from "./api/share-service-api"

/**
 * 顶部按钮
 */
export class Topbar {
  private logger: ILogger
  private pluginInstance: ShareProPlugin
  private shreApi: ShareServiceApi

  constructor(pluginInstance: ShareProPlugin) {
    this.logger = simpleLogger("topbar", "share-pro", isDev)
    this.pluginInstance = pluginInstance
    this.shreApi = new ShareServiceApi(pluginInstance)
  }

  public initTopbar() {
    const topBarElement = this.pluginInstance.addTopBar({
      icon: icons.iconShare,
      title: this.pluginInstance.i18n.sharePro,
      position: "right",
      callback: () => {},
    })
    topBarElement.addEventListener("click", async () => {
      // 初始化菜单
      this.addMenu(topBarElement.getBoundingClientRect())
    })
  }

  private addMenu(rect: DOMRect) {
    const menu = new Menu("shareProMenu")
    menu.addItem({
      icon: `iconTransform`,
      label: this.pluginInstance.i18n.startShare,
      click: async () => {
        await this.shreApi.createShare()
      },
    })
    menu.addSeparator()
    menu.addItem({
      icon: `iconEye`,
      label: this.pluginInstance.i18n.viewArticle,
      click: () => {
        // showMessage("请先在 设置->发布设置配置平台并启用", 7000, "error")
      },
    })
    menu.addSeparator()
    menu.addItem({
      icon: `iconSettings`,
      label: this.pluginInstance.i18n.shareSetting,
      click: () => {
        // showMessage("请先在 设置->发布设置配置平台并启用", 7000, "error")
      },
    })

    if (this.pluginInstance.isMobile) {
      menu.fullscreen()
    } else {
      menu.open({
        x: rect.right,
        y: rect.bottom,
        isLeft: true,
      })
    }
  }
}
