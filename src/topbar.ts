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
import { ShareProConfig } from "./models/ShareProConfig"
import ShareSetting from "./libs/pages/ShareSetting.svelte"
import { ShareService } from "./service/ShareService"
import PageUtil from "./utils/pageUtil"
import { WidgetInvoke } from "./invoke/widgetInvoke"
import pkg from "../package.json"

/**
 * 顶部按钮
 */
class Topbar {
  private logger: ILogger
  private pluginInstance: ShareProPlugin
  private shareService: ShareService
  private widgetInvoke: WidgetInvoke

  constructor(pluginInstance: ShareProPlugin) {
    this.logger = simpleLogger("topbar", "share-pro", isDev)
    this.pluginInstance = pluginInstance
    this.shareService = new ShareService(pluginInstance)
    this.widgetInvoke = new WidgetInvoke(pluginInstance)
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
        const errMsg = this.pluginInstance.i18n.topbar.shareSuccessError + e
        showMessage(errMsg, 7000, "error")
      }
    })
  }

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

  private async addMenu(rect: DOMRect) {
    const menu = new Menu("shareProMenu")

    const cfg = await this.pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
    const vipInfo = await this.shareService.getVipInfo(cfg?.serviceApiConfig?.token ?? "")
    if (vipInfo.code === 0) {
      const docCheck = this.checkDocId()
      if (docCheck.flag) {
        const docInfo = await this.shareService.getSharedDocInfo(docCheck.docId)
        const isShared = docInfo.code === 0
        const shareData = docInfo?.data ? JSON.parse(docInfo.data) : null
        if (shareData) {
          this.logger.info("get shared data =>", shareData)
          if (shareData.shareStatus !== "COMPLETED") {
            alert(this.pluginInstance.i18n.topbar.msgIngError)
          }
        }
        menu.addItem({
          icon: isShared ? `iconCloseRound` : `iconRiffCard`,
          label: isShared ? this.pluginInstance.i18n.cancelShare : this.pluginInstance.i18n.startShare,
          click: async () => {
            if (isShared) {
              confirm(this.pluginInstance.i18n.tipTitle, this.pluginInstance.i18n.confirmDelete, async () => {
                if (!docCheck.flag) {
                  showMessage(this.pluginInstance.i18n.msgNotFoundDoc, 7000, "error")
                  return
                }
                const ret = await this.shareService.deleteDoc(docCheck.docId)
                if (ret.code === 0) {
                  showMessage(this.pluginInstance.i18n.topbar.cancelSuccess, 3000, "info")
                } else {
                  showMessage(this.pluginInstance.i18n.topbar.cancelError + ret.msg, 7000, "error")
                }
              })
            } else {
              if (!docCheck.flag) {
                showMessage(this.pluginInstance.i18n.msgNotFoundDoc, 7000, "error")
                return
              }
              await this.shareService.createShare(docCheck.docId)
            }
          },
        })
        menu.addSeparator()
        if (isShared) {
          // 重新分享
          menu.addItem({
            icon: `iconTransform`,
            label: this.pluginInstance.i18n.reShare,
            click: async () => {
              if (!docCheck.flag) {
                showMessage(this.pluginInstance.i18n.msgNotFoundDoc, 7000, "error")
                return
              }
              await this.shareService.createShare(docCheck.docId)
            },
          })
          menu.addSeparator()

          // 查看文档
          menu.addItem({
            icon: `iconEye`,
            label: this.pluginInstance.i18n.viewArticle,
            click: async () => {
              if (!shareData) {
                const noShareMsg = this.pluginInstance.i18n.topbar.msgNoShare + docInfo.msg
                showMessage(noShareMsg, 7000, "error")
                return
              }
              window.open(shareData.viewUrl)
            },
          })
          menu.addSeparator()
        }

        // // 个性文档
        // menu.addItem({
        //   icon: `iconSparkles`,
        //   label: this.pluginInstance.i18n.customShare + "<span style='color:red'>new</span>",
        //   click: async () => {
        //     alert("custom share")
        //   },
        // })
        // menu.addSeparator()
      } else {
        // showMessage(this.pluginInstance.i18n.msgNotFoundDoc, 7000, "error")
      }

      // 分享管理
      menu.addItem({
        icon: `iconDock`,
        label: this.pluginInstance.i18n.manageDoc,
        click: () => {
          this.widgetInvoke.showShareManageTab(vipInfo.data)
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
      menu.open({
        x: rect.right,
        y: rect.bottom,
        isLeft: true,
      })
    }
  }
}

export { Topbar }
