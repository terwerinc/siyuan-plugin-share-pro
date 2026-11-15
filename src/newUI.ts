/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import { ILogger, simpleLogger } from "zhi-lib-base"
import { isDev } from "./Constants"
import { Menu } from "siyuan"
import ShareProPlugin from "./index"
import { ShareService } from "./service/ShareService"
import { WidgetInvoke } from "./invoke/widgetInvoke"
import ShareEntry from "./libs/pages/ShareEntry.svelte"
import { loadServiceAccess } from "./utils/ServiceAccessUtils"
import PageUtil from "./utils/pageUtil"

const createBootStrap = (content: any, props: any, container: string | HTMLElement) => {
  return new content({
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
  private contentComponent: { $destroy: () => void }
  private pluginInstance: ShareProPlugin
  private shareService: ShareService
  private widgetInvoke: WidgetInvoke

  constructor(pluginInstance: ShareProPlugin, topBarElement: HTMLElement) {
    this.logger = simpleLogger("new-ui", "share-pro", isDev)
    this.pluginInstance = pluginInstance
    this.shareService = pluginInstance.shareService
    this.widgetInvoke = new WidgetInvoke(pluginInstance)
    this.topBarElement = topBarElement
  }

  public async startShareForNewUI() {
    let docId = ""
    const docCheck = this.checkDocId()
    if (docCheck.flag) {
      docId = docCheck.docId
    }
    this.addMenu(ShareEntry, {
      pluginInstance: this.pluginInstance,
      shareService: this.shareService,
      docId,
    }, "share-pro-ui")
  }

  public async settingForNewUI() {
    // Settings is local UI and must not depend on the configured remote service.
    const menu = new Menu("shareProSettingMenu")
    menu.addItem({
      icon: "iconSettings",
      label: this.pluginInstance.i18n.shareSetting,
      click: () => { void this.pluginInstance.openSetting() },
    })
    if (this.pluginInstance.isMobile) menu.fullscreen()
    else {
      const rect = this.topBarElement.getBoundingClientRect()
      menu.open({ x: rect.right, y: rect.bottom, isLeft: true })
    }
    const vipInfo = await loadServiceAccess(this.pluginInstance)
    if (menu.isOpen && vipInfo.code === 0) {
      menu.addItem({ icon: "iconDock", label: this.pluginInstance.i18n.manageDoc,
        click: () => { this.widgetInvoke.showShareManageTab(vipInfo.data) } })
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
    this.contentMenu?.close()
    // 移除旧菜单
    const elements = document.querySelectorAll(".share-free-edition-menu-content")
    elements.forEach((element) => {
      element.remove()
    })

    if (!this.contentMenu) {
      this.contentMenu = new Menu(menuID, () => {
        this.contentComponent?.$destroy()
        this.contentComponent = undefined
      })
    }
    this.contentComponent?.$destroy()
    this.contentMenuElement?.remove()
    const contentWrapper = Object.assign(document.createElement("div"), {
      id: `${menuID}-wrapper`,
      className: "share-pro-menu-content",
    })
    this.contentMenuElement = this.contentMenu.element.appendChild(contentWrapper)
    if (!this.rect) {
      this.rect = this.topBarElement.getBoundingClientRect()
    }
    this.contentComponent = createBootStrap(content, props, this.contentMenuElement)
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
