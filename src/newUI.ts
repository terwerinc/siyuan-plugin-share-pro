/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import { ILogger, simpleLogger } from "zhi-lib-base"
import { isDev, SHARE_PRO_STORE_NAME } from "./Constants"
import { confirm, Dialog, Menu, showMessage } from "siyuan"
import ShareProPlugin from "./index"
import { ShareService } from "./service/ShareService"
import { ShareProConfig } from "./models/ShareProConfig"
import { WidgetInvoke } from "./invoke/widgetInvoke"
import pkg from "../package.json"
import ShareSetting from "./libs/pages/ShareSetting.svelte"
import ShareUI from "./libs/pages/ShareUI.svelte"
import PageUtil from "./utils/pageUtil"

const createBootStrap = (content: any, props: any, container: string | HTMLElement) => {
  new content({
    target: container,
    props: props as any,
  })
}

/**
 * 新版UI
 *
 * @author terwer
 * @since 1.9.0
 */
class NewUI {
  private logger: ILogger
  private rect: DOMRect
  private topBarElement: HTMLElement
  private contentMenu: Menu
  private contentMenuElement: HTMLElement
  private pluginInstance: ShareProPlugin
  private shareService: ShareService
  private widgetInvoke: WidgetInvoke

  constructor(pluginInstance: ShareProPlugin, topBarElement: HTMLElement) {
    this.logger = simpleLogger("new-ui", "share-pro", isDev)
    this.pluginInstance = pluginInstance
    this.shareService = new ShareService(pluginInstance)
    this.widgetInvoke = new WidgetInvoke(pluginInstance)
    this.topBarElement = topBarElement
  }

  public async startShareForNewUI() {
    const docCheck = this.checkDocId()
    if (docCheck.flag) {
      // 挂载内容到菜单
      this.addMenu(
        ShareUI,
        {
          pluginInstance: this.pluginInstance,
          docId: docCheck.docId,
        },
        "share-pro-ui"
      )
    } else {
      showMessage(this.pluginInstance.i18n.msgNotFoundDoc, 7000, "error")
    }
  }

  public async settingForNewUI() {
    const cfg = await this.pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
    const vipInfo = await this.shareService.getVipInfo(cfg?.serviceApiConfig?.token ?? "")
    const menu = new Menu("shareProSettingMenu")
    if (vipInfo.code === 0) {
      const keyInfo = vipInfo.data
      // 分享管理
      menu.addItem({
        icon: `iconDock`,
        label: this.pluginInstance.i18n.manageDoc,
        click: () => {
          this.widgetInvoke.showShareManageTab(keyInfo)
        },
      })
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
    }

    menu.addSeparator()
    menu.addItem({
      icon: `iconSettings`,
      label: this.pluginInstance.i18n.shareSetting,
      click: () => {
        const settingId = "share-pro-setting"
        const d = new Dialog({
          title: `${this.pluginInstance.i18n.shareSetting} - ${this.pluginInstance.i18n.sharePro} v${pkg.version}`,
          content: `<div id="${settingId}"></div>`,
          width: this.pluginInstance.isMobile ? "92vw" : "61.8vw",
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
      const rect = this.topBarElement.getBoundingClientRect()
      menu.open({
        x: rect.right,
        y: rect.bottom,
        isLeft: true,
      })
    }
  }

  // ================
  // private function
  // ================

  private checkDocId() {
    const docId = PageUtil.getPageId()
    if (docId.trim() == "") {
      return {
        flag: false,
      }
    }
    return {
      flag: true,
      docId: docId,
    }
  }

  private addMenu(content: any, props: any, menuID: string) {
    // 移除旧菜单
    const elements = document.querySelectorAll('.share-free-edition-menu-content');
    elements.forEach(element => {
      element.remove();
    });

    if (!this.contentMenu) {
      this.contentMenu = new Menu(menuID)
    }
    this.contentMenuElement?.remove()
    const contentWrapper = Object.assign(document.createElement("div"), {
      id: `${menuID}-wrapper`,
      className: "share-pro-menu-content",
    })
    this.contentMenuElement = this.contentMenu.element.appendChild(contentWrapper)
    if (!this.rect) {
      this.rect = this.topBarElement.getBoundingClientRect()
    }
    createBootStrap(content, props, this.contentMenuElement)
    // 显示菜单
    const rect = this.rect
    this.contentMenu.open({
      x: rect.left,
      y: rect.bottom,
      isLeft: true,
    })
  }
}

export { NewUI }
