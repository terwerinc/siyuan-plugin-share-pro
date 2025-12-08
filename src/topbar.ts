/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2024-2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import { confirm, Dialog, Menu, showMessage } from "siyuan"
import { ILogger, simpleLogger } from "zhi-lib-base"
import pkg from "../package.json"
import { isDev, SHARE_PRO_STORE_NAME } from "./Constants"
import ShareProPlugin from "./index"
import { WidgetInvoke } from "./invoke/widgetInvoke"
import { ShareProConfig } from "./models/ShareProConfig"
import { NewUI } from "./newUI"
import { ShareService } from "./service/ShareService"
import PageUtil from "./utils/pageUtil"
import { icons } from "./utils/svg"
import IncrementalShareUI from "./libs/pages/IncrementalShareUI.svelte"

/**
 * 顶部按钮
 */
class Topbar {
  private logger: ILogger
  private pluginInstance: ShareProPlugin
  private shareService: ShareService
  private widgetInvoke: WidgetInvoke
  private lock = false
  private contextLock = false

  constructor(pluginInstance: ShareProPlugin) {
    this.logger = simpleLogger("topbar", "share-pro", isDev)
    this.pluginInstance = pluginInstance
    this.shareService = new ShareService(pluginInstance)
    this.widgetInvoke = new WidgetInvoke(pluginInstance)
  }

  public initTopbar() {
    const topBarElement = this.pluginInstance.addTopBar({
      icon: icons.iconShare,
      title: this.pluginInstance.i18n?.sharePro,
      position: "right",
      callback: () => {},
    })

    const newUI = new NewUI(this.pluginInstance, topBarElement)

    topBarElement.addEventListener("click", async () => {
      if (this.lock) {
        this.logger.warn("request is not finished, please wait...")
        return
      }

      this.lock = true
      try {
        const settingConfig = await this.pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
        if (settingConfig.isNewUIEnabled === false) {
          // 明确禁止新UI才使用菜单模式，历史原因
          await this.addMenu(topBarElement.getBoundingClientRect())
        } else {
          // 主推新UI
          await newUI.startShareForNewUI()
        }
      } catch (e) {
        const errMsg = this.pluginInstance.i18n?.topbar?.shareSuccessError + e
        showMessage(errMsg, 7000, "error")
      } finally {
        // 无论是不是不都应该释放，否则失败一次之后将永远无法点击
        this.lock = false
      }

      this.lock = false
    })

    // 添加右键菜单
    topBarElement.addEventListener("contextmenu", async () => {
      if (this.contextLock) {
        this.logger.warn("request is not finished, please wait...")
        return
      }

      this.contextLock = true
      try {
        const settingConfig = await this.pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
        if (settingConfig.isNewUIEnabled) {
          await newUI.settingForNewUI()
        }
      } catch (e) {
        this.logger.error("settingForNewUI error", e)
      } finally {
        this.contextLock = false
      }
      this.contextLock = false
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
        const docInfo = await this.shareService.getSharedDocInfo(docCheck.docId, cfg?.serviceApiConfig?.token ?? "")
        const isShared = docInfo.code === 0
        const shareData = docInfo?.data ? JSON.parse(docInfo.data) : null
        if (shareData) {
          this.logger.info("get shared data =>", shareData)
          if (shareData.shareStatus !== "COMPLETED") {
            alert(this.pluginInstance.i18n?.topbar?.msgIngError)
          }
        }
        menu.addItem({
          icon: isShared ? `iconCloseRound` : `iconRiffCard`,
          label: isShared ? this.pluginInstance.i18n?.cancelShare : this.pluginInstance.i18n?.startShare,
          click: async () => {
            if (isShared) {
              confirm(this.pluginInstance.i18n?.tipTitle, this.pluginInstance.i18n?.confirmDelete, async () => {
                if (!docCheck.flag) {
                  showMessage(this.pluginInstance.i18n?.msgNotFoundDoc, 7000, "error")
                  return
                }
                const ret = await this.shareService.cancelShare(docCheck.docId)
                if (ret.code === 0) {
                  showMessage(this.pluginInstance.i18n?.topbar?.cancelSuccess, 3000, "info")
                } else {
                  showMessage(this.pluginInstance.i18n?.topbar?.cancelError + ret.msg + ret.msg, 7000, "error")
                }
              })
            } else {
              if (!docCheck.flag) {
                showMessage(this.pluginInstance.i18n?.msgNotFoundDoc, 7000, "error")
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
            label: this.pluginInstance.i18n?.reShare,
            click: async () => {
              if (!docCheck.flag) {
                showMessage(this.pluginInstance.i18n?.msgNotFoundDoc, 7000, "error")
                return
              }
              await this.shareService.createShare(docCheck.docId)
            },
          })

          menu.addSeparator()

          // 查看文档
          menu.addItem({
            icon: `iconEye`,
            label: this.pluginInstance.i18n?.viewArticle,
            click: async () => {
              if (!shareData) {
                const noShareMsg = this.pluginInstance.i18n?.topbar?.msgNoShare + docInfo.msg + docInfo.msg
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

      // 增量分享
      const appConfig = cfg?.appConfig
      // 修复：即使没有配置也应默认启用增量分享功能
      const isIncrementalShareEnabled = appConfig?.incrementalShareConfig?.enabled ?? true
      if (isIncrementalShareEnabled) {
        menu.addItem({
          icon: `iconAdd`,
          label: this.pluginInstance.i18n?.incrementalShare?.title,
          click: async () => {
            await this.showIncrementalShareUI()
          },
        })

        menu.addSeparator()
      }

      // 分享管理
      menu.addItem({
        icon: `iconDock`,
        label: this.pluginInstance.i18n?.manageDoc,
        click: () => {
          this.widgetInvoke.showShareManageTab(vipInfo.data)
        },
      })
      menu.addSeparator()
    } else {
      menu.addItem({
        icon: `iconKey`,
        label: this.pluginInstance.i18n?.getLicense,
        click: () => {
          const vipTip = vipInfo.msg ?? this.pluginInstance.i18n?.unknownError
          confirm(this.pluginInstance.i18n?.tipTitle, vipTip + "，" + this.pluginInstance.i18n?.openLicensePage, () => {
            window.open("https://store.terwer.space/products/share-pro")
          })
        },
      })
      menu.addSeparator()
    }

    menu.addItem({
      icon: `iconSettings`,
      label: this.pluginInstance.i18n?.shareSetting,
      click: () => {
        this.pluginInstance.openSetting()
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

  /**
   * 显示增量分享UI
   */
  public async showIncrementalShareUI() {
    const cfg = await this.pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
    const vipInfo = await this.shareService.getVipInfo(cfg?.serviceApiConfig?.token ?? "")

    if (vipInfo.code !== 0) {
      const vipTip = vipInfo.msg ?? this.pluginInstance.i18n?.unknownError
      confirm(this.pluginInstance.i18n?.tipTitle, vipTip + "，" + this.pluginInstance.i18n?.openLicensePage, () => {
        window.open("https://store.terwer.space/products/share-pro")
      })
      return
    }

    const incrementalShareId = "incremental-share-ui"
    // const d = new Dialog({
    new Dialog({
      title: `${this.pluginInstance.i18n?.incrementalShare?.title} - ${this.pluginInstance.i18n?.sharePro} v${pkg.version}`,
      content: `<div id="${incrementalShareId}"></div>`,
      width: this.pluginInstance.isMobile ? "95vw" : "80vw",
      height: this.pluginInstance.isMobile ? "90vh" : "80vh",
    })

    new IncrementalShareUI({
      target: document.getElementById(incrementalShareId) as HTMLElement,
      props: {
        pluginInstance: this.pluginInstance,
        // dialog: d
        config: cfg,
      },
    })
  }
}

export { Topbar }
