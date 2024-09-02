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
import { confirm, Dialog, Menu, showMessage } from "siyuan"
import { ShareApi } from "./api/share-api"
import { ShareProConfig } from "./models/ShareProConfig"
import ShareSetting from "./libs/ShareSetting.svelte"
import { ShareService } from "./service/ShareService"
import PageUtil from "./utils/pageUtil"

/**
 * 顶部按钮
 */
export class Topbar {
  private logger: ILogger
  private pluginInstance: ShareProPlugin
  private shareService: ShareService

  constructor(pluginInstance: ShareProPlugin) {
    this.logger = simpleLogger("topbar", "share-pro", isDev)
    this.pluginInstance = pluginInstance
    this.shareService = new ShareService(pluginInstance)
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
      try {
        await this.addMenu(topBarElement.getBoundingClientRect())
      } catch (e) {
        showMessage("分享服务异常，请联系 youweics@163.com：" + e, 7000, "error")
      }
    })
  }

  private async addMenu(rect: DOMRect) {
    const docId = PageUtil.getPageId()
    if (docId.trim() == "") {
      showMessage("未找到当前文档，无法分享", 7000, "error")
      return
    }

    const menu = new Menu("shareProMenu")

    const cfg = await this.pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
    const vipInfo = await this.shareService.getVipInfo(cfg?.serviceApiConfig?.token ?? "")
    if (vipInfo.code === 0) {
      menu.addItem({
        icon: `iconTransform`,
        label: this.pluginInstance.i18n.startShare,
        click: async () => {
          await this.shareService.createShare(docId)
        },
      })
      menu.addSeparator()
      menu.addItem({
        icon: `iconEye`,
        label: this.pluginInstance.i18n.viewArticle,
        click: async () => {
          const docInfo = await this.shareService.getSharedDocInfo(docId)
          const isShared = false
          if (!isShared) {
            showMessage("文档未分享，无法查看", 7000, "error")
          }
          await this.shareService.createShare(docId)
        },
      })
      menu.addSeparator()
    } else {
      menu.addItem({
        icon: `iconKey`,
        label: this.pluginInstance.i18n.getLicense,
        click: () => {
          const vipTip = vipInfo.msg ?? this.pluginInstance.i18n.unknownError
          confirm(this.pluginInstance.i18n.tipTitle, vipTip + "，" + this.pluginInstance.i18n.openLicensePage, () => {
            window.open("https://store.terwer.space/products/share-pro")
          })
        },
      })
      menu.addSeparator()
    }

    menu.addItem({
      icon: `iconSettings`,
      label: this.pluginInstance.i18n.shareSetting,
      click: () => {
        const settingId = "share-pro-setting"
        const d = new Dialog({
          title: `${this.pluginInstance.i18n.shareSetting} - ${this.pluginInstance.i18n.sharePro}`,
          content: `<div id="${settingId}"></div>`,
          width: this.pluginInstance.isMobile ? "92vw" : "720px",
        })
        new ShareSetting({
          target: document.getElementById(settingId) as HTMLElement,
          props: {
            pluginInstance: this.pluginInstance,
            dialog: d,
            vipInfo: vipInfo,
          },
        })
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
