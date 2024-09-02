/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2022-2024 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 *
 */

import { ILogger, simpleLogger } from "zhi-lib-base"
import ShareProPlugin from "../index"
import { isDev, SHARE_PRO_STORE_NAME } from "../Constants"
import { ServiceResponse, ShareApi } from "../api/share-api"
import { useSiyuanApi } from "../composables/useSiyuanApi"
import { ShareProConfig } from "../models/ShareProConfig"
import { showMessage } from "siyuan"

/**
 * 分享服务
 *
 * @author terwer
 * @since 0.0.1
 */
class ShareService {
  private logger: ILogger
  private pluginInstance: ShareProPlugin
  private shareApi: ShareApi

  constructor(pluginInstance: ShareProPlugin) {
    this.pluginInstance = pluginInstance
    this.logger = simpleLogger("share-service", "share-pro", isDev)
    this.shareApi = new ShareApi(pluginInstance)
  }

  public async getVipInfo(token: string): Promise<ServiceResponse> {
    return await this.shareApi.getVipInfo(token)
  }

  public async createShare(docId: string) {
    try {
      const blogApi = await this.getSiyuanApi()
      const post = await blogApi.getPost(docId)
      this.logger.debug("get post", post)
      const shareBody = {
        docId: post.postid,
        html: {
          attrs: post.attrs,
          title: post.title,
          editorDom: post.editorDom,
          date: new Date(),
          tags: post.mt_keywords,
          categories: post.categories,
          shortDesc: post.shortDesc,
        },
      }
      const resp = await this.shareApi.createShare(JSON.stringify(shareBody))
      if (resp.code !== 0) {
        this.logger.error("文档" + docId + "分享失败：" + resp.msg)
        showMessage("分享失败：" + resp.msg, 7000, "error")
        return
      }
      this.logger.info("文档『" + post.title + "[" + docId + "]』分享成功")
      showMessage("分享成功", 3000, "info")
    } catch (e) {
      this.logger.error("文档" + docId + "分享失败：" + e)
      showMessage("分享失败：" + e, 7000, "error")
    }
  }

  async getSharedDocInfo(docId: string) {
    return await this.shareApi.getDoc(docId)
  }

  // ================
  // private function
  // ================

  private async getSiyuanApi() {
    const cfg = await this.pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
    const { blogApi } = useSiyuanApi(cfg)
    return blogApi
  }
}

export { ShareService }
