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
import { isDev, SHARE_PRO_STORE_NAME } from "./Constants"
import { icons } from "./utils/svg"
import { confirm, Menu, showMessage } from "siyuan"
import { ShareServiceApi } from "./api/share-service-api"
import { ShareProConfig } from "./models/ShareProConfig"

/**
 * 顶部按钮
 */
export class Topbar {
  private logger: ILogger
  private pluginInstance: ShareProPlugin
  private shareApi: ShareServiceApi

  constructor(pluginInstance: ShareProPlugin) {
    this.logger = simpleLogger("topbar", "share-pro", isDev)
    this.pluginInstance = pluginInstance
    this.shareApi = new ShareServiceApi(pluginInstance)
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
      await this.addMenu(topBarElement.getBoundingClientRect())
    })
  }

  private async addMenu(rect: DOMRect) {
    const menu = new Menu("shareProMenu")

    const cfg = await this.pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
    const vipInfo = await this.shareApi.getVipInfo(cfg?.serviceApiConfig?.token ?? "")
    if (vipInfo.code === 0) {
      menu.addItem({
        icon: `iconTransform`,
        label: this.pluginInstance.i18n.startShare,
        click: async () => {
          await this.shareApi.createShare()
        },
      })
      menu.addSeparator()
      menu.addItem({
        icon: `iconEye`,
        label: this.pluginInstance.i18n.viewArticle,
        click: () => {
          const isShared = false
          if (!isShared) {
            showMessage("文档未分享，无法查看", 7000, "error")
          }
        },
      })
      menu.addSeparator()
    } else {
      menu.addItem({
        icon: `iconKey`,
        label: this.pluginInstance.i18n.getLicense,
        click: () => {
          const vipTip = vipInfo.msg ?? this.pluginInstance.i18n.unknownError
          confirm(this.pluginInstance.i18n.tipTitle, vipTip + this.pluginInstance.i18n.openLicensePage, () => {
            window.open("https://store.terwer.space/products/share-pro")
          })
        },
      })
      menu.addSeparator()
    }

    menu.addItem({
      icon: `iconSettings`,
      label: this.pluginInstance.i18n.shareSetting,
      click: () => {},
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
