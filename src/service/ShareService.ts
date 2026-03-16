/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2022-2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import { showMessage } from "siyuan"
import { Post } from "zhi-blog-api"
import { ILogger, simpleLogger } from "zhi-lib-base"
import { isDev, NULL_VALUE_FOR_SIYUAN_ATTR_REMOVE, SHARE_PRO_STORE_NAME } from "../Constants"
import { ServiceResponse, ShareApi } from "../api/share-api"
import { useDataTable } from "../composables/useDataTable"
import { useEmbedBlock } from "../composables/useEmbedBlock"
import { useFold } from "../composables/useFold"
import { getSubdocCount, getSubdocsPaged, useSiyuanApi } from "../composables/useSiyuanApi"
import ShareProPlugin from "../index"
import { ShareOptions } from "../models/ShareOptions"
import { ShareProConfig } from "../models/ShareProConfig"
import { SingleDocSetting } from "../models/SingleDocSetting"
import { updateStatusBar } from "../statusBar"
import { IShareHistoryService, ShareHistoryItem } from "../types"
import { ApiUtils } from "../utils/ApiUtils"
import { AttrUtils } from "../utils/AttrUtils"
import { ImageUtils } from "../utils/ImageUtils"
import { SettingKeys } from "../utils/SettingKeys"
import { shareHistoryCache } from "../utils/ShareHistoryCache"
import { LocalShareHistory } from "./LocalShareHistory"

/**
 * 分享服务
 *
 * @author terwer
 * @since 0.0.1
 */
class ShareService implements IShareHistoryService {
  private logger: ILogger
  private pluginInstance: ShareProPlugin
  private shareApi: ShareApi
  private localShareHistory: LocalShareHistory

  constructor(pluginInstance: ShareProPlugin) {
    this.pluginInstance = pluginInstance
    this.logger = simpleLogger("share-service", "share-pro", isDev)
    this.shareApi = new ShareApi(pluginInstance)
    this.localShareHistory = new LocalShareHistory(pluginInstance)
  }

  public async getVipInfo(token: string): Promise<ServiceResponse> {
    return await this.shareApi.getVipInfo(token)
  }

  public async getSharedDocInfo(docId: string, token?: string) {
    return await this.shareApi.getDoc(docId, token)
  }

  /**
   * 计算文档在树中的深度（保留用于其他功能，但子文档分享不再使用深度控制）
   *
   * @param path 文档路径
   * @param rootDocId 根文档ID
   * @returns 深度层级（根文档为0，直接子文档为1，以此类推）
   */
  private calculateDocumentDepth(path: string, rootDocId: string): number {
    if (!path || !rootDocId) {
      return 0
    }

    // 路径格式示例: /20230815225853-a2ybito/20240101123456-abc123/20240102123456-def456
    // 我们需要计算从根文档开始的层级数
    const pathParts = path.split("/").filter((part) => part.trim() !== "")

    // 找到根文档ID在路径中的位置
    const rootIndex = pathParts.indexOf(rootDocId)
    if (rootIndex === -1) {
      return 0
    }

    // 返回从根文档开始的层级数
    return pathParts.length - rootIndex - 1
  }

  /**
   * 扁平化获取需要分享的文档列表（包括主文档和子文档）
   *
   * @param docId 主文档ID
   * @param settings 文档设置
   * @param options 分享选项
   * @param config 插件配置
   * @returns 需要分享的文档列表
   */
  public async flattenDocumentsForSharing(
    docId: string,
    settings?: Partial<SingleDocSetting>,
    options?: Partial<ShareOptions>,
    config?: ShareProConfig
  ): Promise<
    Array<{
      docId: string
      settings: Partial<SingleDocSetting>
      options: Partial<ShareOptions>
    }>
  > {
    const documentsToShare = []

    // 添加主文档
    documentsToShare.push({
      docId: docId,
      settings: settings || {},
      options: options || {},
    })

    // 检查是否启用了子文档分享或引用文档分享
    if (!config) {
      config = await this.pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
    }

    const globalShareSubdocuments = config.appConfig?.shareSubdocuments ?? true
    const effectiveShareSubdocuments = settings?.shareSubdocuments ?? globalShareSubdocuments

    const globalShareReferences = config.appConfig?.shareReferences ?? false
    const effectiveShareReferences = settings?.shareReferences ?? globalShareReferences

    if (effectiveShareSubdocuments || effectiveShareReferences) {
      // 获取子文档列表（扁平化处理，不再使用深度控制）
      const { kernelApi } = useSiyuanApi(config)
      const subdocCount = await getSubdocCount(kernelApi, docId)

      // 应用数量限制
      // 默认限制100个，最大999个，支持无限制（-1表示无限制）
      const maxSubdocuments = settings?.maxSubdocuments ?? config.appConfig?.maxSubdocuments ?? 100
      let maxCount = maxSubdocuments

      // 处理无限制情况（-1表示无限制）
      if (maxSubdocuments === -1) {
        maxCount = subdocCount
        if (subdocCount > 999) {
          this.logger.warn(`子文档数量超过999 (${subdocCount})，可能存在性能风险`)
          // 可以在这里添加用户确认逻辑，但为了简化先记录警告
        }
      } else if (subdocCount > maxSubdocuments) {
        // 限制在配置的最大值内
        maxCount = Math.min(maxSubdocuments, 999)
        if (maxSubdocuments > 999) {
          this.logger.warn(`配置的子文档数量限制 (${maxSubdocuments}) 超过最大值999，使用999作为限制`)
          maxCount = 999
        }
      } else {
        maxCount = subdocCount
      }

      // 分页获取所有子文档（扁平化，不进行深度过滤）
      const pageSize = 50
      const totalPages = Math.ceil(maxCount / pageSize)
      const allSubdocs = []

      for (let page = 0; page < totalPages; page++) {
        const subdocs = await getSubdocsPaged(kernelApi, docId, page, pageSize)

        // 扁平化处理：只排除根文档本身，不进行深度过滤
        const filteredSubdocs = subdocs.filter((subdoc) => {
          return subdoc.docId !== docId // 排除根文档本身
        })

        allSubdocs.push(...filteredSubdocs)
        if (allSubdocs.length >= maxCount) {
          break
        }
      }

      // 添加子文档到分享列表（去重处理）
      const addedDocIds = new Set<string>()
      addedDocIds.add(docId) // 添加主文档ID

      if (effectiveShareSubdocuments) {
        for (const subdoc of allSubdocs) {
          if (!addedDocIds.has(subdoc.docId)) {
            documentsToShare.push({
              docId: subdoc.docId,
              settings: settings || {},
              options: options || {},
            })
            addedDocIds.add(subdoc.docId)
          }
        }
      }

      // 处理引用文档分享
      if (effectiveShareReferences) {
        const referencedDocs = await this.getReferencedDocuments(docId, config)
        for (const refDoc of referencedDocs) {
          if (!addedDocIds.has(refDoc.docId)) {
            documentsToShare.push({
              docId: refDoc.docId,
              settings: settings || {},
              options: options || {},
            })
            addedDocIds.add(refDoc.docId)
          }
        }
      }
    }

    return documentsToShare
  }

  /**
   * 统一分享入口（对外公开的唯一入口）
   *
   * @param docId 主文档ID
   * @param settings 文档设置
   * @param options 分享选项
   */
  public async createShare(docId: string, settings?: Partial<SingleDocSetting>, options?: Partial<ShareOptions>) {
    try {
      // 获取配置
      const config = await this.pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
      const globalShareSubdocuments = config.appConfig?.shareSubdocuments ?? true
      const effectiveShareSubdocuments = settings?.shareSubdocuments ?? globalShareSubdocuments

      debugger
      // 执行聚合逻辑
      if (!effectiveShareSubdocuments) {
        // 仅分享当前文档
        return await this.handleOne(docId, settings, options)
      } else {
        // 分享当前文档 + 子文档
        const documentsToShare = await this.flattenDocumentsForSharing(docId, settings, options, config)

        // 使用批量处理队列
        await this.batchProcessDocuments(documentsToShare)
      }
    } catch (error) {
      this.logger.error("创建分享失败", error)
      showMessage(this.pluginInstance.i18n["shareService"]["msgShareError"] + error, 7000, "error")
    }
  }

  /**
   * 获取引用的文档列表
   */
  private async getReferencedDocuments(docId: string, config: ShareProConfig): Promise<Array<{ docId: string; docTitle: string }>> {
    const referencedDocs = []
    try {
      const { kernelApi } = useSiyuanApi(config)

      // 获取文档内容
      const docContent = await kernelApi.getBlockByID(docId)
      if (!docContent || !docContent.data) {
        return referencedDocs
      }

      // 提取所有引用的文档ID
      // 在思源笔记中，引用通常以 [[docId]] 或 ((docId)) 的形式出现
      const content = JSON.stringify(docContent.data)
      const docIdRegex = /(?:\[\[|\(\()([a-f0-9-]+)(?:\]\]|\)\))/g
      const matches = content.matchAll(docIdRegex)

      const referencedDocIds = new Set<string>()
      for (const match of matches) {
        const referencedDocId = match[1]
        if (referencedDocId && referencedDocId !== docId) {
          referencedDocIds.add(referencedDocId)
        }
      }

      // 获取引用文档的详细信息
      for (const refDocId of referencedDocIds) {
        try {
          const refDocInfo = await kernelApi.getBlockByID(refDocId)
          if (refDocInfo?.data?.box && refDocInfo.data.title) {
            referencedDocs.push({
              docId: refDocId,
              docTitle: refDocInfo.data.title
            })
          }
        } catch (error) {
          this.logger.warn(`无法获取引用文档 ${refDocId} 的信息:`, error)
        }
      }
    } catch (error) {
      this.logger.error(`获取引用文档失败:`, error)
    }

    return referencedDocs
  }

  /**
   * 取消单个文档的分享（内部方法）
   *
   * @param docId 文档ID
   */
  private async cancelOne(docId: string) {
    const ret = await this.shareApi.deleteDoc(docId)
    try {
      // 重置文档选项
      await this.updateSingleDocSettings(docId, false, {})
      // 分享选项不用管，会直接删除
      // share 里面的 docAttrs、options 字段 会自动删除，所以不用管

      // 删除本地历史记录
      try {
        await this.localShareHistory.removeHistory(docId)
        shareHistoryCache.invalidate(docId)
      } catch (historyError) {
        this.logger.error(`删除分享历史记录失败: ${docId}`, historyError)
      }
    } catch (e) {
      return {
        code: -1,
        msg: e,
      }
    }
    return ret
  }

  /**
   * 统一取消分享入口（对外公开的唯一入口）
   *
   * @param docId 主文档ID
   */
  public async cancelShare(docId: string) {
    try {
      // 获取配置
      const config = await this.pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
      const globalShareSubdocuments = config.appConfig?.shareSubdocuments ?? true

      // 获取当前文档的设置
      const { kernelApi } = useSiyuanApi(config)
      const docAttrs = await kernelApi.getBlockAttrs(docId)
      const settings = AttrUtils.fromAttrs(docAttrs)

      const effectiveShareSubdocuments = settings?.shareSubdocuments ?? globalShareSubdocuments

      debugger
      if (!effectiveShareSubdocuments) {
        // 仅取消当前文档
        return await this.cancelOne(docId)
      } else {
        // 取消当前文档 + 所有子文档
        const documentsToCancel = await this.flattenDocumentsForSharing(docId, settings, undefined, config)

        // 使用批量处理取消所有文档
        const results = await this.processWithConcurrency(
          documentsToCancel,
          async (doc, index) => {
            try {
              await this.cancelOne(doc.docId)
              return { success: true, docId: doc.docId }
            } catch (error) {
              this.logger.error(`取消分享文档 ${doc.docId} 失败:`, error)
              return { success: false, docId: doc.docId, error }
            }
          },
          10 // maxConcurrency
        )

        const failed = results.filter((r) => !r?.success).length
        if (failed > 0) {
          showMessage(
            this.pluginInstance.i18n["shareService"]["msgCancelPartialSuccess"]
              .replace("[param1]", (results.length - failed).toString())
              .replace("[param2]", results.length.toString())
              .replace("[param3]", failed.toString()),
            7000,
            "error"
          )
        }

        return { code: 0, msg: "success" }
      }
    } catch (error) {
      this.logger.error("取消分享失败", error)
      showMessage(this.pluginInstance.i18n["shareService"]["msgCancelError"] + error, 7000, "error")
      return { code: -1, msg: error }
    }
  }

  public async updateSingleDocSettings(docId: string, isShare: boolean, settings: Partial<SingleDocSetting>) {
    const { kernelApi } = await ApiUtils.getSiyuanKernelApi(this.pluginInstance)
    let toAttrs: Record<string, string> = AttrUtils.toAttrs(settings)
    if (!isShare) {
      toAttrs = AttrUtils.toAttrs({})
    }
    const attrs = {
      [SettingKeys.CUSTOM_PUBLISH_TIME]: isShare ? new Date().getTime().toString() : NULL_VALUE_FOR_SIYUAN_ATTR_REMOVE,
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

  public async getHistoryByIds(docIds: string[]): Promise<Array<ShareHistoryItem> | undefined> {
    const ret = await this.shareApi.getHistoryByIds(docIds)
    if (ret.code == 0) {
      const shareHistoryItems = ret.data.map((item: any) => {
        // 数据转换
        const shareHistoryItem: ShareHistoryItem = {
          docId: item.docId,
          docTitle: item.data.title,
          shareTime: item.createAtTimestamp,
          shareStatus: item.status,
          shareUrl: item.shareUrl,
          errorMessage: "",
          docModifiedTime: item.createAtTimestamp,
        }
        return shareHistoryItem
      })
      this.logger.debug("converted shareHistoryItems", shareHistoryItems)
      return shareHistoryItems
    }
    return []
  }

  // ================
  // private function
  // ================

  /**
   * 处理单个文档的纯净分享逻辑（内部方法）
   *
   * @param docId 必传
   * @param settings 文档设置，包括文档树和目录大纲
   * @param options 分享选项，包括密码设置
   */
  private async handleOne(docId: string, settings?: Partial<SingleDocSetting>, options?: Partial<ShareOptions>) {
    try {
      // 处理文档选项，保存到文档 [属性
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

        // 分享失败时也记录历史记录
        try {
          const historyItem: ShareHistoryItem = {
            docId: docId,
            docTitle: post?.title || "未知文档",
            shareTime: Date.now(),
            shareStatus: "failed",
            errorMessage: resp.msg,
            docModifiedTime: post?.dateUpdated ? new Date(post.dateUpdated).getTime() : Date.now(),
          }

          // 保存到本地存储和缓存
          await this.localShareHistory.addHistory(historyItem)
          shareHistoryCache.set(docId, historyItem)
        } catch (historyError) {
          this.logger.error(`保存分享失败历史记录失败: ${docId}`, historyError)
        }

        return
      }

      // 存储分享历史记录
      try {
        const historyItem: ShareHistoryItem = {
          docId: post.postid,
          docTitle: post.title,
          shareTime: Date.now(),
          shareStatus: "success",
          shareUrl: resp.data?.shareUrl,
          docModifiedTime: new Date(post.dateUpdated).getTime(),
        }

        // 保存到本地存储和缓存
        await this.localShareHistory.addHistory(historyItem)
        shareHistoryCache.set(docId, historyItem)
      } catch (historyError) {
        this.logger.error(`保存分享历史记录失败: ${docId}`, historyError)
      }

      // 处理分享选项
      await this.updateShareOptions(docId, options)
      const successMsg = this.pluginInstance.i18n["shareService"]["shareSuccessWithDoc"]
        .replace("[param1]", post.title)
        .replace("[param2]", "[" + docId + "]")
      this.addLog(successMsg, "info")

      // 处理图片和DataViews媒体资源
      const data = resp.data

      // 异步处理所有媒体资源，确保按顺序执行
      void this.processAllMediaResources(docId, data.media, data.dataViewMedia)
    } catch (e) {
      // 分享失败时也记录历史记录
      try {
        // 尝试获取文档信息，即使在异常情况下
        let docTitle = "未知文档"
        let docModifiedTime = Date.now()

        try {
          const cfg = await this.pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
          const { blogApi } = useSiyuanApi(cfg)
          const post = await blogApi.getPost(docId)
          docTitle = post?.title || docTitle
          docModifiedTime = post?.dateUpdated ? new Date(post.dateUpdated).getTime() : docModifiedTime
        } catch (innerError) {
          this.logger.warn(`获取文档信息失败: ${docId}`, innerError)
        }
        const historyItem: ShareHistoryItem = {
          docId: docId,
          docTitle: docTitle,
          shareTime: Date.now(),
          shareStatus: "failed",
          errorMessage: String(e),
          docModifiedTime: docModifiedTime,
        }

        // 保存到本地存储和缓存
        await this.localShareHistory.addHistory(historyItem)
        shareHistoryCache.set(docId, historyItem)
      } catch (historyError) {
        this.logger.error(`保存分享失败历史记录失败: ${docId}`, historyError)
      }

      const exceptionMsg = this.pluginInstance.i18n["shareService"]["shareErrorWithDoc"].replace("[param1]", docId) + e
      this.addLog(exceptionMsg, "error")
      showMessage(this.pluginInstance.i18n["shareService"]["msgShareError"] + e, 7000, "error")
    }
  }

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
      showMessage(this.pluginInstance.i18n["shareService"]["msgProcessPic"], 7000, "info")
      this.addLog(this.pluginInstance.i18n["shareService"]["msgStartPicBack"], "info")
      await this.processShareMedia(docId, media)
      this.addLog(this.pluginInstance.i18n["shareService"]["msgEndPicBack"], "info")
    }

    // 再处理DataViews媒体资源
    if (dataViewMedia && dataViewMedia.length > 0) {
      showMessage(this.pluginInstance.i18n["shareService"]["msgDataViewProcessPic"], 7000, "info")
      this.addLog(this.pluginInstance.i18n["shareService"]["msgStartDataViewMediaBack"], "info")
      await this.processDataViewMedia(docId, dataViewMedia)
      this.addLog(this.pluginInstance.i18n["shareService"]["msgEndDataViewMediaBack"], "info")
    }

    // 只有在没有媒体资源的情况下显示分享成功消息
    // 如果有媒体资源，成功消息会在各自的处理方法中显示
    if ((!media || media.length === 0) && (!dataViewMedia || dataViewMedia.length === 0)) {
      showMessage(this.pluginInstance.i18n["shareService"]["msgShareSuccess"], 3000, "info")
    }
  }

  /**
   * 使用并发控制处理数组（生产级实现）
   *
   * @param items 待处理的数组
   * @param processor 异步处理函数，入参为数组项和索引，返回处理结果
   * @param maxConcurrency 最大并发数（需≥1）
   * @returns 按原数组顺序的处理结果数组
   */
  private async processWithConcurrency<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    maxConcurrency: number
  ): Promise<R[]> {
    // 边界条件校验
    if (!Array.isArray(items)) {
      throw new TypeError("items必须是数组")
    }
    if (typeof processor !== "function") {
      throw new TypeError("processor必须是函数")
    }
    const concurrency = Math.max(1, Math.floor(maxConcurrency)) // 保证并发数≥1
    if (items.length === 0) {
      return []
    }

    // 预分配结果数组，保证顺序和性能
    const results: R[] = new Array(items.length)
    const errors: Error[] = []

    // 核心并发控制：使用滑动窗口机制
    const promises: Promise<void>[] = []

    for (let i = 0; i < items.length; i++) {
      // 创建任务函数
      const task = async (index: number): Promise<void> => {
        try {
          const result = await processor(items[index], index)
          results[index] = result
        } catch (err) {
          // 捕获单个任务错误，避免影响整体流程
          errors.push(new Error(`任务${index}失败: ${(err as Error).message}`))
          // 即使出错也要设置结果，避免undefined
          results[index] = undefined as unknown as R
        }
      }

      // 控制并发：当达到上限时，等待最早启动的任务完成
      if (i >= concurrency) {
        // 等待第一个任务完成（先进先出）
        await promises.shift()
      }

      // 启动新任务
      promises.push(task(i))
    }

    // 等待所有剩余任务完成
    await Promise.all(promises)

    // 如果有错误，抛出聚合错误
    if (errors.length > 0) {
      this.logger.warn(`批量处理中出现 ${errors.length} 个错误`, errors)
      // 注意：这里不抛出异常，因为批量处理应该容忍部分失败
      // 调用方可以根据需要检查结果中的undefined值
    }

    return results
  }

  /**
   * 批量处理文档分享队列
   *
   * @param documentsToShare 需要分享的文档列表
   * @param maxConcurrency 最大并发数（默认10）
   */
  private async batchProcessDocuments(
    documentsToShare: Array<{
      docId: string
      settings: Partial<SingleDocSetting>
      options: Partial<ShareOptions>
    }>,
    maxConcurrency = 10
  ): Promise<void> {
    const total = documentsToShare.length

    // 显示开始消息
    showMessage(
      this.pluginInstance.i18n["shareService"]["msgBatchStart"].replace("[param1]", total.toString()),
      5000,
      "info"
    )

    // 使用并发控制处理所有文档，并实时更新进度
    let completedCount = 0
    const results = await this.processWithConcurrency(
      documentsToShare,
      async (doc, index) => {
        try {
          await this.handleOne(doc.docId, doc.settings, doc.options)

          // 原子性地更新完成计数并显示进度
          completedCount++
          const progress = Math.round((completedCount / total) * 100)
          const remaining = total - completedCount

          // 更新日志
          this.addLog(
            this.pluginInstance.i18n["shareService"]["msgBatchProgress"]
              .replace("[param1]", completedCount.toString())
              .replace("[param2]", total.toString())
              .replace("[param3]", progress.toString())
              .replace("[param4]", remaining.toString()),
            "info"
          )

          // 显示进度更新（每10个或最后几个）
          if (completedCount % 10 === 0 || completedCount === total) {
            showMessage(
              this.pluginInstance.i18n["shareService"]["msgBatchProgress"]
                .replace("[param1]", completedCount.toString())
                .replace("[param2]", total.toString())
                .replace("[param3]", progress.toString())
                .replace("[param4]", remaining.toString()),
              3000,
              "info"
            )
          }

          return { success: true, docId: doc.docId, index }
        } catch (error) {
          this.logger.error(`分享文档 ${doc.docId} 失败:`, error)
          return { success: false, docId: doc.docId, error, index }
        }
      },
      maxConcurrency
    )

    // 统计结果并显示进度
    const successful = results.filter((r) => r?.success).length
    const failed = results.filter((r) => !r?.success).length

    // 显示完成消息
    if (failed === 0) {
      showMessage(
        this.pluginInstance.i18n["shareService"]["msgBatchSuccess"].replace("[param1]", total.toString()),
        5000,
        "info"
      )
    } else {
      showMessage(
        this.pluginInstance.i18n["shareService"]["msgBatchPartialSuccess"]
          .replace("[param1]", successful.toString())
          .replace("[param2]", total.toString())
          .replace("[param3]", failed.toString()),
        7000,
        "error"
      )
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
