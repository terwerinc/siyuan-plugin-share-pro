/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2022-2024 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 *
 */

import { showMessage } from "siyuan"
import { Post } from "zhi-blog-api"
import { ILogger, simpleLogger } from "zhi-lib-base"
import { isDev, SHARE_PRO_STORE_NAME } from "../Constants"
import { ServiceResponse, ShareApi } from "../api/share-api"
import { useDataTable } from "../composables/useDataTable"
import { useEmbedBlock } from "../composables/useEmbedBlock"
import { useFold } from "../composables/useFold"
import { useSiyuanApi } from "../composables/useSiyuanApi"
import ShareProPlugin from "../index"
import { ShareOptions } from "../models/ShareOptions"
import { ShareProConfig } from "../models/ShareProConfig"
import { updateStatusBar } from "../statusBar"
import { ApiUtils } from "../utils/ApiUtils"
import { ImageUtils } from "../utils/ImageUtils"
import { SingleDocSetting } from "../models/SingleDocSetting"
import { SiyuanKernelApi } from "zhi-siyuan-api"
import { SettingKeys } from "../utils/SettingKeys"
import { AttrUtils } from "../utils/AttrUtils"

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

  /**
   * 创建分享
   *
   * @param docId 必传
   * @param settings 文档设置，包括文档树和目录大纲
   * @param options 分享选项，包括密码设置
   */
  public async createShare(docId: string, settings?: Partial<SingleDocSetting>, options?: Partial<ShareOptions>) {
    try {
      // 处理文档选项，保存到文档属性
      await this.updateSingleDocSettings(docId, true, settings)
      // 获取最新文档详情
      const cfg = await this.pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
      const { blogApi } = useSiyuanApi(cfg)
      const post = await blogApi.getPost(docId)
      this.addLog(this.pluginInstance.i18n["shareService"]["getPost"], "info")
      // 处理嵌入块、数据视图、折叠块（标题）
      const { getEmbedBlocks } = useEmbedBlock(cfg)
      const { getDataViews } = useDataTable(cfg)
      const { getFoldBlocks } = useFold(cfg)
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
      // 嵌入块
      sPost.embedBlocks = await getEmbedBlocks(post.editorDom, docId)
      // 数据库
      const dataViews = await getDataViews(post.editorDom)
      sPost.dataViews = dataViews
      this.addLog(this.pluginInstance.i18n["shareService"]["getDataViews"], "info")
      // 折叠块（标题）
      sPost.foldBlocks = await getFoldBlocks(post.editorDom)
      const shareBody = {
        docId: post.postid,
        // slug: post.wp_slug.trim().length == 0 ? post.postid : post.wp_slug,
        // 暂时不支持别名，后续再支持
        slug: post.postid,
        html: JSON.stringify(sPost),
        docAttrs: settings,
      }
      const resp = await this.shareApi.createShare(shareBody)
      if (resp.code !== 0) {
        const errorMsg =
          this.pluginInstance.i18n["shareService"]["shareErrorWithDoc"].replace("[param1]", docId) + resp.msg
        this.addLog(errorMsg, "error")
        showMessage(this.pluginInstance.i18n["shareService"]["msgShareError"] + resp.msg, 7000, "error")
        return
      }
      // 处理分享选项
      await this.updateShareOptions(docId, options)
      const successMsg = this.pluginInstance.i18n["shareService"]["shareSuccessWithDoc"]
        .replace("[param1]", post.title)
        .replace("[param2]", "[" + docId + "]")
      this.addLog(successMsg, "info")

      // 处理图片和DataViews媒体资源
      const data = resp.data
      
      // 处理常规媒体资源
      const media = data.media
      if (media && media.length > 0) {
        showMessage(this.pluginInstance.i18n["shareService"]["msgProcessPic"], 7000, "info")
        // 异步处理图片
        this.addLog(this.pluginInstance.i18n["shareService"]["msgStartPicBack"], "info")
        void this.processShareMedia(docId, media)
        this.addLog(this.pluginInstance.i18n["shareService"]["msgEndPicBack"], "info")
      }
      
      // 处理数据库媒体资源
      const dataViewMedia = data.dataViewMedia
      if (dataViewMedia && dataViewMedia.length > 0) {
        showMessage(this.pluginInstance.i18n["shareService"]["msgProcessPic"], 7000, "info")
        // 异步处理数据库媒体资源
        this.addLog(this.pluginInstance.i18n["shareService"]["msgStartDataViewMediaBack"], "info")
        void this.processDataViewMedia(docId, dataViewMedia)
        this.addLog(this.pluginInstance.i18n["shareService"]["msgEndDataViewMediaBack"], "info")
      }
      
      if (!media || media.length === 0) {
        showMessage(this.pluginInstance.i18n["shareService"]["msgShareSuccess"], 3000, "info")
      }
    } catch (e) {
      const exceptionMsg = this.pluginInstance.i18n["shareService"]["shareErrorWithDoc"].replace("[param1]", docId) + e
      this.addLog(exceptionMsg, "error")
      showMessage(this.pluginInstance.i18n["shareService"]["msgShareError"] + e, 7000, "error")
    }
  }

  public async getSharedDocInfo(docId: string, token?: string) {
    return await this.shareApi.getDoc(docId, token)
  }

  public async cancelShare(docId: string) {
    const ret = await this.shareApi.deleteDoc(docId)
    try {
      // 重置文档选项
      await this.updateSingleDocSettings(docId, false, {})
      // 分享选项不用管，会直接删除
      // share 里面的 docAttrs、options 字段 会自动删除，所以不用管
    } catch (e) {
      return {
        code: -1,
        msg: e,
      }
    }
    return ret
  }

  public async updateSingleDocSettings(docId: string, isShare: boolean, settings: Partial<SingleDocSetting>) {
    const { kernelApi } = await ApiUtils.getSiyuanKernelApi(this.pluginInstance)
    let toAttrs: Record<string, string> = AttrUtils.toAttrs(settings)
    if (!isShare) {
      toAttrs = AttrUtils.toAttrs({})
    }
    const attrs = {
      [SettingKeys.CUSTOM_PUBLISH_TIME]: isShare ? new Date().getTime().toString() : "",
      ...toAttrs,
    }

    this.logger.debug("updateSingleDocSettings", attrs)
    await kernelApi.setBlockAttrs(docId, attrs)
  }

  /**
   * 只更新分享选项（如密码等），不重新上传内容
   *
   * @param docId 文档ID
   * @param options 分享选项
   */
  public async updateShareOptions(docId: string, options: Partial<ShareOptions>) {
    try {
      const updateBody = {
        docId,
        options,
      }
      const resp = await this.shareApi.updateShareOptions(updateBody)
      if (resp.code !== 0) {
        const errorMsg = this.pluginInstance.i18n["shareService"]["updateOptionsError"] + resp.msg
        this.addLog(errorMsg, "error")
        // showMessage(this.pluginInstance.i18n["ui"]["updateOptionsError"] + resp.msg, 7000, "error")
        return resp
      }
      const successMsg = this.pluginInstance.i18n["shareService"]["updateOptionsSuccess"] + "：" + docId
      this.addLog(successMsg, "info")
      return resp
    } catch (e) {
      const exceptionMsg = this.pluginInstance.i18n["shareService"]["updateOptionsException"] + docId + " => " + e
      this.addLog(exceptionMsg, "error")
      // showMessage(this.pluginInstance.i18n["ui"]["updateOptionsError"] + e, 7000, "error")
      throw e
    }
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

  private async processShareMedia(docId: string, mediaList: any[]) {
    const processingMsg = this.pluginInstance.i18n["shareService"]["processingMedia"] + "：" + docId
    this.addLog(processingMsg, "info")
    const { cfg } = await ApiUtils.getSiyuanKernelApi(this.pluginInstance)

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

      const msgStartGroup = this.pluginInstance.i18n["shareService"]["msgStartGroup"]
      const msgStartGroupWithParam = msgStartGroup
        .replace("[param1]", i + 1)
        .replace("[param2]", groupedMedia.length)
        .replace("[param3]", perReq)
      this.addLog(msgStartGroupWithParam, "info")
      for (const media of mediaGroup) {
        try {
          if (media.type !== "IMAGE") {
            this.addLog(this.pluginInstance.i18n["shareService"]["nonImageResource"], "info")
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

          const msgStartCurrentPic = this.pluginInstance.i18n["shareService"]["msgStartCurrentPic"]
          const msgStartCurrentPicWithParam = msgStartCurrentPic
            .replace("[param1]", totalCount)
            .replace("[param2]", imageUrl)
          this.addLog(msgStartCurrentPicWithParam, "info")
          // const res = await kernelApi.forwardProxy(imageUrl, [], undefined, "GET", undefined, undefined, "base64")
          // 内部请求不必要走代理
          const res = await ImageUtils.fetchBase64WithContentType(imageUrl)
          this.addLog(`Image base64 response =>${res}`, "info")

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
          const mediaErrorMsg = this.pluginInstance.i18n["shareService"]["msgMediaUploadError"] + e
          this.addLog(mediaErrorMsg, "error")
          showMessage(this.pluginInstance.i18n["shareService"]["msgMediaUploadError"] + e, 7000, "error")
        }
      }
      const msgGroupProcessSuccess = this.pluginInstance.i18n["shareService"]["msgGroupProcessSuccess"]
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
      const msgProcessPicBatch = this.pluginInstance.i18n["shareService"]["msgProcessPicBatch"]
      const msgProcessPicBatchWithParam = msgProcessPicBatch.replace("[param1]", i + 1)
      this.addLog(msgProcessPicBatchWithParam, "info")
      const uploadResult = await this.shareApi.uploadMedia(reqParams)
      this.addLog(this.pluginInstance.i18n["shareService"]["msgBatchResult"] + JSON.stringify(uploadResult), "info")
      if (uploadResult.code === 0) {
        successCount += processedParams.length
        if (!hasNext) {
          showMessage(
            this.pluginInstance.i18n["shareService"]["msgYourDoc"] +
              docId +
              this.pluginInstance.i18n["shareService"]["msgSuccessUpdateMedia"],
            3000,
            "info"
          )
        }
        const msgCurrentMediaSuccess = this.pluginInstance.i18n["shareService"]["msgCurrentMediaSuccess"]
        const msgCurrentMediaSuccessWithParam = msgCurrentMediaSuccess.replace("[param1]", i + 1)
        this.addLog(msgCurrentMediaSuccessWithParam, "info")
      } else {
        errorCount += processedParams.length
        let rtnMsg = uploadResult.msg
        if (!uploadResult.msg) {
          rtnMsg = (uploadResult as any).message
        }
        const msgCurrentMediaError = this.pluginInstance.i18n["shareService"]["msgCurrentMediaError"]
        const msgCurrentMediaErrorWithParam = msgCurrentMediaError.replace("[param1]", i + 1)
        const errMsg = msgCurrentMediaErrorWithParam + rtnMsg
        this.addLog(errMsg, "error")
        showMessage(errMsg, 7000, "error")
      }
    }

    const successPic = this.pluginInstance.i18n["shareService"]["successPic"]
    const successPicWithParam = successPic
      .replace("[param1]", totalCount)
      .replace("[param2]", successCount)
      .replace("[param3]", errorCount)
    this.addLog(successPicWithParam, "info")
    if (successCount === totalCount) {
      showMessage(this.pluginInstance.i18n["shareService"]["success"], 3000, "info")
    } else {
      const errorPic = this.pluginInstance.i18n["shareService"]["errorPic"]
      const msgWithParam = errorPic.replace("[param1]", errorCount)
      showMessage(msgWithParam, 7000, "error")
    }
  }

  /**
   * 处理数据库媒体资源
   * @param docId 文档ID
   * @param mediaList 数据库媒体资源列表
   */
  private async processDataViewMedia(docId: string, mediaList: any[]) {
    const processingMsg = this.pluginInstance.i18n["shareService"]["processingDataViewMedia"] + "：" + docId
    this.addLog(processingMsg, "info")
    const { cfg } = await ApiUtils.getSiyuanKernelApi(this.pluginInstance)

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

      const msgStartGroup = this.pluginInstance.i18n["shareService"]["msgStartGroup"]
      const msgStartGroupWithParam = msgStartGroup
        .replace("[param1]", i + 1)
        .replace("[param2]", groupedMedia.length)
        .replace("[param3]", perReq)
      this.addLog(msgStartGroupWithParam, "info")
      for (const media of mediaGroup) {
        try {
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

          const msgStartCurrentPic = this.pluginInstance.i18n["shareService"]["msgStartCurrentDataViewMedia"]
          const msgStartCurrentPicWithParam = msgStartCurrentPic
            .replace("[param1]", totalCount)
            .replace("[param2]", imageUrl)
          this.addLog(msgStartCurrentPicWithParam, "info")
          
          const res = await ImageUtils.fetchBase64WithContentType(imageUrl)
          this.addLog(`DataView image base64 response =>${res}`, "info")

          if (res?.status !== 200) {
            errorCount += 1
            this.addLog(`DataView image retrieval error: ${res.msg}`, "error")
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
            source: "dataviews" // 标识资源来源为DataView
          }
          processedParams.push(params)
        } catch (e) {
          const mediaErrorMsg = this.pluginInstance.i18n["shareService"]["msgDataViewMediaUploadError"] + e
          this.addLog(mediaErrorMsg, "error")
          showMessage(this.pluginInstance.i18n["shareService"]["msgDataViewMediaUploadError"] + e, 7000, "error")
        }
      }
      const msgGroupProcessSuccess = this.pluginInstance.i18n["shareService"]["msgGroupProcessSuccess"]
      const msgGroupProcessSuccessWithParam = msgGroupProcessSuccess
        .replace("[param1]", i + 1)
        .replace("[param2]", groupedMedia.length)
        .replace("[param3]", perReq)
      this.addLog(msgGroupProcessSuccessWithParam, "info")

      const hasNext = i < groupedMedia.length - 1
      const reqParams = {
        docId: docId,
        medias: processedParams,
        hasNext: hasNext,
      }

      // 处理上传结果
      const msgProcessPicBatch = this.pluginInstance.i18n["shareService"]["msgProcessDataViewMediaBatch"]
      const msgProcessPicBatchWithParam = msgProcessPicBatch.replace("[param1]", i + 1)
      this.addLog(msgProcessPicBatchWithParam, "info")
      const uploadResult = await this.shareApi.uploadDataViewMedia(reqParams)
      this.addLog(this.pluginInstance.i18n["shareService"]["msgBatchResult"] + JSON.stringify(uploadResult), "info")
      if (uploadResult.code === 0) {
        successCount += processedParams.length
        if (!hasNext) {
          showMessage(
            this.pluginInstance.i18n["shareService"]["msgYourDoc"] +
              docId +
              this.pluginInstance.i18n["shareService"]["msgSuccessUpdateDataViewMedia"],
            3000,
            "info"
          )
        }
        const msgCurrentMediaSuccess = this.pluginInstance.i18n["shareService"]["msgCurrentDataViewMediaSuccess"]
        const msgCurrentMediaSuccessWithParam = msgCurrentMediaSuccess.replace("[param1]", i + 1)
        this.addLog(msgCurrentMediaSuccessWithParam, "info")
      } else {
        errorCount += processedParams.length
        let rtnMsg = uploadResult.msg
        if (!uploadResult.msg) {
          rtnMsg = (uploadResult as any).message
        }
        const msgCurrentMediaError = this.pluginInstance.i18n["shareService"]["msgCurrentDataViewMediaError"]
        const msgCurrentMediaErrorWithParam = msgCurrentMediaError.replace("[param1]", i + 1)
        const errMsg = msgCurrentMediaErrorWithParam + rtnMsg
        this.addLog(errMsg, "error")
        showMessage(errMsg, 7000, "error")
      }
    }

    const successPic = this.pluginInstance.i18n["shareService"]["successDataViewMedia"]
    const successPicWithParam = successPic
      .replace("[param1]", totalCount)
      .replace("[param2]", successCount)
      .replace("[param3]", errorCount)
    this.addLog(successPicWithParam, "info")
    if (successCount === totalCount) {
      showMessage(this.pluginInstance.i18n["shareService"]["success"], 3000, "info")
    } else {
      const errorPic = this.pluginInstance.i18n["shareService"]["errorDataViewMedia"]
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
