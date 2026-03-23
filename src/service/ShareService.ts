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
import {
  DEFAULT_SHARE_REFERENCES_MAX_DEPTH,
  isDev,
  NULL_VALUE_FOR_SIYUAN_ATTR_REMOVE,
  SHARE_PRO_STORE_NAME,
} from "../Constants"
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
import { ProgressManager } from "../utils/progress/ProgressManager"
import { RESOURCE_EVENTS, resourceEventEmitter } from "../utils/progress/ResourceEventEmitter"
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

    // 监听资源错误事件，用于单文档场景
    resourceEventEmitter.on(RESOURCE_EVENTS.ERROR, (event: { docId: string; error: any }) => {
      this.handleResourceErrorForSingleDoc(event.docId, event.error)
    })
  }

  // ================
  // public methods (主干方法 - 核心对外接口)
  // ================

  /**
   * 统一分享入口（核心入口）
   *
   * 处理逻辑：
   * 1. 检查子文档分享开关和引用文档分享开关
   * 2. 如果两个开关都关闭，直接调用 handleOne 处理单一文档
   * 3. 如果任一开关开启，调用 flattenDocumentsForSharing 扁平化收集文档，然后批量处理
   */
  public async createShare(docId: string, settings?: Partial<SingleDocSetting>, options?: Partial<ShareOptions>) {
    try {
      const config = await this.pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
      const needBatchProcess = this.checkBatchProcessNeeded(settings, config)

      if (!needBatchProcess) {
        await this.handleOne(docId, settings, options)
      } else {
        const documentsToShare = await this.flattenDocumentsForSharing(docId, settings, options, config)
        await this.batchProcessDocuments(documentsToShare, 10, options)
      }
    } catch (error) {
      this.logger.error("创建分享失败", error)
    }
  }

  /**
   * 统一取消分享入口
   */
  public async cancelShare(docId: string) {
    try {
      const config = await this.pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
      const { kernelApi } = useSiyuanApi(config)
      const docAttrs = await kernelApi.getBlockAttrs(docId)
      const settings = AttrUtils.fromAttrs(docAttrs)

      const effectiveShareSubdocuments = this.getEffectiveShareSubdocuments(settings, config)

      if (!effectiveShareSubdocuments) {
        const result = await this.cancelOne(docId)
        this.showCancelResult(result)
        return result
      }

      // 多文档取消
      const documentsToCancel = await this.flattenDocumentsForSharing(docId, settings, undefined, config)
      await this.cancelMultipleDocuments(documentsToCancel)
      return { code: 0, msg: "success" }
    } catch (error) {
      this.logger.error("取消分享失败", error)
      return { code: -1, msg: error }
    }
  }

  /**
   * 扁平化获取需要分享的文档列表
   *
   * 子文档和引用文档是并列关系，各自独立处理，最终汇聚到同一个列表中
   */
  public async flattenDocumentsForSharing(
    docId: string,
    settings?: Partial<SingleDocSetting>,
    options?: Partial<ShareOptions>,
    config?: ShareProConfig
  ): Promise<Array<{ docId: string; settings: Partial<SingleDocSetting>; options: Partial<ShareOptions> }>> {
    const documentsToShare: Array<{
      docId: string
      settings: Partial<SingleDocSetting>
      options: Partial<ShareOptions>
    }> = []

    if (!config) {
      config = await this.pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
    }

    const { effectiveShareSubdocuments, effectiveShareReferences } = this.getEffectiveShareSettings(settings, config)
    const addedDocIds = new Set<string>()

    // 1. 主文档始终在列表首位
    documentsToShare.push({ docId, settings: settings || {}, options: options || {} })
    addedDocIds.add(docId)

    // 2. 处理子文档（如果开关开启）
    if (effectiveShareSubdocuments) {
      const subdocItems = await this.collectSubdocuments(docId, settings, options, config, addedDocIds)
      documentsToShare.push(...subdocItems)
    }

    // 3. 处理引用文档（如果开关开启）
    if (effectiveShareReferences) {
      const refDocItems = await this.collectReferencedDocuments(docId, settings, options, config, addedDocIds)
      documentsToShare.push(...refDocItems)
    }

    return documentsToShare
  }

  /**
   * 更新单文档设置
   */
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
   * 更新分享选项（如密码等），不重新上传内容
   */
  public async updateShareOptions(docId: string, options: Partial<ShareOptions>) {
    try {
      const resp = await this.shareApi.updateShareOptions({ docId, options })
      if (resp.code !== 0) {
        const errorMsg = this.pluginInstance.i18n["shareService"]["updateOptionsError"] + resp.msg
        this.addLog(errorMsg, "error")
        return resp
      }
      const successMsg = this.pluginInstance.i18n["shareService"]["updateOptionsSuccess"] + "：" + docId
      this.addLog(successMsg, "info")
      return resp
    } catch (e) {
      const exceptionMsg = this.pluginInstance.i18n["shareService"]["updateOptionsException"] + docId + " => " + e
      this.addLog(exceptionMsg, "error")
      throw e
    }
  }

  /**
   * 列出已分享文档
   */
  public async listDoc(pageNum: number, pageSize: number, order: string, direction: string, search: string) {
    return await this.shareApi.listDoc({ pageNum, pageSize, order, direction, search })
  }

  /**
   * 根据ID获取分享历史
   */
  public async getHistoryByIds(docIds: string[]): Promise<Array<ShareHistoryItem> | undefined> {
    const ret = await this.shareApi.getHistoryByIds(docIds)
    if (ret.code == 0) {
      return ret.data.map((item: any) => ({
        docId: item.docId,
        docTitle: item.data.title,
        shareTime: item.createAtTimestamp,
        shareStatus: item.status,
        shareUrl: item.shareUrl,
        errorMessage: "",
        docModifiedTime: item.createAtTimestamp,
      }))
    }
    return []
  }

  /**
   * 根据文档ID获取本地分享历史（用于ShareUI显示上次分享时间）
   */
  public async getLocalShareHistory(docId: string): Promise<ShareHistoryItem | undefined> {
    return await this.localShareHistory.getHistoryByDocId(docId)
  }

  /**
   * 获取VIP信息
   */
  public async getVipInfo(token: string): Promise<ServiceResponse> {
    return await this.shareApi.getVipInfo(token)
  }

  /**
   * 获取已分享文档信息
   */
  public async getSharedDocInfo(docId: string, token?: string) {
    return await this.shareApi.getDoc(docId, token)
  }

  // ================
  // private methods (私有方法)
  // ================

  // --- 核心分享逻辑 ---

  /**
   * 处理单个文档的分享逻辑（核心私有方法）
   * 内置增量检测：自动跳过未变更的文档
   */
  private async handleOne(
    docId: string,
    settings?: Partial<SingleDocSetting>,
    options?: Partial<ShareOptions>
  ): Promise<{ skipped: boolean; reason?: string }> {
    try {
      const cfg = await this.pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
      const { blogApi } = useSiyuanApi(cfg, settings)
      const post = await blogApi.getPost(docId)
      this.addLog(this.pluginInstance.i18n["shareService"]["getPost"], "info")

      // ===== 微观增量检测（内置行为，不可关闭）=====
      // 如果 forceUpdate 为 true，跳过增量检测，强制重新分享
      if (!options?.forceUpdate) {
        const currentModifiedTime = post?.dateUpdated ? new Date(post.dateUpdated).getTime() : Date.now()
        const history = await this.localShareHistory.getHistoryByDocId(docId)

        // 首次分享或有变更时继续
        if (history && currentModifiedTime <= history.docModifiedTime) {
          // 文档未变更，跳过分享
          const docTitle = post?.title || docId
          this.logger.info(`文档未变更，跳过分享: ${docTitle}`)
          // 批量操作时不显示单文档 toast，避免 toast 爆炸
          if (!options?.skipMsg) {
            const skipMsg = this.pluginInstance.i18n["shareService"]["msgDocSkipped"].replace("[param1]", docTitle)
            showMessage(skipMsg, 3000, "info")
          }
          return { skipped: true, reason: "noChange" }
        }
      }
      // ===== 增量检测结束 =====

      await this.updateSingleDocSettings(docId, true, settings)

      const { getEmbedBlocks } = useEmbedBlock(cfg)
      const { getDataViews } = useDataTable(cfg)
      const { getFoldBlocks } = useFold(cfg)

      const sPost = this.buildSharePost(
        post,
        cfg,
        docId,
        await getEmbedBlocks(post.editorDom, docId),
        await getDataViews(post.editorDom),
        await getFoldBlocks(post.editorDom)
      )

      const resp = await this.shareApi.createShare({
        docId: post.postid,
        slug: post.postid,
        html: JSON.stringify(sPost),
        docAttrs: settings,
      })

      if (resp.code !== 0) {
        await this.handleShareFailure(docId, post, resp.msg)
        return { skipped: false }
      }

      await this.handleShareSuccess(docId, post, resp, options)
      void this.processAllMediaResources(docId, resp.data.media, resp.data.dataViewMedia)
      // 批量操作时不显示单文档 toast，避免 toast 爆炸
      if (!options?.skipMsg) {
        showMessage(this.pluginInstance.i18n["shareService"]["msgShareSuccess"], 3000, "info")
      }
      return { skipped: false }
    } catch (e) {
      await this.handleShareException(docId, e)
      return { skipped: false }
    }
  }

  /**
   * 批量处理文档分享队列
   */
  private async batchProcessDocuments(
    documentsToShare: Array<{ docId: string; settings: Partial<SingleDocSetting>; options: Partial<ShareOptions> }>,
    maxConcurrency = 10,
    parentOptions?: Partial<ShareOptions>
  ): Promise<void> {
    const total = documentsToShare.length

    if (total === 1) {
      await this.handleOne(documentsToShare[0].docId, documentsToShare[0].settings, documentsToShare[0].options)
      return
    }

    // 关键：记录发起操作的文档ID（列表首位的文档）
    const initiatorDocId = documentsToShare[0].docId
    const progressId = ProgressManager.startBatch(
      this.pluginInstance.i18n["progressManager"]["sharingDocuments"].replace("[param1]", total.toString()),
      total,
      initiatorDocId // 传入发起操作的文档ID，用于文档级别的错误隔离
    )

    let completedCount = 0
    let skippedCount = 0
    let sharedCount = 0

    await this.processWithConcurrency(
      documentsToShare,
      async (doc) => {
        try {
          const cfg = await this.pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
          const { blogApi } = useSiyuanApi(cfg)
          const post = await blogApi.getPost(doc.docId)
          const docTitle = post?.title || doc.docId

          // 批量操作时跳过单文档 toast，避免 toast 爆炸
          const batchOptions = { ...doc.options, skipMsg: true }
          const result = await this.handleOne(doc.docId, doc.settings, batchOptions)

          completedCount++

          if (result?.skipped) {
            // 文档被跳过（未变更）
            skippedCount++
            ProgressManager.addSkipped(progressId, doc.docId, docTitle)
          } else {
            // 文档已分享
            sharedCount++
            ProgressManager.updateProgress(progressId, {
              completed: completedCount,
              currentDocId: doc.docId,
              currentDocTitle: docTitle,
            })
          }

          return { success: true, docId: doc.docId, skipped: result?.skipped }
        } catch (error) {
          this.logger.error(`分享文档 ${doc.docId} 失败:`, error)
          completedCount++
          ProgressManager.addError(progressId, doc.docId, error)
          return { success: false, docId: doc.docId, error }
        }
      },
      maxConcurrency
    )

    // 批量完成后汇总提示（除非上层指定跳过）
    if (!parentOptions?.skipBatchMsg) {
      const batchCompleteMsg = this.pluginInstance.i18n["shareService"]["msgBatchComplete"]
        .replace("[param1]", sharedCount.toString())
        .replace("[param2]", skippedCount.toString())
      showMessage(batchCompleteMsg, 5000, "info")
    }

    ProgressManager.markDocumentsCompleted(progressId)
  }

  // --- 文档收集 ---

  /**
   * 收集子文档列表
   *
   * 场景区分：
   * 1. ShareUI场景：如果 settings.selectedSubdocIds 是数组，直接使用用户选择的文档ID（即使是空数组也尊重用户选择）
   * 2. 其他场景（顶部菜单、增量分享等）：selectedSubdocIds 为 undefined，自动获取所有子文档
   */
  private async collectSubdocuments(
    docId: string,
    settings: Partial<SingleDocSetting> | undefined,
    options: Partial<ShareOptions> | undefined,
    config: ShareProConfig,
    addedDocIds: Set<string>
  ): Promise<Array<{ docId: string; settings: Partial<SingleDocSetting>; options: Partial<ShareOptions> }>> {
    const subdocItems: Array<{ docId: string; settings: Partial<SingleDocSetting>; options: Partial<ShareOptions> }> =
      []

    try {
      // 场景1：ShareUI场景 - 用户已手动选择子文档（通过 Array.isArray 判断，区分 [] 和 undefined）
      const selectedSubdocIds = settings?.selectedSubdocIds
      if (Array.isArray(selectedSubdocIds)) {
        this.logger.debug(`使用用户选择的子文档ID列表，共 ${selectedSubdocIds.length} 个`)

        for (const subdocId of selectedSubdocIds) {
          // 排除主文档本身和已添加的文档
          if (subdocId !== docId && !addedDocIds.has(subdocId)) {
            subdocItems.push({ docId: subdocId, settings: settings || {}, options: options || {} })
            addedDocIds.add(subdocId)
          }
        }

        return subdocItems
      }

      // 场景2：其他场景 - 自动获取所有子文档
      this.logger.debug("自动获取所有子文档")
      const { kernelApi } = useSiyuanApi(config)
      const subdocCount = await getSubdocCount(kernelApi, docId)
      const maxCount = this.calculateMaxSubdocCount(settings, config, subdocCount)

      const pageSize = 50
      const totalPages = Math.ceil(maxCount / pageSize)

      for (let page = 0; page < totalPages; page++) {
        const subdocs = await getSubdocsPaged(kernelApi, docId, page, pageSize)
        const filteredSubdocs = subdocs.filter((subdoc) => subdoc.docId !== docId)

        for (const subdoc of filteredSubdocs) {
          if (!addedDocIds.has(subdoc.docId)) {
            subdocItems.push({ docId: subdoc.docId, settings: settings || {}, options: options || {} })
            addedDocIds.add(subdoc.docId)
          }
        }

        if (subdocItems.length >= maxCount) break
      }
    } catch (error) {
      this.logger.error("收集子文档失败:", error)
    }

    return subdocItems
  }

  /**
   * 收集引用文档列表
   */
  private async collectReferencedDocuments(
    docId: string,
    settings: Partial<SingleDocSetting> | undefined,
    options: Partial<ShareOptions> | undefined,
    config: ShareProConfig,
    addedDocIds: Set<string>
  ): Promise<Array<{ docId: string; settings: Partial<SingleDocSetting>; options: Partial<ShareOptions> }>> {
    const refDocItems: Array<{ docId: string; settings: Partial<SingleDocSetting>; options: Partial<ShareOptions> }> =
      []

    try {
      const referencedDocs = await this.getReferencedDocuments(docId, config)

      for (const refDoc of referencedDocs) {
        if (!addedDocIds.has(refDoc.docId)) {
          refDocItems.push({ docId: refDoc.docId, settings: settings || {}, options: options || {} })
          addedDocIds.add(refDoc.docId)
        }
      }
    } catch (error) {
      this.logger.error("收集引用文档失败:", error)
    }

    return refDocItems
  }

  /**
   * 获取引用的文档列表（递归获取）
   *
   * 最大递归深度由 DEFAULT_SHARE_REFERENCES_MAX_DEPTH 常量控制
   * 当前为内部配置，暂不对用户开放，如需调整请修改 Constants.ts
   */
  private async getReferencedDocuments(
    docId: string,
    config: ShareProConfig,
    maxDepth: number = DEFAULT_SHARE_REFERENCES_MAX_DEPTH
  ): Promise<Array<{ docId: string; docTitle: string }>> {
    const allReferencedDocs: Array<{ docId: string; docTitle: string }> = []
    const processedDocIds = new Set<string>()

    try {
      await this.collectReferencedDocsRecursive(docId, config, allReferencedDocs, processedDocIds, 0, maxDepth)
    } catch (error) {
      this.logger.error(`获取引用文档失败:`, error)
    }

    return allReferencedDocs
  }

  /**
   * 递归收集引用文档
   */
  private async collectReferencedDocsRecursive(
    currentDocId: string,
    config: ShareProConfig,
    result: Array<{ docId: string; docTitle: string }>,
    processedDocIds: Set<string>,
    currentDepth: number,
    maxDepth: number
  ): Promise<void> {
    if (currentDepth >= maxDepth) {
      this.logger.debug(`达到最大递归深度 ${maxDepth}，停止递归`)
      return
    }

    if (processedDocIds.has(currentDocId)) {
      this.logger.debug(`检测到循环引用，跳过文档: ${currentDocId}`)
      return
    }
    processedDocIds.add(currentDocId)

    try {
      const { kernelApi } = useSiyuanApi(config)
      const sql = `
        SELECT DISTINCT def_block_root_id
        FROM refs
        WHERE root_id = '${currentDocId}'
          AND def_block_root_id != '${currentDocId}'
      `

      const refResult = await kernelApi.sql(sql)
      if (!refResult || refResult.length === 0) return

      const referencedDocIds = refResult
        .map((row: any) => row.def_block_root_id)
        .filter((id: string) => id && !processedDocIds.has(id))

      for (const refDocId of referencedDocIds) {
        try {
          const refDocInfo = await kernelApi.getBlockByID(refDocId)
          if (refDocInfo?.box) {
            result.push({
              docId: refDocId,
              docTitle: refDocInfo.content || refDocInfo.title || "Untitled Document",
            })
            await this.collectReferencedDocsRecursive(
              refDocId,
              config,
              result,
              processedDocIds,
              currentDepth + 1,
              maxDepth
            )
          }
        } catch (error) {
          this.logger.warn(`无法获取引用文档 ${refDocId} 的信息:`, error)
        }
      }
    } catch (error) {
      this.logger.error(`获取文档 ${currentDocId} 的引用失败:`, error)
    }
  }

  // --- 取消分享 ---

  /**
   * 取消单个文档的分享
   */
  private async cancelOne(docId: string) {
    try {
      const ret = await this.shareApi.deleteDoc(docId)
      await this.updateSingleDocSettings(docId, false, {})

      try {
        await this.localShareHistory.removeHistory(docId)
        shareHistoryCache.invalidate(docId)
      } catch (historyError) {
        this.logger.error(`删除分享历史记录失败: ${docId}`, historyError)
      }

      return { code: 0, msg: "success" }
    } catch (e) {
      const errorMsg = this.pluginInstance.i18n["shareService"]["cancelShareError"] + e
      this.addLog(errorMsg, "error")
      return { code: -1, msg: e }
    }
  }

  /**
   * 批量取消多个文档的分享
   */
  private async cancelMultipleDocuments(
    documentsToCancel: Array<{ docId: string; settings: Partial<SingleDocSetting>; options: Partial<ShareOptions> }>
  ): Promise<void> {
    // 关键：记录发起操作的文档ID（列表首位的文档）
    const initiatorDocId = documentsToCancel[0].docId
    const progressId = ProgressManager.startBatch(
      this.pluginInstance.i18n["progressManager"]["cancelingDocuments"].replace(
        "[param1]",
        documentsToCancel.length.toString()
      ),
      documentsToCancel.length,
      initiatorDocId // 传入发起操作的文档ID，用于文档级别的错误隔离
    )

    let completedCount = 0
    await this.processWithConcurrency(
      documentsToCancel,
      async (doc) => {
        try {
          const result = await this.cancelOne(doc.docId)
          completedCount++

          const cfg = await this.pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
          const { blogApi } = useSiyuanApi(cfg)
          const post = await blogApi.getPost(doc.docId)
          const docTitle = post?.title || doc.docId

          ProgressManager.updateProgress(progressId, {
            completed: completedCount,
            currentDocId: doc.docId,
            currentDocTitle: docTitle,
          })

          if (result.code === 0) {
            return { success: true, docId: doc.docId }
          } else {
            ProgressManager.addError(progressId, doc.docId, result.msg)
            return { success: false, docId: doc.docId, error: result.msg }
          }
        } catch (error) {
          this.logger.error(`取消分享文档 ${doc.docId} 失败:`, error)
          ProgressManager.addError(progressId, doc.docId, error)
          return { success: false, docId: doc.docId, error }
        }
      },
      10
    )

    ProgressManager.markDocumentsCompleted(progressId)
  }

  // --- 媒体处理 ---

  /**
   * 处理分享媒体资源
   */
  private async processShareMedia(
    docId: string,
    mediaList: any[],
    progressCallback?: (completed: number, error?: any) => void
  ) {
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

      const msgStartGroupWithParam = this.pluginInstance.i18n["shareService"]["msgStartGroup"]
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
            imageUrl = cfg.serviceApiConfig.apiUrl.endsWith("/")
              ? cfg.siyuanConfig.apiUrl + imageUrl
              : cfg.siyuanConfig.apiUrl + "/" + imageUrl
          }

          const msgStartCurrentPicWithParam = this.pluginInstance.i18n["shareService"]["msgStartCurrentPic"]
            .replace("[param1]", totalCount)
            .replace("[param2]", imageUrl)
          this.addLog(msgStartCurrentPicWithParam, "info")

          const res = await ImageUtils.fetchBase64WithContentType(imageUrl)
          this.addLog(`Image base64 response =>${res}`, "info")

          if (res?.status !== 200) {
            errorCount += 1
            this.addLog(`Image retrieval error: ${res.msg}`, "error")
            continue
          }

          processedParams.push({
            file: res.body,
            originalUrl,
            alt,
            title,
            type: res.contentType,
          })
        } catch (e) {
          this.addLog(this.pluginInstance.i18n["shareService"]["msgMediaUploadError"] + e, "error")
        }
      }

      const msgGroupProcessSuccessWithParam = this.pluginInstance.i18n["shareService"]["msgGroupProcessSuccess"]
        .replace("[param1]", i + 1)
        .replace("[param2]", groupedMedia.length)
        .replace("[param3]", perReq)
      this.addLog(msgGroupProcessSuccessWithParam, "info")

      const hasNext = i < groupedMedia.length - 1
      const uploadResult = await this.shareApi.uploadMedia({
        docId,
        medias: processedParams,
        hasNext,
      })

      this.addLog(this.pluginInstance.i18n["shareService"]["msgBatchResult"] + JSON.stringify(uploadResult), "info")

      if (uploadResult.code === 0) {
        successCount += processedParams.length
        const msgCurrentMediaSuccessWithParam = this.pluginInstance.i18n["shareService"][
          "msgCurrentMediaSuccess"
        ].replace("[param1]", i + 1)
        this.addLog(msgCurrentMediaSuccessWithParam, "info")
        if (progressCallback) progressCallback(processedParams.length)
      } else {
        errorCount += processedParams.length
        const rtnMsg = uploadResult.msg || (uploadResult as any).message
        const errMsg =
          this.pluginInstance.i18n["shareService"]["msgCurrentMediaError"].replace("[param1]", i + 1) + rtnMsg
        this.addLog(errMsg, "error")
        if (progressCallback) progressCallback(processedParams.length, uploadResult.msg || rtnMsg)
      }
    }

    const successPicWithParam = this.pluginInstance.i18n["shareService"]["successPic"]
      .replace("[param1]", totalCount)
      .replace("[param2]", successCount)
      .replace("[param3]", errorCount)
    this.addLog(successPicWithParam, "info")

    if (successCount !== totalCount) {
      const msgWithParam = this.pluginInstance.i18n["shareService"]["errorPic"].replace("[param1]", errorCount)
      this.addLog(msgWithParam, "error")
    }
  }

  /**
   * 处理数据库媒体资源
   */
  private async processDataViewMedia(
    docId: string,
    mediaList: any[],
    progressCallback?: (completed: number, error?: any) => void
  ) {
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

      const msgStartGroupWithParam = this.pluginInstance.i18n["shareService"]["msgStartGroup"]
        .replace("[param1]", i + 1)
        .replace("[param2]", groupedMedia.length)
        .replace("[param3]", perReq)
      this.addLog(msgStartGroupWithParam, "info")

      for (const media of mediaGroup) {
        try {
          totalCount += 1

          const originalUrl = media.originalUrl ?? ""
          let imageUrl = originalUrl

          if (!imageUrl.startsWith("http")) {
            imageUrl = cfg.serviceApiConfig.apiUrl.endsWith("/")
              ? cfg.siyuanConfig.apiUrl + imageUrl
              : cfg.siyuanConfig.apiUrl + "/" + imageUrl
          }

          const msgStartCurrentPicWithParam = this.pluginInstance.i18n["shareService"]["msgStartCurrentDataViewMedia"]
            .replace("[param1]", totalCount)
            .replace("[param2]", imageUrl)
          this.addLog(msgStartCurrentPicWithParam, "info")

          const res = await ImageUtils.fetchBase64WithContentType(imageUrl)

          if (res?.status !== 200) {
            errorCount += 1
            this.addLog(`DataView image retrieval error: ${res.msg}`, "error")
            continue
          }

          processedParams.push({
            file: res.body,
            originalUrl,
            alt: media.alt,
            title: media.title,
            type: res.contentType,
            source: "dataviews",
            cellId: media.cellId,
          })
        } catch (e) {
          this.addLog(this.pluginInstance.i18n["shareService"]["msgDataViewMediaUploadError"] + e, "error")
        }
      }

      const hasNext = i < groupedMedia.length - 1
      const uploadResult = await this.shareApi.uploadDataViewMedia({
        docId,
        medias: processedParams,
        hasNext,
      })

      if (uploadResult.code === 0) {
        successCount += processedParams.length
        if (progressCallback) progressCallback(processedParams.length)
      } else {
        errorCount += processedParams.length
        if (progressCallback) progressCallback(processedParams.length, uploadResult.msg)
      }
    }

    const successPicWithParam = this.pluginInstance.i18n["shareService"]["successDataViewMedia"]
      .replace("[param1]", totalCount)
      .replace("[param2]", successCount)
      .replace("[param3]", errorCount)
    this.addLog(successPicWithParam, "info")
  }

  /**
   * 顺序处理所有媒体资源
   */
  private async processAllMediaResources(docId: string, media: any[], dataViewMedia: any[]) {
    try {
      const totalResources = (media?.length || 0) + (dataViewMedia?.length || 0)

      if (totalResources > 0) {
        resourceEventEmitter.emit(RESOURCE_EVENTS.START, { docId, totalResources })
      }

      if (media && media.length > 0) {
        this.addLog(this.pluginInstance.i18n["shareService"]["msgStartPicBack"], "info")
        await this.processShareMedia(docId, media, (completed, error) => {
          if (completed > 0) resourceEventEmitter.emit(RESOURCE_EVENTS.PROGRESS, { docId, completed })
          if (error) resourceEventEmitter.emit(RESOURCE_EVENTS.ERROR, { docId, error })
        })
        this.addLog(this.pluginInstance.i18n["shareService"]["msgEndPicBack"], "info")
      }

      if (dataViewMedia && dataViewMedia.length > 0) {
        this.addLog(this.pluginInstance.i18n["shareService"]["msgStartDataViewMediaBack"], "info")
        await this.processDataViewMedia(docId, dataViewMedia, (completed, error) => {
          if (completed > 0) resourceEventEmitter.emit(RESOURCE_EVENTS.PROGRESS, { docId, completed })
          if (error) resourceEventEmitter.emit(RESOURCE_EVENTS.ERROR, { docId, error })
        })
        this.addLog(this.pluginInstance.i18n["shareService"]["msgEndDataViewMediaBack"], "info")
      }

      resourceEventEmitter.emit(RESOURCE_EVENTS.COMPLETE, { docId })
    } catch (error) {
      this.logger.error(`Resource processing failed for doc ${docId}:`, error)
      resourceEventEmitter.emit(RESOURCE_EVENTS.ERROR, { docId, error })
      resourceEventEmitter.emit(RESOURCE_EVENTS.COMPLETE, { docId })
    }
  }

  // --- 工具方法 ---

  /**
   * 检查是否需要批量处理
   */
  private checkBatchProcessNeeded(settings: Partial<SingleDocSetting> | undefined, config: ShareProConfig): boolean {
    const { effectiveShareSubdocuments, effectiveShareReferences } = this.getEffectiveShareSettings(settings, config)
    return effectiveShareSubdocuments || effectiveShareReferences
  }

  /**
   * 获取有效的分享设置
   */
  private getEffectiveShareSettings(
    settings: Partial<SingleDocSetting> | undefined,
    config: ShareProConfig
  ): { effectiveShareSubdocuments: boolean; effectiveShareReferences: boolean } {
    const globalShareSubdocuments = config.appConfig?.shareSubdocuments ?? false
    const globalShareReferences = config.appConfig?.shareReferences ?? false

    return {
      effectiveShareSubdocuments: settings?.shareSubdocuments ?? globalShareSubdocuments,
      effectiveShareReferences: settings?.shareReferences ?? globalShareReferences,
    }
  }

  /**
   * 获取有效的子文档分享设置
   */
  private getEffectiveShareSubdocuments(
    settings: Partial<SingleDocSetting> | undefined,
    config: ShareProConfig
  ): boolean {
    const globalShareSubdocuments = config.appConfig?.shareSubdocuments ?? false
    return settings?.shareSubdocuments ?? globalShareSubdocuments
  }

  /**
   * 计算最大子文档数量
   */
  private calculateMaxSubdocCount(
    settings: Partial<SingleDocSetting> | undefined,
    config: ShareProConfig,
    subdocCount: number
  ): number {
    const maxSubdocuments = settings?.maxSubdocuments ?? config.appConfig?.maxSubdocuments ?? 100

    if (maxSubdocuments === -1) {
      if (subdocCount > 999) {
        this.logger.warn(`子文档数量超过999 (${subdocCount})，可能存在性能风险`)
      }
      return subdocCount
    }

    if (subdocCount > maxSubdocuments) {
      const maxCount = Math.min(maxSubdocuments, 999)
      if (maxSubdocuments > 999) {
        this.logger.warn(`配置的子文档数量限制 (${maxSubdocuments}) 超过最大值999，使用999作为限制`)
        return 999
      }
      return maxCount
    }

    return subdocCount
  }

  /**
   * 构建分享用的 Post 对象
   */
  private buildSharePost(
    post: any,
    cfg: ShareProConfig,
    docId: string,
    embedBlocks: any,
    dataViews: any,
    foldBlocks: any
  ): any {
    const sPost = new Post()
    sPost.attrs = post.attrs
    sPost.title = post.title
    sPost.editorDom = post.editorDom
    sPost.dateUpdated = post.dateUpdated
    sPost.dateCreated = post.dateCreated
    sPost.mt_keywords = post.mt_keywords
    sPost.categories = post.categories
    sPost.shortDesc = post.shortDesc
    sPost.mt_excerpt = post.mt_excerpt
    sPost.docTree = post.docTree
    sPost.docTreeLevel = post.docTreeLevel
    sPost.docTreeHierarchy = post.docTreeHierarchy
    sPost.outline = post.outline
    sPost.outlineLevel = post.outlineLevel
    sPost.embedBlocks = embedBlocks
    sPost.dataViews = dataViews
    sPost.foldBlocks = foldBlocks
    return sPost
  }

  /**
   * 处理分享成功
   */
  private async handleShareSuccess(
    docId: string,
    post: any,
    resp: any,
    options: Partial<ShareOptions> | undefined
  ): Promise<void> {
    try {
      const historyItem: ShareHistoryItem = {
        docId: post.postid,
        docTitle: post.title,
        shareTime: Date.now(),
        shareStatus: "success",
        shareUrl: resp.data?.shareUrl,
        docModifiedTime: new Date(post.dateUpdated).getTime(),
      }

      await this.localShareHistory.addHistory(historyItem)
      shareHistoryCache.set(docId, historyItem)
    } catch (historyError) {
      this.logger.error(`保存分享历史记录失败: ${docId}`, historyError)
    }

    await this.updateShareOptions(docId, options)
    const successMsg = this.pluginInstance.i18n["shareService"]["shareSuccessWithDoc"]
      .replace("[param1]", post.title)
      .replace("[param2]", "[" + docId + "]")
    this.addLog(successMsg, "info")
  }

  /**
   * 处理分享失败
   */
  private async handleShareFailure(docId: string, post: any, errorMsg: string): Promise<void> {
    const msg = this.pluginInstance.i18n["shareService"]["shareErrorWithDoc"].replace("[param1]", docId) + errorMsg
    this.addLog(msg, "error")

    try {
      const historyItem: ShareHistoryItem = {
        docId,
        docTitle: post?.title || "未知文档",
        shareTime: Date.now(),
        shareStatus: "failed",
        errorMessage: errorMsg,
        docModifiedTime: post?.dateUpdated ? new Date(post.dateUpdated).getTime() : Date.now(),
      }

      await this.localShareHistory.addHistory(historyItem)
      shareHistoryCache.set(docId, historyItem)
    } catch (historyError) {
      this.logger.error(`保存分享失败历史记录失败: ${docId}`, historyError)
    }

    showMessage(this.pluginInstance.i18n["shareService"]["msgShareError"] + errorMsg, 7000, "error")
  }

  /**
   * 处理分享异常
   */
  private async handleShareException(docId: string, e: any): Promise<void> {
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

    try {
      const historyItem: ShareHistoryItem = {
        docId,
        docTitle,
        shareTime: Date.now(),
        shareStatus: "failed",
        errorMessage: String(e),
        docModifiedTime,
      }

      await this.localShareHistory.addHistory(historyItem)
      shareHistoryCache.set(docId, historyItem)
    } catch (historyError) {
      this.logger.error(`保存分享失败历史记录失败: ${docId}`, historyError)
    }

    const exceptionMsg = this.pluginInstance.i18n["shareService"]["shareErrorWithDoc"].replace("[param1]", docId) + e
    this.addLog(exceptionMsg, "error")
    showMessage(this.pluginInstance.i18n["shareService"]["msgShareError"] + e, 7000, "error")
  }

  /**
   * 显示取消分享结果
   */
  private showCancelResult(result: { code: number; msg: string }): void {
    if (result.code === 0) {
      showMessage(this.pluginInstance.i18n["shareService"]["msgCancelSuccess"], 3000, "info")
    } else {
      showMessage(this.pluginInstance.i18n["shareService"]["msgCancelError"] + result.msg, 7000, "error")
    }
  }

  /**
   * 使用并发控制处理数组
   */
  private async processWithConcurrency<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    maxConcurrency: number
  ): Promise<R[]> {
    if (!Array.isArray(items)) throw new TypeError("items必须是数组")
    if (typeof processor !== "function") throw new TypeError("processor必须是函数")

    const concurrency = Math.max(1, Math.floor(maxConcurrency))
    if (items.length === 0) return []

    const results: R[] = new Array(items.length)
    const errors: Error[] = []
    const promises: Promise<void>[] = []

    for (let i = 0; i < items.length; i++) {
      const task = async (index: number): Promise<void> => {
        try {
          results[index] = await processor(items[index], index)
        } catch (err) {
          errors.push(new Error(`任务${index}失败: ${(err as Error).message}`))
          results[index] = undefined as unknown as R
        }
      }

      if (i >= concurrency) await promises.shift()
      promises.push(task(i))
    }

    await Promise.all(promises)

    if (errors.length > 0) {
      this.logger.warn(`批量处理中出现 ${errors.length} 个错误`, errors)
    }

    return results
  }

  /**
   * 添加日志
   */
  private addLog(msg: string, type: "info" | "error") {
    updateStatusBar(this.pluginInstance, msg)
    if (type === "info") {
      this.logger.info(msg)
    } else {
      this.logger.error(msg)
    }
  }

  /**
   * 处理单文档资源错误
   */
  private handleResourceErrorForSingleDoc(docId: string, error: any) {
    const errorMessage =
      this.pluginInstance.i18n["shareService"]["msgResourceError"] + (error?.message || String(error))
    showMessage(errorMessage, 15000, "error")
  }
}

export { ShareService }
