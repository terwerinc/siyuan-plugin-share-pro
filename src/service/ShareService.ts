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
import { IncrementalShareService } from "./IncrementalShareService"
import { ChangeDetectionResult, BulkShareResult } from "./IncrementalShareService"

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
  private incrementalShareService: IncrementalShareService

  constructor(pluginInstance: ShareProPlugin) {
    this.pluginInstance = pluginInstance
    this.logger = simpleLogger("share-service", "share-pro", isDev)
    this.shareApi = new ShareApi(pluginInstance)
    this.incrementalShareService = new IncrementalShareService(pluginInstance, this, null)
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
      this.addLog(this.pluginInstance.i18n?.shareService?.getPost || "获取文档信息", "info")
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
      this.addLog(this.pluginInstance.i18n?.shareService?.getDataViews || "获取数据库视图", "info")
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
          (this.pluginInstance.i18n?.shareService?.shareErrorWithDoc || "分享文档失败：").replace("[param1]", docId) +
          resp.msg
        this.addLog(errorMsg, "error")
        showMessage((this.pluginInstance.i18n?.shareService?.msgShareError || "分享失败：") + resp.msg, 7000, "error")
        return
      }
      // 处理分享选项
      await this.updateShareOptions(docId, options)
      const successMsg = (
        this.pluginInstance.i18n?.shareService?.shareSuccessWithDoc || "文档 [param1] ([param2]) 分享成功"
      )
        .replace("[param1]", post.title)
        .replace("[param2]", "[" + docId + "]")
      this.addLog(successMsg, "info")

      // 处理图片和DataViews媒体资源
      const data = resp.data

      // 异步处理所有媒体资源，确保按顺序执行
      void this.processAllMediaResources(docId, data.media, data.dataViewMedia)
    } catch (e) {
      const exceptionMsg =
        (this.pluginInstance.i18n?.shareService?.shareErrorWithDoc || "分享文档失败：").replace("[param1]", docId) + e
      this.addLog(exceptionMsg, "error")
      showMessage((this.pluginInstance.i18n?.shareService?.msgShareError || "分享失败：") + e, 7000, "error")
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
        const errorMsg = (this.pluginInstance.i18n?.shareService?.updateOptionsError || "更新分享选项失败：") + resp.msg
        this.addLog(errorMsg, "error")
        // showMessage(this.pluginInstance.i18n?.ui?.updateOptionsError + resp.msg, 7000, "error")
        return resp
      }
      const successMsg =
        (this.pluginInstance.i18n?.shareService?.updateOptionsSuccess || "更新分享选项成功：") + "：" + docId
      this.addLog(successMsg, "info")
      return resp
    } catch (e) {
      const exceptionMsg =
        (this.pluginInstance.i18n?.shareService?.updateOptionsException || "更新分享选项异常：") + docId + " => " + e
      this.addLog(exceptionMsg, "error")
      // showMessage(this.pluginInstance.i18n?.ui?.updateOptionsError + e, 7000, "error")
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
    const processingMsg = (this.pluginInstance.i18n?.shareService?.processingMedia || "处理媒体资源：") + "：" + docId
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

      const msgStartGroup =
        this.pluginInstance.i18n?.shareService?.msgStartGroup ||
        "开始处理第 [param1] 组，共 [param2] 组，每组 [param3] 个"
      const msgStartGroupWithParam = msgStartGroup
        .replace("[param1]", i + 1)
        .replace("[param2]", groupedMedia.length)
        .replace("[param3]", perReq)
      this.addLog(msgStartGroupWithParam, "info")
      for (const media of mediaGroup) {
        try {
          if (media.type !== "IMAGE") {
            this.addLog(this.pluginInstance.i18n?.shareService?.nonImageResource || "非图片资源", "info")
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

          const msgStartCurrentPic =
            this.pluginInstance.i18n?.shareService?.msgStartCurrentPic || "开始处理第 [param1] 张图片：[param2]"
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
          const mediaErrorMsg = (this.pluginInstance.i18n?.shareService?.msgMediaUploadError || "媒体上传失败：") + e
          this.addLog(mediaErrorMsg, "error")
          showMessage(
            (this.pluginInstance.i18n?.shareService?.msgMediaUploadError || "媒体上传失败：") + e,
            7000,
            "error"
          )
        }
      }
      const msgGroupProcessSuccess =
        this.pluginInstance.i18n?.shareService?.msgGroupProcessSuccess ||
        "第 [param1] 组处理完成，共 [param2] 组，每组 [param3] 个"
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
      const msgProcessPicBatch = this.pluginInstance.i18n?.shareService?.msgProcessPicBatch || "处理第 [param1] 组图片"
      const msgProcessPicBatchWithParam = msgProcessPicBatch.replace("[param1]", i + 1)
      this.addLog(msgProcessPicBatchWithParam, "info")
      const uploadResult = await this.shareApi.uploadMedia(reqParams)
      this.addLog(
        (this.pluginInstance.i18n?.shareService?.msgBatchResult || "批量处理结果：") + JSON.stringify(uploadResult),
        "info"
      )
      if (uploadResult.code === 0) {
        successCount += processedParams.length
        if (!hasNext) {
          showMessage(
            (this.pluginInstance.i18n?.shareService?.msgYourDoc || "您的文档") +
              docId +
              (this.pluginInstance.i18n?.shareService?.msgSuccessUpdateMedia || "媒体资源更新成功"),
            3000,
            "info"
          )
        }
        const msgCurrentMediaSuccess =
          this.pluginInstance.i18n?.shareService?.msgCurrentMediaSuccess || "第 [param1] 组图片处理成功"
        const msgCurrentMediaSuccessWithParam = msgCurrentMediaSuccess.replace("[param1]", i + 1)
        this.addLog(msgCurrentMediaSuccessWithParam, "info")
      } else {
        errorCount += processedParams.length
        let rtnMsg = uploadResult.msg
        if (!uploadResult.msg) {
          rtnMsg = (uploadResult as any).message
        }
        const msgCurrentMediaError =
          this.pluginInstance.i18n?.shareService?.msgCurrentMediaError || "第 [param1] 组图片处理失败"
        const msgCurrentMediaErrorWithParam = msgCurrentMediaError.replace("[param1]", i + 1)
        const errMsg = msgCurrentMediaErrorWithParam + rtnMsg
        this.addLog(errMsg, "error")
        showMessage(errMsg, 7000, "error")
      }
    }

    const successPic =
      this.pluginInstance.i18n?.shareService?.successPic ||
      "图片处理完成，共 [param1] 张，成功 [param2] 张，失败 [param3] 张"
    const successPicWithParam = successPic
      .replace("[param1]", totalCount)
      .replace("[param2]", successCount)
      .replace("[param3]", errorCount)
    this.addLog(successPicWithParam, "info")
    if (successCount === totalCount) {
      showMessage(this.pluginInstance.i18n?.shareService?.success || "处理成功", 3000, "info")
    } else {
      const errorPic = this.pluginInstance.i18n?.shareService?.errorPic || "图片处理失败，共 [param1] 张失败"
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
    const processingMsg = this.pluginInstance.i18n?.shareService?.processingDataViewMedia + "：" + docId
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

      const msgStartGroup =
        this.pluginInstance.i18n?.shareService?.msgStartGroup ||
        "开始处理第 [param1] 组，共 [param2] 组，每组 [param3] 个"
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

          const msgStartCurrentPic =
            this.pluginInstance.i18n?.shareService?.msgStartCurrentDataViewMedia ||
            "开始处理第 [param1] 个数据库图片：[param2]"
          const msgStartCurrentPicWithParam = msgStartCurrentPic
            .replace("[param1]", totalCount)
            .replace("[param2]", imageUrl)
          this.addLog(msgStartCurrentPicWithParam, "info")

          const res = await ImageUtils.fetchBase64WithContentType(imageUrl)
          // this.addLog(`DataView image base64 response =>${res}`, "info")

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
            source: "dataviews", // 标识资源来源为DataView
            cellId: media.cellId,
          }
          processedParams.push(params)
        } catch (e) {
          const mediaErrorMsg =
            (this.pluginInstance.i18n?.shareService?.msgDataViewMediaUploadError || "数据库媒体上传失败：") + e
          this.addLog(mediaErrorMsg, "error")
          showMessage(
            (this.pluginInstance.i18n?.shareService?.msgDataViewMediaUploadError || "数据库媒体上传失败：") + e,
            7000,
            "error"
          )
        }
      }
      const msgGroupProcessSuccess =
        this.pluginInstance.i18n?.shareService?.msgGroupProcessSuccess ||
        "第 [param1] 组处理完成，共 [param2] 组，每组 [param3] 个"
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
      const msgProcessPicBatch =
        this.pluginInstance.i18n?.shareService?.msgProcessDataViewMediaBatch || "处理第 [param1] 组数据库图片"
      const msgProcessPicBatchWithParam = msgProcessPicBatch.replace("[param1]", i + 1)
      this.addLog(msgProcessPicBatchWithParam, "info")
      const uploadResult = await this.shareApi.uploadDataViewMedia(reqParams)
      this.addLog(
        (this.pluginInstance.i18n?.shareService?.msgBatchResult || "批量处理结果：") + JSON.stringify(uploadResult),
        "info"
      )
      if (uploadResult.code === 0) {
        successCount += processedParams.length
        if (!hasNext) {
          showMessage(
            (this.pluginInstance.i18n?.shareService?.msgYourDoc || "您的文档") +
              docId +
              (this.pluginInstance.i18n?.shareService?.msgSuccessUpdateDataViewMedia || "数据库媒体资源更新成功"),
            3000,
            "info"
          )
        }
        const msgCurrentMediaSuccess =
          this.pluginInstance.i18n?.shareService?.msgCurrentDataViewMediaSuccess || "第 [param1] 组数据库图片处理成功"
        const msgCurrentMediaSuccessWithParam = msgCurrentMediaSuccess.replace("[param1]", i + 1)
        this.addLog(msgCurrentMediaSuccessWithParam, "info")
      } else {
        errorCount += processedParams.length
        let rtnMsg = uploadResult.msg
        if (!uploadResult.msg) {
          rtnMsg = (uploadResult as any).message
        }
        const msgCurrentMediaError =
          this.pluginInstance.i18n?.shareService?.msgCurrentDataViewMediaError || "第 [param1] 组数据库图片处理失败"
        const msgCurrentMediaErrorWithParam = msgCurrentMediaError.replace("[param1]", i + 1)
        const errMsg = msgCurrentMediaErrorWithParam + rtnMsg
        this.addLog(errMsg, "error")
        showMessage(errMsg, 7000, "error")
      }
    }

    const successPic =
      this.pluginInstance.i18n?.shareService?.successDataViewMedia ||
      "数据库图片处理完成，共 [param1] 张，成功 [param2] 张，失败 [param3] 张"
    const successPicWithParam = successPic
      .replace("[param1]", totalCount)
      .replace("[param2]", successCount)
      .replace("[param3]", errorCount)
    this.addLog(successPicWithParam, "info")
    if (successCount === totalCount) {
      showMessage(this.pluginInstance.i18n?.shareService?.success || "处理成功", 3000, "info")
    } else {
      const errorPic =
        this.pluginInstance.i18n?.shareService?.errorDataViewMedia || "数据库图片处理失败，共 [param1] 张失败"
      const msgWithParam = errorPic.replace("[param1]", errorCount)
      showMessage(msgWithParam, 7000, "error")
    }
  }

  /**
   * 顺序处理所有媒体资源，先处理常规媒体资源，再处理DataViews媒体资源
   * 避免并发执行导致的后端处理混乱
   */
  private async processAllMediaResources(docId: string, media: any[], dataViewMedia: any[]) {
    this.logger.debug(
      `process all media resources => docId: ${docId}, media: ${JSON.stringify(media)}, dataViewMedia: ${JSON.stringify(
        dataViewMedia
      )}`
    )

    // 先处理常规媒体资源
    if (media && media.length > 0) {
      showMessage(this.pluginInstance.i18n?.shareService?.msgProcessPic || "正在处理图片...", 7000, "info")
      await this.processShareMedia(docId, media)
    }

    // 再处理DataViews媒体资源
    if (dataViewMedia && dataViewMedia.length > 0) {
      showMessage(
        this.pluginInstance.i18n?.shareService?.msgProcessDataViewMedia || "正在处理数据库媒体资源...",
        7000,
        "info"
      )
      await this.processDataViewMedia(docId, dataViewMedia)
    }
  }

  /**
   * 检测文档变更
   *
   * @param allDocuments 所有待检测的文档
   * @param config 插件配置
   * @returns 变更检测结果
   */
  public async detectChangedDocuments(
    allDocuments: Array<{ docId: string; docTitle: string; modifiedTime: number }>,
    config: ShareProConfig
  ): Promise<ChangeDetectionResult> {
    return await this.incrementalShareService.detectChangedDocuments(allDocuments, config)
  }

  /**
   * 批量分享文档
   *
   * @param documents 要分享的文档列表
   * @param config 插件配置
   * @returns 批量分享结果
   */
  public async bulkShareDocuments(
    documents: Array<{ docId: string; docTitle: string }>,
    config: ShareProConfig
  ): Promise<BulkShareResult> {
    return await this.incrementalShareService.bulkShareDocuments(documents, config)
  }

  /**
   * 获取增量分享统计信息
   *
   * @returns 增量分享统计信息
   */
  public async getIncrementalShareStats(): Promise<{
    totalShared: number
    lastShareTime: number
    newDocumentsCount: number
    updatedDocumentsCount: number
  }> {
    return await this.incrementalShareService.getIncrementalShareStats()
  }

  /**
   * 设置分享历史管理器
   *
   * @param shareHistory 分享历史管理器
   */
  public setShareHistory(shareHistory: any): void {
    this.incrementalShareService.setShareHistory(shareHistory)
  }

  /**
   * 设置黑名单管理器
   *
   * @param shareBlacklist 黑名单管理器
   */
  public setShareBlacklist(shareBlacklist: any): void {
    this.incrementalShareService.setShareBlacklist(shareBlacklist)
  }

  /**
   * 批量分享文档
   *
   * 📝 TODO: 真实 API 调用说明
   * ========================================
   * 1. 分页分批次循环调用 createShare()
   * 2. 每批次处理 5 个文档（避免并发过高）
   * 3. 每个文档间隔 500ms（避免频率限制）
   * 4. 自动获取文档信息，外部只传 docIds
   *
   * @param docIds 文档 ID 数组
   * @returns 批量分享结果
   */
  public async bulkCreateShare(docIds: string[]): Promise<{
    successCount: number
    failedCount: number
    results: Array<{
      docId: string
      success: boolean
      shareUrl?: string
      errorMessage?: string
    }>
  }> {
    const BATCH_SIZE = 5 // 每批次处理 5 个
    const DELAY_MS = 500 // 每个文档间隔 500ms

    const result = {
      successCount: 0,
      failedCount: 0,
      results: [] as Array<{
        docId: string
        success: boolean
        shareUrl?: string
        errorMessage?: string
      }>,
    }

    // 🔧 Mock 实现：模拟批量分享
    // TODO: 替换为真实 API 调用
    this.logger.info(`开始批量分享 ${docIds.length} 个文档`)

    // 分批处理
    for (let i = 0; i < docIds.length; i += BATCH_SIZE) {
      const batchDocIds = docIds.slice(i, i + BATCH_SIZE)
      const batchNum = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(docIds.length / BATCH_SIZE)

      this.logger.info(`处理第 ${batchNum}/${totalBatches} 批，共 ${batchDocIds.length} 个文档`)

      for (const docId of batchDocIds) {
        try {
          // 🔧 Mock: 模拟网络延迟
          await new Promise((resolve) => setTimeout(resolve, DELAY_MS))

          // TODO: 替换为真实调用
          // await this.createShare(docId)
          // 注意：createShare 内部会自动获取文档信息

          const mockShareUrl = `https://siyuan.wiki/s/${docId}`

          result.successCount++
          result.results.push({
            docId,
            success: true,
            shareUrl: mockShareUrl,
          })

          this.logger.info(`文档 ${docId} 分享成功: ${mockShareUrl}`)
        } catch (error) {
          result.failedCount++
          const errorMessage = error instanceof Error ? error.message : "未知错误"
          result.results.push({
            docId,
            success: false,
            errorMessage,
          })

          this.logger.error(`文档 ${docId} 分享失败:`, error)
        }
      }

      // 批次间隔（最后一批不需要）
      if (i + BATCH_SIZE < docIds.length) {
        this.logger.info(`等待 ${DELAY_MS}ms 后处理下一批...`)
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS))
      }
    }

    this.logger.info(`批量分享完成: 成功 ${result.successCount}, 失败 ${result.failedCount}`)

    return result
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
