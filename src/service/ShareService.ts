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
      const blogApi = await this.getSiyuanApi()
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

  private async getSiyuanApi() {
    const cfg = await this.pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
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

      this.addLog(`开始处理第${i + 1}组图片.共${groupedMedia.length}组，每组${perReq}个图片`, "info")
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

          this.addLog(`开始处理第${totalCount}张图片： ${imageUrl} ，请稍候...`, "info")
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
          this.logger.error("上传媒体时发生异常 =>", e)
          showMessage("上传媒体时发生异常 =>" + e, 7000, "error")
        }
      }
      this.addLog(`第${i + 1}组图片处理完毕.共${groupedMedia.length}组，每组${perReq}个图片`, "info")

      const hasNext = mediaGroup.length === perReq
      const reqParams = {
        docId: docId,
        medias: processedParams,
        hasNext: hasNext,
      }

      // 处理上传结果
      this.addLog(`准备批量上传第${i + 1}组图片，请稍候...`, "info")
      let uploadResult = await this.shareApi.uploadMedia(reqParams)
      this.addLog("图片批量处理结果=>" + JSON.stringify(uploadResult), "info")
      if (uploadResult.code === 0) {
        successCount += processedParams.length
        if (!hasNext) {
          showMessage("您分享的文档「" + docId + "」已成功更新图片资源", 3000, "info")
        }
        this.addLog(`第${i + 1}组已成功上传媒体`, "info")
      } else {
        errorCount += processedParams.length
        let rtnMsg = uploadResult.msg
        if (!uploadResult.msg) {
          rtnMsg = (uploadResult as any).message
        }
        const errMsg = `第${i + 1}组媒体上传失败=>` + rtnMsg
        this.addLog(errMsg, "error")
        showMessage(errMsg, 7000, "error")
      }
    }
    this.addLog(`图片全部处理完毕，总数(${totalCount})，成功（${successCount}），失败（${errorCount}）`, "info")
    if (successCount === totalCount) {
      showMessage("恭喜你，图片全部处理成功", 3000, "info")
    } else {
      showMessage(`${errorCount}张图片处理失败，请查看日志`, 7000, "error")
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
