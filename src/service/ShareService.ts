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
        this.logger.error("文档" + docId + "分享失败：" + resp.msg)
        showMessage("分享失败：" + resp.msg, 7000, "error")
        return
      }
      this.logger.info("文档『" + post.title + "[" + docId + "]』分享成功")
      showMessage("分享成功", 3000, "info")

      // 处理图谱
      const data = resp.data
      const media = data.media
      if (media && media.length > 0) {
        // 异步处理图片
        this.logger.info("后台处理图片开始...")
        void this.processShareMedia(docId, media)
        this.logger.info("后台处理图片完毕.")
      }
    } catch (e) {
      this.logger.error("文档" + docId + "分享失败：" + e)
      showMessage("分享失败：" + e, 7000, "error")
    }
  }

  async getSharedDocInfo(docId: string) {
    return await this.shareApi.getDoc(docId)
  }

  async deleteDoc(docId: string) {
    return await this.shareApi.deleteDoc(docId)
  }

  // ================
  // private function
  // ================

  private async getSiyuanApi() {
    const cfg = await this.pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
    const { blogApi } = useSiyuanApi(cfg)
    return blogApi
  }

  private async getSiyuanKernelApi() {
    const cfg = await this.pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
    const { kernelApi } = useSiyuanApi(cfg)
    return {
      cfg,
      kernelApi,
    }
  }

  private async processShareMedia(docId: string, mediaList: any[]) {
    this.logger.debug(`Processing media for ${docId}`, mediaList)
    const { cfg, kernelApi } = await this.getSiyuanKernelApi()

    const perReq = 5
    const groupedMedia = []
    for (let i = 0; i < mediaList.length; i += perReq) {
      groupedMedia.push(mediaList.slice(i, i + perReq))
    }

    for (let i = 0; i < groupedMedia.length; i++) {
      const mediaGroup = groupedMedia[i]
      const processedParams = []
      try {
        for (const media of mediaGroup) {
          if (media.type !== "IMAGE") {
            this.logger.warn("Non-image resource detected, skipping.")
            continue
          }

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

          this.logger.info(`Fetching image from ${imageUrl}`)
          const res = await kernelApi.forwardProxy(imageUrl, [], undefined, "GET", undefined, undefined, "base64")
          this.logger.debug("Image base64 response =>", res)

          if (res?.status !== 200) {
            this.logger.error(`Image retrieval error: ${res.msg}`)
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
        }

        const hasNext = mediaGroup.length === perReq
        const reqParams = {
          docId: docId,
          medias: processedParams,
          hasNext: hasNext,
        }

        // 处理上传结果
        const uploadResult = await this.shareApi.uploadMedia(reqParams)
        if (uploadResult.code === 0) {
          if (!hasNext) {
            showMessage("您分享的文档「" + docId + "」已成功更新图片资源", 3000, "info")
          }
          this.logger.info(`成功上传媒体`)
        } else {
          this.logger.error(`上传媒体失败`, uploadResult.msg)
        }
      } catch (e) {
        this.logger.error("上传媒体时发生异常 =>", e)
        showMessage("上传媒体时发生异常 =>" + e, 7000, "error")
      } finally {
        this.logger.info(`第${i}组图片处理完毕.共${groupedMedia.length}组，每组${perReq}个图片`)
      }
    }
  }
}

export { ShareService }
