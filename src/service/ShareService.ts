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
import { Post } from "zhi-blog-api"
import { updateStatusBar } from "../statusBar"
import { ApiUtils } from "../utils/ApiUtils"
import { ImageUtils } from "../utils/ImageUtils"

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
      const cfg = await this.pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
      // 上面是通用配置
      // 查询配置的单片文档的配置
      // 在这里可以重写单篇文档
      const blogApi = await this.getSiyuanApi(cfg)
      const post = await blogApi.getPost(docId)
      this.logger.debug("get post", post)
      const sPost = new Post()
      sPost.attrs = post.attrs
      sPost.title = post.title
      sPost.editorDom = post.editorDom
      sPost.dateUpdated = new Date()
      sPost.mt_keywords = post.mt_keywords
      sPost.categories = post.categories
      sPost.shortDesc = post.shortDesc
      // 文档树
      sPost.docTree = post.docTree
      sPost.docTreeLevel = post.docTreeLevel
      // 目录大纲
      sPost.outline = post.outline
      sPost.outlineLevel = post.outlineLevel
      const shareBody = {
        docId: post.postid,
        // slug: post.wp_slug.trim().length == 0 ? post.postid : post.wp_slug,
        // 暂时不支持别名，后续再支持
        slug: post.postid,
        html: JSON.stringify(sPost),
      }
      const resp = await this.shareApi.createShare(shareBody)
      if (resp.code !== 0) {
        this.logger.error(
          this.pluginInstance.i18n.shareService.msgDoc +
            docId +
            this.pluginInstance.i18n.shareService.msgShareError +
            resp.msg
        )
        showMessage(this.pluginInstance.i18n.shareService.msgShareError + resp.msg, 7000, "error")
        return
      }
      this.logger.info(
        this.pluginInstance.i18n.shareService.msgDoc +
          post.title +
          "[" +
          docId +
          "]" +
          this.pluginInstance.i18n.shareService.msgShareSuccess
      )

      // 处理图片
      const data = resp.data
      const media = data.media
      if (media && media.length > 0) {
        showMessage(this.pluginInstance.i18n.shareService.msgProcessPic, 7000, "info")
        // 异步处理图片
        this.addLog(this.pluginInstance.i18n.shareService.msgStartPicBack, "info")
        void this.processShareMedia(docId, media)
        this.addLog(this.pluginInstance.i18n.shareService.msgEndPicBack, "info")
      } else {
        showMessage(this.pluginInstance.i18n.shareService.msgShareSuccess, 3000, "info")
      }
    } catch (e) {
      this.logger.error(
        this.pluginInstance.i18n.shareService.msgDoc + docId + this.pluginInstance.i18n.shareService.msgShareError + e
      )
      showMessage(this.pluginInstance.i18n.shareService.msgShareError + e, 7000, "error")
    }
  }

  public async getSharedDocInfo(docId: string) {
    return await this.shareApi.getDoc(docId)
  }

  public async deleteDoc(docId: string) {
    return await this.shareApi.deleteDoc(docId)
  }

  public async listDoc(pageNum: number, pageSize: number, order: string, direction: string, search: string) {
    const params = {
      pageNum: pageNum,
      pageSize: pageSize,
      order: order,
      direction: direction,
      search: search,
    }
    return await this.shareApi.listDoc(params)
  }

  // ================
  // private function
  // ================

  private async getSiyuanApi(cfg: ShareProConfig) {
    const { blogApi } = useSiyuanApi(cfg)
    return blogApi
  }

  private async processShareMedia(docId: string, mediaList: any[]) {
    this.logger.debug(`Processing media for ${docId}`, mediaList)
    const { cfg, kernelApi } = await ApiUtils.getSiyuanKernelApi(this.pluginInstance)

    const perReq = 5
    const groupedMedia = []
    for (let i = 0; i < mediaList.length; i += perReq) {
      groupedMedia.push(mediaList.slice(i, i + perReq))
    }

    let errorCount = 0
    let successCount = 0
    let totalCount = 0
    for (let i = 0; i < groupedMedia.length; i++) {
      const mediaGroup = groupedMedia[i]
      const processedParams = []

      const msgStartGroup = this.pluginInstance.i18n.shareService.msgStartGroup
      const msgStartGroupWithParam = msgStartGroup
        .replace("[param1]", i + 1)
        .replace("[param2]", groupedMedia.length)
        .replace("[param3]", perReq)
      this.addLog(msgStartGroupWithParam, "info")
      for (const media of mediaGroup) {
        try {
          if (media.type !== "IMAGE") {
            this.logger.warn("Non-image resource detected, skipping.")
            continue
          }
          totalCount += 1

          const originalUrl = media.originalUrl ?? ""
          let imageUrl = originalUrl
          const alt = media.alt
          const title = media.title

          if (!imageUrl.startsWith("http")) {
            if (cfg.serviceApiConfig.apiUrl.endsWith("/")) {
              imageUrl = cfg.siyuanConfig.apiUrl + imageUrl
            } else {
              imageUrl = cfg.siyuanConfig.apiUrl + "/" + imageUrl
            }
          }

          const msgStartCurrentPic = this.pluginInstance.i18n.shareService.msgStartCurrentPic
          const msgStartCurrentPicWithParam = msgStartCurrentPic
            .replace("[param1]", totalCount)
            .replace("[param2]", imageUrl)
          this.addLog(msgStartCurrentPicWithParam, "info")
          // const res = await kernelApi.forwardProxy(imageUrl, [], undefined, "GET", undefined, undefined, "base64")
          // 内部请求不必要走代理
          const res = await ImageUtils.fetchBase64WithContentType(imageUrl)
          this.logger.debug("Image base64 response =>", res)

          if (res?.status !== 200) {
            errorCount += 1
            this.addLog(`Image retrieval error: ${res.msg}`, "error")
            continue
          }

          const base64 = res.body
          const type = res.contentType
          const params = {
            file: base64,
            originalUrl: originalUrl,
            alt: alt,
            title: title,
            type: type,
          }
          processedParams.push(params)
        } catch (e) {
          this.logger.error(this.pluginInstance.i18n.shareService.msgMediaUploadError, e)
          showMessage(this.pluginInstance.i18n.shareService.msgMediaUploadError + e, 7000, "error")
        }
      }
      const msgGroupProcessSuccess = this.pluginInstance.i18n.shareService.msgGroupProcessSuccess
      const msgGroupProcessSuccessWithParam = msgGroupProcessSuccess
        .replace("[param1]", i + 1)
        .replace("[param2]", groupedMedia.length)
        .replace("[param3]", perReq)
      this.addLog(msgGroupProcessSuccessWithParam, "info")

      // const hasNext = mediaGroup.length === perReq
      // 修正 hasNext 的判断逻辑
      const hasNext = i < groupedMedia.length - 1
      const reqParams = {
        docId: docId,
        medias: processedParams,
        hasNext: hasNext,
      }

      // 处理上传结果
      const msgProcessPicBatch = this.pluginInstance.i18n.shareService.msgProcessPicBatch
      const msgProcessPicBatchWithParam = msgProcessPicBatch.replace("[param1]", i + 1)
      this.addLog(msgProcessPicBatchWithParam, "info")
      let uploadResult = await this.shareApi.uploadMedia(reqParams)
      this.addLog(this.pluginInstance.i18n.shareService.msgBatchResult + JSON.stringify(uploadResult), "info")
      if (uploadResult.code === 0) {
        successCount += processedParams.length
        if (!hasNext) {
          showMessage(
            this.pluginInstance.i18n.shareService.msgYourDoc +
              docId +
              this.pluginInstance.i18n.shareService.msgSuccessUpdateMedia,
            3000,
            "info"
          )
        }
        const msgCurrentMediaSuccess = this.pluginInstance.i18n.shareService.msgCurrentMediaSuccess
        const msgCurrentMediaSuccessWithParam = msgCurrentMediaSuccess.replace("[param1]", i + 1)
        this.addLog(msgCurrentMediaSuccessWithParam, "info")
      } else {
        errorCount += processedParams.length
        let rtnMsg = uploadResult.msg
        if (!uploadResult.msg) {
          rtnMsg = (uploadResult as any).message
        }
        const msgCurrentMediaError = this.pluginInstance.i18n.shareService.msgCurrentMediaError
        const msgCurrentMediaErrorWithParam = msgCurrentMediaError.replace("[param1]", i + 1)
        const errMsg = msgCurrentMediaErrorWithParam + rtnMsg
        this.addLog(errMsg, "error")
        showMessage(errMsg, 7000, "error")
      }
    }

    const successPic = this.pluginInstance.i18n.shareService.successPic
    const successPicWithParam = successPic
      .replace("[param1]", totalCount)
      .replace("[param2]", successCount)
      .replace("[param3]", errorCount)
    this.addLog(successPicWithParam, "info")
    if (successCount === totalCount) {
      showMessage(this.pluginInstance.i18n.shareService.success, 3000, "info")
    } else {
      const errorPic = this.pluginInstance.i18n.shareService.errorPic
      const msgWithParam = errorPic.replace("[param1]", errorCount)
      showMessage(msgWithParam, 7000, "error")
    }
  }

  private addLog(msg: string, type: "info" | "error") {
    updateStatusBar(this.pluginInstance, msg)
    if (type === "info") {
      this.logger.info(msg)
    } else {
      this.logger.error(msg)
    }
  }
}

export { ShareService }
