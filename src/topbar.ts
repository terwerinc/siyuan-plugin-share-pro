/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2024 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import { confirm, Dialog, Menu, showMessage } from "siyuan"
import { ILogger, simpleLogger } from "zhi-lib-base"
import pkg from "../package.json"
import { isDev, SHARE_PRO_STORE_NAME } from "./Constants"
import ShareProPlugin from "./index"
import { WidgetInvoke } from "./invoke/widgetInvoke"
import ShareSetting from "./libs/pages/ShareSetting.svelte"
import IncrementalShareUI from "./libs/pages/IncrementalShareUI.svelte"
import { ShareProConfig } from "./models/ShareProConfig"
import { NewUI } from "./newUI"
import { ShareService } from "./service/ShareService"
import PageUtil from "./utils/pageUtil"
import { icons } from "./utils/svg"

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
      title: this.pluginInstance.i18n?.sharePro || "Share Pro",
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
      const settingConfig = await this.pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
      if (settingConfig.isNewUIEnabled) {
        await newUI.startShareForNewUI()
      } else {
        // 初始化菜单
        try {
          await this.addMenu(topBarElement.getBoundingClientRect())
        } catch (e) {
          const errMsg = this.pluginInstance.i18n?.topbar?.shareSuccessError + e || "Share error: " + e
          showMessage(errMsg, 7000, "error")
        }
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
      const settingConfig = await this.pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
      if (settingConfig.isNewUIEnabled) {
        await newUI.settingForNewUI()
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
            alert(this.pluginInstance.i18n?.topbar?.msgIngError || "分享正在进行中，请稍后再试")
          }
        }
        menu.addItem({
          icon: isShared ? `iconCloseRound` : `iconRiffCard`,
          label: isShared ? this.pluginInstance.i18n?.cancelShare || "取消分享" : this.pluginInstance.i18n?.startShare || "开始分享",
          click: async () => {
            if (isShared) {
              confirm(this.pluginInstance.i18n?.tipTitle || "提示", this.pluginInstance.i18n?.confirmDelete || "确定要删除吗？", async () => {
                if (!docCheck.flag) {
                  showMessage(this.pluginInstance.i18n?.msgNotFoundDoc || "未找到文档", 7000, "error")
                  return
                }
                const ret = await this.shareService.cancelShare(docCheck.docId)
                if (ret.code === 0) {
                  showMessage(this.pluginInstance.i18n?.topbar?.cancelSuccess || "取消分享成功", 3000, "info")
                } else {
                  showMessage(this.pluginInstance.i18n?.topbar?.cancelError + ret.msg || "取消分享失败" + ret.msg, 7000, "error")
                }
              })
            } else {
              if (!docCheck.flag) {
                showMessage(this.pluginInstance.i18n?.msgNotFoundDoc || "未找到文档", 7000, "error")
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
            label: this.pluginInstance.i18n?.reShare || "重新分享",
            click: async () => {
              if (!docCheck.flag) {
                showMessage(this.pluginInstance.i18n?.msgNotFoundDoc || "未找到文档", 7000, "error")
                return
              }
              await this.shareService.createShare(docCheck.docId)
            },
          })
          
          // 增量分享
          menu.addItem({
            iconHTML: icons.iconRefresh,
            label: this.pluginInstance.i18n?.incrementalShare?.title || "增量分享",
            click: async () => {
              this.showIncrementalShareUI()
            },
          })
          
          menu.addSeparator()

          // 查看文档
          menu.addItem({
            icon: `iconEye`,
            label: this.pluginInstance.i18n?.viewArticle || "查看文档",
            click: async () => {
              if (!shareData) {
                const noShareMsg = this.pluginInstance.i18n?.topbar?.msgNoShare + docInfo.msg || "文档未分享" + docInfo.msg
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
        label: this.pluginInstance.i18n?.manageDoc || "分享管理",
        click: () => {
          this.widgetInvoke.showShareManageTab(vipInfo.data)
        },
      })
      menu.addSeparator()
    } else {
      menu.addItem({
        icon: `iconKey`,
        label: this.pluginInstance.i18n?.getLicense || "获取授权",
        click: () => {
          const vipTip = vipInfo.msg ?? (this.pluginInstance.i18n?.unknownError || "未知错误")
          confirm(
            this.pluginInstance.i18n?.tipTitle || "提示",
            vipTip + "，" + this.pluginInstance.i18n?.openLicensePage || "请前往授权页面",
            () => {
              window.open("https://store.terwer.space/products/share-pro")
            }
          )
        },
      })
      menu.addSeparator()
    }

    menu.addItem({
      icon: `iconSettings`,
      label: this.pluginInstance.i18n?.shareSetting || "分享设置",
      click: () => {
        const settingId = "share-pro-setting"
        const d = new Dialog({
          title: `${this.pluginInstance.i18n?.shareSetting || "分享设置"} - ${this.pluginInstance.i18n?.sharePro || "Share Pro"} v${pkg.version}`,
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

  /**
   * 显示增量分享UI
   */
  public async showIncrementalShareUI() {
    const cfg = await this.pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
    const vipInfo = await this.shareService.getVipInfo(cfg?.serviceApiConfig?.token ?? "")
    
    if (vipInfo.code !== 0) {
      const vipTip = vipInfo.msg ?? (this.pluginInstance.i18n?.unknownError || "未知错误")
      confirm(
        this.pluginInstance.i18n?.tipTitle || "提示",
        vipTip + "，" + this.pluginInstance.i18n?.openLicensePage || "请前往授权页面",
        () => {
          window.open("https://store.terwer.space/products/share-pro")
        }
      )
      return
    }

    const dialog = new Dialog({
      title: `${this.pluginInstance.i18n?.incrementalShare?.title || 'Incremental Share'} - ${this.pluginInstance.i18n?.sharePro || 'Share Pro'} v${pkg.version}`,
      content: `<div id="incremental-share-ui"></div>`,
      width: this.pluginInstance.isMobile ? "95vw" : "80vw",
      height: this.pluginInstance.isMobile ? "90vh" : "80vh",
    })

    new IncrementalShareUI({
      target: document.getElementById("incremental-share-ui") as HTMLElement,
      props: {
        pluginInstance: this.pluginInstance,
        dialog: dialog,
        vipInfo: vipInfo,
      },
    })
  }
}

export { Topbar }
