<!--
  -            GNU GENERAL PUBLIC LICENSE
  -               Version 3, 29 June 2007
  -
  -  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
  -  Everyone is permitted to copy and distribute verbatim copies
  -  of this license document, but changing it is not allowed.
  -->

<script lang="ts">
  import copy from "copy-to-clipboard"
  import { showMessage } from "siyuan"
  import { onDestroy, onMount } from "svelte"
  import { Post } from "zhi-blog-api"
  import { simpleLogger } from "zhi-lib-base"
  import { SiyuanKernelApi } from "zhi-siyuan-api"
  import { useSiyuanApi } from "../../composables/useSiyuanApi"
  import { isDev, SHARE_PRO_STORE_NAME } from "../../Constants"
  import ShareProPlugin from "../../index"
  import { WidgetInvoke } from "../../invoke/widgetInvoke"
  import { KeyInfo } from "../../models/KeyInfo"
  import { ShareOptions } from "../../models/ShareOptions"
  import { ShareProConfig } from "../../models/ShareProConfig"
  import { SingleDocSetting } from "../../models/SingleDocSetting"
  import { ShareService } from "../../service/ShareService"
  import { AttrUtils } from "../../utils/AttrUtils"
  import { PasswordUtils } from "../../utils/PasswordUtils"
  import type { ErrorState } from "../../utils/progress/progressStore"
  import { errorStore } from "../../utils/progress/progressStore"
  import { SettingKeys } from "../../utils/SettingKeys"
  import { icons } from "../../utils/svg"
  import Confirm from "../components/Confirm.svelte"
  import ProgressManager from "../components/ProgressManager.svelte"
  import SubdocumentTreePreview from "../components/subdocument/SubdocumentTreePreview.svelte"

  export let pluginInstance: ShareProPlugin
  export let shareService: ShareService
  export let vipInfo: {
    code: number
    msg: string
    data: KeyInfo
  }
  export let docId: string = "" // 可选参数,无文档ID时显示简化版UI

  const logger = simpleLogger("share-ui", "share-pro", isDev)
  const widgetInvoke = new WidgetInvoke(pluginInstance)

  // ========================================
  // 判断：是否是单文档模式
  // ========================================
  const isSingleDocMode = docId && docId.trim() !== ""

  // ========================================
  // 单文档模式专属数据 - 三层配置架构
  // ========================================
  // 设计理念：通过明确的分层来简化维护和理解配置的生命周期与存储位置
  //
  // 层级1: userPreferences - 全局用户偏好设置（非文档级别）
  //   特点：全局设置，影响所有文档
  //   存储：本地配置（从 appConfig 加载）
  //   生命周期：跨文档持久化
  //   维护性：易维护，全局统一
  //   示例：密码显示偏好、增量分享配置
  //
  // 层级2: singleDocSetting - 文档级设置
  //   特点：文档级设置，无敏感信息
  //   存储：文档属性（跟随文档）
  //   生命周期：跟随文档
  //   维护性：易维护，文档隔离
  //   示例：文档树、大纲、有效期
  //
  // 层级3: shareOptions - 分享选项（文档级别）
  //   特点：文档级设置，有敏感信息
  //   存储：服务端存储（跟随文档）
  //   生命周期：跟随文档
  //   维护性：易维护，安全隔离
  //   示例：分享密码
  // ========================================
  let formData = {
    post: Post as any,
    shared: false,
    shareData: {} as any,
    lastShareTime: null as number | null, // 上次分享时间戳
    lock: false,
    shareLink: "",
    kernelApi: SiyuanKernelApi,

    // 层级1: 全局用户偏好设置（非文档级别）
    // 存储位置：本地配置/服务端配置（appConfig）
    userPreferences: {
      showPassword: false, // 密码显示偏好
      shareSubdocuments: false, // 全局子文档分享设置
      incrementalShareConfig: {
        // 增量分享配置
        enabled: true, // 默认启用
      },
    },

    // 层级2: singleDocSetting - 文档级设置
    // 无敏感信息，存储在文档属性
    // 1、singleDocSetting，无敏感信息的，只在文档属性存储，例如文档大纲、文档有效期、文档状态
    singleDocSetting: {
      docTreeEnable: false, // 是否显示文档树
      docTreeLevel: 3, // 文档树层级
      outlineEnable: false, // 是否显示大纲
      outlineLevel: 6, // 大纲层级
      expiresTime: "", // 分享有效期
      shareSubdocuments: false, // 是否分享子文档
      shareReferences: false, // 是否分享引用文档
      selectedSubdocIds: [], // 用户手动选择的子文档ID列表
    } as SingleDocSetting,

    // 层级3: shareOptions - 分享选项
    // 有敏感信息，服务端存储
    // 2、shareOptions，有敏感信息，服务端存储，例如分享密码
    shareOptions: {
      passwordEnabled: false, // 密码保护开关
      password: "", // 分享密码（敏感信息）
    } as ShareOptions,

    // 操作状态机
    operationState: {
      status: "idle", // 'idle' | 'sharing' | 'canceling' | 'shared' | 'error'
      message: "",
      error: null,
    },
  }

  // ========================================
  // 公共方法
  // ========================================
  const showManageDialog = async () => {
    const keyInfo = vipInfo.data
    void widgetInvoke.showShareManageDialog(keyInfo)
  }

  // const showManageTab = () => {
  //   const keyInfo = vipInfo.data
  //   void widgetInvoke.showShareManageTab(keyInfo)
  // }
  // ========================================
  // 单文档模式专属方法
  // ========================================

  const handleShare = async () => {
    if (!isSingleDocMode) {
      logger.warn("handleShare called in non-single-doc mode, ignored")
      return
    }

    // 防止重复点击
    if (formData.operationState.status === "sharing" || formData.operationState.status === "canceling") {
      return
    }

    if (!formData.shared) {
      // 开始分享
      try {
        formData.operationState.status = "sharing"

        const shareOptions: Partial<ShareOptions> = {}
        if (formData.shareOptions.passwordEnabled) {
          shareOptions.passwordEnabled = formData.shareOptions.passwordEnabled
          shareOptions.password = formData.shareOptions.password
        }
        if (formData.singleDocSetting.expiresTime && formData.singleDocSetting.expiresTime !== "") {
          formData.singleDocSetting.expiresTime = formData.singleDocSetting.expiresTime.toString()
        } else {
          formData.singleDocSetting.expiresTime = ""
        }

        await shareService.createShare(docId, formData.singleDocSetting, shareOptions)
        // 初始化
        await initSingleDocMode()
        formData.operationState.status = "shared"
        formData.operationState.message = pluginInstance.i18n["msgShareSuccess"]
      } catch (e) {
        formData.shared = false
        formData.operationState.status = "error"
        formData.operationState.error = e
        formData.operationState.message = pluginInstance.i18n["msgShareError"]
        console.error(e)
        showMessage(pluginInstance.i18n["ui"]["shareSuccessError"] + e.toString(), 3000, "info")
      }
    } else {
      // 状态检测
      logger.info("get shared data =>", formData.shareData)
      // 注意 undefined
      if (formData?.shareData?.shareStatus && formData.shareData.shareStatus !== "COMPLETED") {
        formData.lock = true
        showMessage(pluginInstance.i18n["ui"]["msgIngError"], 3000, "info")
        formData.operationState.status = "idle"
        return
      }

      // 取消分享
      try {
        formData.operationState.status = "canceling"

        const ret = await shareService.cancelShare(docId)
        if (ret.code === 0) {
          // 初始化
          await initSingleDocMode()
          formData.operationState.status = "idle"
          showMessage(pluginInstance.i18n["topbar"]["cancelSuccess"], 3000, "info")
        } else {
          formData.operationState.status = "error"
          formData.operationState.error = ret.msg
          formData.operationState.message = pluginInstance.i18n["msgCancelError"]
          showMessage(pluginInstance.i18n["topbar"]["cancelError"] + ret.msg, 7000, "error")
        }
      } catch (e) {
        formData.operationState.status = "error"
        formData.operationState.error = e
        formData.operationState.message = pluginInstance.i18n["msgCancelError"]
        console.error(e)
        showMessage(pluginInstance.i18n["topbar"]["cancelError"] + e.toString(), 7000, "error")
      }
    }
  }

  const handleReShare = async () => {
    if (!isSingleDocMode) {
      logger.warn("handleReShare called in non-single-doc mode, ignored")
      return
    }

    // == 文档属性 ==
    // 有效期
    let expiredTime = Number(formData.singleDocSetting.expiresTime)
    if (isNaN(expiredTime) || expiredTime < 0) {
      expiredTime = 0
    }
    formData.singleDocSetting.expiresTime = expiredTime

    // == 分享选项 ==
    // 分享密码
    const shareOptions: Partial<ShareOptions> = {}
    if (formData.shareOptions.passwordEnabled) {
      shareOptions.passwordEnabled = formData.shareOptions.passwordEnabled
      shareOptions.password = formData.shareOptions.password
    }

    // 重新分享
    await shareService.createShare(docId, formData.singleDocSetting, shareOptions)
    // 初始化
    await initSingleDocMode()
  }

  const handlePasswordChange = async () => {
    if (!isSingleDocMode) {
      logger.warn("handlePasswordChange called in non-single-doc mode, ignored")
      return
    }

    if (formData.shared) {
      try {
        await shareService.updateShareOptions(docId, {
          passwordEnabled: formData.shareOptions.passwordEnabled,
          password: formData.shareOptions.password,
        })
        showMessage(pluginInstance.i18n["ui"]["updateOptionsSuccess"], 3000, "info")
      } catch (e) {
        showMessage(pluginInstance.i18n["ui"]["updateOptionsError"], 3000, "error")
      }
    }
  }

  // Confirm modal state
  let showSubdocumentConfirm = false
  let subdocumentConfirmConfig = {
    title: "",
    message: "",
    onConfirm: () => {},
    onCancel: () => {},
  }

  /**
   * 处理子文档分享选项变化
   */
  const handleSubdocumentShareChange = async (event) => {
    if (!isSingleDocMode) {
      logger.warn("handleSubdocumentShareChange called in non-single-doc mode, ignored")
      return
    }

    const newChecked = event.target.checked
    const oldChecked = formData.singleDocSetting.shareSubdocuments

    // 如果值没有变化，直接返回
    if (newChecked === oldChecked) {
      return
    }

    // 如果文档未分享，直接更新配置
    if (!formData.shared) {
      formData.singleDocSetting.shareSubdocuments = newChecked
      return
    }

    // 文档已分享的情况
    if (oldChecked && !newChecked) {
      // 从启用变为禁用 - 需要确认是否取消已分享的子文档
      subdocumentConfirmConfig = {
        title: pluginInstance.i18n["tipTitle"],
        message: pluginInstance.i18n["cs"]["confirmCancelSubdocuments"],
        onConfirm: async () => {
          // 用户确认 - 更新配置并重新分享
          formData.singleDocSetting.shareSubdocuments = newChecked
          await handleReShare()
        },
        onCancel: () => {
          // 用户取消 - 恢复原状态
          event.target.checked = oldChecked
        },
      }
      showSubdocumentConfirm = true
    } else if (!oldChecked && newChecked) {
      // 从禁用变为启用 - 需要确认是否更新分享以包含子文档
      subdocumentConfirmConfig = {
        title: pluginInstance.i18n["tipTitle"],
        message: pluginInstance.i18n["cs"]["confirmAddSubdocuments"],
        onConfirm: async () => {
          // 用户确认 - 更新配置并重新分享
          formData.singleDocSetting.shareSubdocuments = newChecked
          await handleReShare()
        },
        onCancel: () => {
          // 用户取消 - 恢复原状态
          event.target.checked = oldChecked
        },
      }
      showSubdocumentConfirm = true
    }
  }

  // Confirm modal state for references
  let showReferenceConfirm = false
  let referenceConfirmConfig = {
    title: "",
    message: "",
    onConfirm: () => {},
    onCancel: () => {},
  }

  // 大厂设计：错误状态管理
  let errorState: ErrorState = { hasError: false, errors: [], resourceErrors: [], timestamp: 0, operationName: "" }
  let showErrorDetails = false

  // 订阅错误状态
  const unsubscribeError = errorStore.subscribe((state) => {
    errorState = state
  })

  // 处理错误警告条点击
  const handleErrorBannerClick = () => {
    showErrorDetails = true
  }

  // 关闭错误详情
  const handleCloseErrorDetails = () => {
    showErrorDetails = false
  }

  // 清除错误状态
  const handleDismissError = (e?: Event) => {
    if (e) e.stopPropagation()
    errorStore.set({ hasError: false, errors: [], resourceErrors: [], timestamp: 0, operationName: "" })
  }

  // 生成错误详情消息
  const generateErrorMessage = (): string => {
    let message = ""

    if (errorState.errors.length > 0) {
      message += "📄 " + pluginInstance.i18n["progressManager"]["documentErrors"] + ":\n"
      errorState.errors.forEach((error) => {
        message += `• ${error.docId}: ${String(error.error)}\n`
      })
    }

    if (errorState.resourceErrors.length > 0) {
      if (message) message += "\n"
      message += "🖼️ " + pluginInstance.i18n["progressManager"]["resourceErrors"] + ":\n"
      errorState.resourceErrors.forEach((error) => {
        message += `• ${error.docId}: ${String(error.error)}\n`
      })
    }

    return message || pluginInstance.i18n["shareUI"]["noErrorDetails"]
  }

  /**
   * 处理引用文档分享选项变化
   */
  const handleReferenceShareChange = async (event) => {
    if (!isSingleDocMode) {
      logger.warn("handleReferenceShareChange called in non-single-doc mode, ignored")
      return
    }

    const newChecked = event.target.checked
    const oldChecked = formData.singleDocSetting.shareReferences

    // 如果值没有变化，直接返回
    if (newChecked === oldChecked) {
      return
    }

    // 如果文档未分享，直接更新配置
    if (!formData.shared) {
      formData.singleDocSetting.shareReferences = newChecked
      return
    }

    // 文档已分享的情况
    if (oldChecked && !newChecked) {
      // 从启用变为禁用 - 需要确认是否取消已分享的引用文档
      referenceConfirmConfig = {
        title: pluginInstance.i18n["tipTitle"],
        message: pluginInstance.i18n["cs"]["confirmCancelReferences"],
        onConfirm: async () => {
          // 用户确认 - 更新配置并重新分享
          formData.singleDocSetting.shareReferences = newChecked
          await handleReShare()
        },
        onCancel: () => {
          // 用户取消 - 恢复原状态
          event.target.checked = oldChecked
        },
      }
      showReferenceConfirm = true
    } else if (!oldChecked && newChecked) {
      // 从禁用变为启用 - 需要确认是否更新分享以包含引用文档
      referenceConfirmConfig = {
        title: pluginInstance.i18n["tipTitle"],
        message: pluginInstance.i18n["cs"]["confirmAddReferences"],
        onConfirm: async () => {
          // 用户确认 - 更新配置并重新分享
          formData.singleDocSetting.shareReferences = newChecked
          await handleReShare()
        },
        onCancel: () => {
          // 用户取消 - 恢复原状态
          event.target.checked = oldChecked
        },
      }
      showReferenceConfirm = true
    }
  }

  const handleExpiresTime = async () => {
    if (!isSingleDocMode) {
      logger.warn("handleExpiresTime called in non-single-doc mode, ignored")
      return
    }
    await handleReShare()
  }

  const copyWebLink = () => {
    if (!isSingleDocMode) {
      logger.warn("copyWebLink called in non-single-doc mode, ignored")
      return
    }

    let copyText = formData.shareLink
    if (formData.shareOptions.passwordEnabled) {
      copyText = copyText + " " + pluginInstance.i18n["cs"]["visitPassword"] + formData.shareOptions.password
    }
    copy(copyText)
    showMessage(pluginInstance.i18n["ui"]["copySuccess"], 3000, "info")
  }

  const viewDoc = () => {
    if (!isSingleDocMode) {
      logger.warn("viewDoc called in non-single-doc mode, ignored")
      return
    }
    window.open(formData.shareLink)
  }

  /**
   * 格式化上次分享时间为相对时间
   * 大厂设计规范：
   * - 1小时内：显示相对时间（刚刚、5分钟前）
   * - 24小时内：显示相对时间（3小时前）
   * - 昨天：显示"昨天 HH:mm"（如：昨天 14:32）
   * - 2-30天：显示相对时间（2天前）
   * - 超过30天：显示具体日期（2024-03-20）
   */
  const formatLastShareTime = (timestamp: number | null): string => {
    if (!timestamp) return ""

    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    const date = new Date(timestamp)
    const hoursStr = date.getHours().toString().padStart(2, "0")
    const minutesStr = date.getMinutes().toString().padStart(2, "0")

    // 小于1小时显示分钟
    if (minutes < 60) {
      if (minutes < 1) return pluginInstance.i18n["lastShareTime"]["justNow"]
      return pluginInstance.i18n["lastShareTime"]["minutesAgo"].replace("[param1]", minutes.toString())
    }

    // 小于24小时显示小时
    if (hours < 24) {
      return pluginInstance.i18n["lastShareTime"]["hoursAgo"].replace("[param1]", hours.toString())
    }

    // 昨天：显示"昨天 HH:mm"
    if (days === 1) {
      const yesterdayLabel = pluginInstance.i18n["lastShareTime"]["yesterday"]
      return `${yesterdayLabel} ${hoursStr}:${minutesStr}`
    }

    // 2-7天显示天数
    if (days < 7) {
      return pluginInstance.i18n["lastShareTime"]["daysAgo"].replace("[param1]", days.toString())
    }

    // 7-30天显示"X天前"或具体日期（根据配置）
    if (days < 30) {
      return pluginInstance.i18n["lastShareTime"]["daysAgo"].replace("[param1]", days.toString())
    }

    // 超过30天显示具体日期
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, "0")
    const day = date.getDate().toString().padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  // ========================================
  // 单文档模式专属辅助方法
  // ========================================

  const loadSingleDocSetting = async (cfg: ShareProConfig) => {
    // 文档级别优先级最高 - 仅用于UI显示，不影响实际分享逻辑
    const docTreeEnable = await AttrUtils.getBool(pluginInstance, docId, SettingKeys.CUSTOM_DOC_TREE_ENABLE)
    const docTreeLevel = await AttrUtils.getInt(pluginInstance, docId, SettingKeys.CUSTOM_DOC_TREE_LEVEL)
    const outlineEnable = await AttrUtils.getBool(pluginInstance, docId, SettingKeys.CUSTOM_OUTLINE_ENABLE)
    const outlineLevel = await AttrUtils.getInt(pluginInstance, docId, SettingKeys.CUSTOM_OUTLINE_LEVEL)
    const shareSubdocuments = await AttrUtils.getBool(pluginInstance, docId, SettingKeys.CUSTOM_SHARE_SUBDOCUMENTS)

    // UI显示使用文档级设置，如果未设置则使用全局默认值
    formData.singleDocSetting.docTreeEnable = docTreeEnable ?? cfg.appConfig?.docTreeEnabled ?? false
    formData.singleDocSetting.docTreeLevel = docTreeLevel ?? cfg.appConfig?.docTreeLevel ?? 3
    formData.singleDocSetting.outlineEnable = outlineEnable ?? cfg.appConfig?.outlineEnabled ?? false
    formData.singleDocSetting.outlineLevel = outlineLevel ?? cfg.appConfig?.outlineLevel ?? 6
    formData.singleDocSetting.shareSubdocuments = shareSubdocuments ?? cfg.appConfig?.shareSubdocuments ?? false
    // 引用文档分享
    const shareReferences = await AttrUtils.getBool(pluginInstance, docId, SettingKeys.CUSTOM_SHARE_REFERENCES)
    formData.singleDocSetting.shareReferences = shareReferences ?? cfg.appConfig?.shareReferences ?? false
    // 分享有效期 - 界面上留空，只有实际有值时才显示
    const expiresTime = await AttrUtils.getInt(pluginInstance, docId, SettingKeys.CUSTOM_EXPIRES)
    formData.singleDocSetting.expiresTime = expiresTime > 0 ? expiresTime.toString() : ""
    logger.debug(`Loaded doc setting => ${JSON.stringify(formData.singleDocSetting)}`)
  }

  const loadShareOptions = async (cfg: ShareProConfig) => {
    // 分享密码
    formData.shareOptions.passwordEnabled =
      formData.shareData?.passwordEnabled ?? cfg.appConfig?.passwordEnabled ?? false
    formData.userPreferences.showPassword = cfg.appConfig?.showPassword ?? false
    formData.userPreferences.shareSubdocuments = cfg.appConfig?.shareSubdocuments ?? false
    if (formData.shareOptions.passwordEnabled) {
      const rndPassword = PasswordUtils.getNewRndPassword()
      formData.shareOptions.password = formData.shareData?.password ?? rndPassword
    } else {
      formData.shareOptions.password = formData.shareData?.password ?? ""
    }

    logger.info(
      `Loaded password option => passwordEnabled=${formData.shareOptions.passwordEnabled}, showPassword=${formData.userPreferences.showPassword}`
    )
    logger.debug(`Loaded share options => ${JSON.stringify(formData.shareOptions)}`)
    logger.debug(`Loaded user preferences => shareSubdocuments=${formData.userPreferences.shareSubdocuments}`)
  }

  // ========================================
  // 单文档模式初始化流程
  // ========================================
  const initSingleDocMode = async () => {
    if (!isSingleDocMode) {
      logger.warn("initSingleDocMode called in non-single-doc mode, ignored")
      return
    }

    logger.info(`[Single Doc] Initializing single doc mode for docId: ${docId}`)

    // 加载配置
    const cfg = await pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)

    // 加载全局配置
    formData.userPreferences.shareSubdocuments = cfg?.appConfig?.shareSubdocuments ?? false
    // 加载增量分享配置
    formData.userPreferences.incrementalShareConfig.enabled = cfg?.appConfig?.incrementalShareConfig?.enabled ?? true

    // 加载文档设置
    await loadSingleDocSetting(cfg)

    // 加载基本信息
    const { blogApi } = useSiyuanApi(cfg)
    formData.post = await blogApi.getPost(docId)

    // 加载分享状态
    const docInfo = await shareService.getSharedDocInfo(docId, cfg?.serviceApiConfig?.token)
    formData.shared = docInfo.code === 0
    formData.shareData = docInfo?.data ? JSON.parse(docInfo.data) : null
    // 提取上次分享时间（从服务端返回的 createdAt 字段解析）
    const createdAtStr = formData.shareData?.createdAt
    formData.lastShareTime = createdAtStr ? new Date(createdAtStr).getTime() : null

    // 生成分享链接
    const customDomain = cfg?.appConfig?.domain ?? "https://siyuan.wiki"
    const customPath = cfg?.appConfig?.docPath ?? "s"
    formData.shareLink = `${customDomain}/${customPath}/${docId}`

    // 加载分享选项
    await loadShareOptions(cfg)

    logger.info(`[Single Doc] Initialization complete, shared: ${formData.shared}`)
  }

  // ========================================
  // 非单文档模式初始化流程
  // ========================================
  const initNonSingleDocMode = async () => {
    if (isSingleDocMode) {
      logger.warn("initNonSingleDocMode called in single-doc mode, ignored")
      return
    }

    logger.info("[Non-Single-Doc] Initializing non-single-doc mode")

    // 加载全局配置
    const cfg = await pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
    formData.userPreferences.shareSubdocuments = cfg?.appConfig?.shareSubdocuments ?? false
    // 加载增量分享配置
    formData.userPreferences.incrementalShareConfig.enabled = cfg?.appConfig?.incrementalShareConfig?.enabled ?? true

    // 非单文档模式不需要加载文档数据，UI会自动隐藏需要docId的功能
    logger.info("[Non-Single-Doc] Initialization complete, showing limited UI")
  }

  // ========================================
  // 统一初始化入口
  // ========================================
  const initPage = async () => {
    if (isSingleDocMode) {
      await initSingleDocMode()
    } else {
      await initNonSingleDocMode()
    }
  }

  onMount(async () => {
    await initPage()
  })

  // 清理订阅
  onDestroy(() => {
    unsubscribeError()
  })
</script>

<div id="share">
  <ProgressManager {pluginInstance} />

  <!-- 大厂设计：错误状态警告条 - 参考阿里云/字节设计规范 -->
  {#if errorState.hasError}
    <div
      class="error-banner"
      on:click={handleErrorBannerClick}
      on:keydown={(e) => e.key === "Enter" && handleErrorBannerClick()}
      role="button"
      tabindex="0"
    >
      <span class="error-banner-icon">⚠️</span>
      <span class="error-banner-text">
        {pluginInstance.i18n["shareUI"]["errorBannerText"]}
      </span>
      <span class="error-banner-action">{pluginInstance.i18n["shareUI"]["viewDetails"]}</span>
      <button
        class="error-banner-close"
        on:click|stopPropagation={handleDismissError}
        title={pluginInstance.i18n["shareUI"]["dismissError"]}
      >
        ×
      </button>
    </div>
  {/if}

  <!-- 错误详情弹窗 - 使用 Confirm 组件实现 -->
  <Confirm
    show={showErrorDetails}
    title={pluginInstance.i18n["shareUI"]["errorDetailsTitle"]}
    message={generateErrorMessage()}
    confirmText={pluginInstance.i18n["shareUI"]["clearError"]}
    cancelText={pluginInstance.i18n["cancel"]}
    onConfirm={() => {
      handleCloseErrorDetails()
      handleDismissError()
    }}
    onCancel={handleCloseErrorDetails}
  />

  <Confirm
    show={showSubdocumentConfirm}
    title={subdocumentConfirmConfig.title}
    message={subdocumentConfirmConfig.message}
    onConfirm={() => {
      subdocumentConfirmConfig.onConfirm()
      showSubdocumentConfirm = false
    }}
    onCancel={() => {
      subdocumentConfirmConfig.onCancel()
      showSubdocumentConfirm = false
    }}
  />
  <Confirm
    show={showReferenceConfirm}
    title={referenceConfirmConfig.title}
    message={referenceConfirmConfig.message}
    onConfirm={() => {
      referenceConfirmConfig.onConfirm()
      showReferenceConfirm = false
    }}
    onCancel={() => {
      referenceConfirmConfig.onCancel()
      showReferenceConfirm = false
    }}
  />
  <!-- 操作遮罩层 -->
  {#if formData.operationState.status === "sharing" || formData.operationState.status === "canceling"}
    <div class="operation-overlay">
      <div class="overlay-content">
        <div class="loading-spinner-large" />
        <div class="overlay-message">
          {#if formData.operationState.status === "sharing"}
            {pluginInstance.i18n["ui"]["sharingIng"]}
          {:else if formData.operationState.status === "canceling"}
            {pluginInstance.i18n["ui"]["cancelingIng"]}
          {/if}
        </div>
      </div>
    </div>
  {/if}
  {#if isSingleDocMode && typeof formData.post.title === "undefined"}
    <!-- 单文档模式但加载中 -->
    <div class="professional-loading">
      <div class="professional-spinner" />
      <span class="professional-loading-text">加载中...</span>
    </div>
  {:else}
    <!-- 基本布局：始终显示 -->
    <div class="share-header">
      <div class="share-title-row">
        {#if isSingleDocMode}
          <!-- 单文档模式：显示文档标题 -->
          <div class="share-title-wrapper">
            <div class="share-title">{formData.post.title}</div>
            {#if formData.shared && formData.lastShareTime}
              <div class="last-share-time" title={new Date(formData.lastShareTime).toLocaleString()}>
                {pluginInstance.i18n["lastShareTime"]["label"]}：{formatLastShareTime(formData.lastShareTime)}
              </div>
            {/if}
          </div>
        {:else}
          <!-- 非单文档模式：显示通用标题 -->
          <div class="share-title">{pluginInstance.i18n["sharePro"]}</div>
        {/if}

        <!-- 全局功能按钮：不需要docId，始终显示 -->
        <div class="global-actions">
          {#if formData.userPreferences.incrementalShareConfig.enabled === true}
            <button
              type="button"
              class="action-btn"
              title={pluginInstance.i18n["incrementalShare"]["title"]}
              on:click={() => pluginInstance.showIncrementalShareUI()}
            >
              {@html icons.iconIncremental}
            </button>
          {/if}
          <button
            type="button"
            class="action-btn"
            title={pluginInstance.i18n["manageDoc"]}
            on:click={() => showManageDialog()}
          >
            {@html icons.iconManage}
          </button>
          <button
            type="button"
            class="action-btn"
            title={pluginInstance.i18n["shareSetting"]}
            on:click={() => pluginInstance.openSetting()}
          >
            {@html icons.iconSettings}
          </button>
        </div>
      </div>
    </div>
    <div class="divider" />

    <div class="share-settings">
      <div class="setting-row">
        <span class="setting-label">
          {pluginInstance.i18n["sharePro"]} - {pluginInstance.i18n["shareProDesc"]}
        </span>

        {#if isSingleDocMode}
          <!-- 单文档功能按钮：需要docId，仅单文档模式显示 -->
          <div class="doc-actions">
            {#if formData.shared}
              <button type="button" class="action-btn" title={pluginInstance.i18n["reShare"]} on:click={handleReShare}>
                {@html icons.iconReShare}
              </button>
            {/if}
            <!-- 核心操作按钮 - 付费软件专业设计 -->
            <button
              class="primary-action-btn {formData.shared ? 'cancel-share' : ''}"
              on:click={handleShare}
              disabled={formData.operationState.status === "sharing" || formData.operationState.status === "canceling"}
              title={formData.shared ? pluginInstance.i18n["cancelShare"] : pluginInstance.i18n["startShare"]}
            >
              {#if formData.operationState.status === "sharing"}
                <span class="loading-spinner" />
                {pluginInstance.i18n["startShare"]}
              {:else if formData.operationState.status === "canceling"}
                <span class="loading-spinner" />
                {pluginInstance.i18n["cancelShare"]}
              {:else if formData.shared}
                {pluginInstance.i18n["cancelShare"]}
              {:else}
                {pluginInstance.i18n["startShare"]}
              {/if}
            </button>
          </div>
        {/if}
      </div>
    </div>

    {#if isSingleDocMode && formData.shared && !formData.lock}
      <!-- 单文档模式且已分享：显示详细选项 -->
      <div class="setting-row">
        <span class="setting-label">{pluginInstance.i18n["ui"]["copyTitle"]}</span>
        <div class="input-group">
          <input
            type="text"
            bind:value={formData.shareLink}
            readonly
            class="share-link-input"
            on:click={viewDoc}
            title={pluginInstance.i18n["ui"]["clickView"]}
          />
          <button on:click={copyWebLink}>{pluginInstance.i18n["ui"]["copyWebLink"]}</button>
        </div>
      </div>

      <div class="divider" />
    {/if}

    {#if isSingleDocMode}
      <!-- 单文档模式：紧凑分享配置 -->
      <div class="setting-row">
        <span class="setting-label">分享配置</span>
        <div class="input-group compact-share-config">
          <!-- 子文档分享 -->
          <label class="compact-switch">
            <input
              type="checkbox"
              checked={formData.singleDocSetting.shareSubdocuments}
              on:change={(e) => handleSubdocumentShareChange(e)}
              title={formData.singleDocSetting.shareSubdocuments
                ? pluginInstance.i18n["cs"]["shareSubdocumentsDisabled"]
                : pluginInstance.i18n["cs"]["shareSubdocumentsEnabled"]}
            />
            <span class="compact-label">{pluginInstance.i18n["cs"]["shareSubdocuments"]}</span>
          </label>

          <!-- 引用文档分享 -->
          <label class="compact-switch">
            <input
              type="checkbox"
              checked={formData.singleDocSetting.shareReferences}
              on:change={(e) => handleReferenceShareChange(e)}
              title={formData.singleDocSetting.shareReferences
                ? pluginInstance.i18n["cs"]["shareReferencesDisabled"]
                : pluginInstance.i18n["cs"]["shareReferencesEnabled"]}
            />
            <span class="compact-label">{pluginInstance.i18n["cs"]["shareReferences"]}</span>
          </label>

          <!-- 文档树 -->
          <label class="compact-switch">
            <input
              type="checkbox"
              bind:checked={formData.singleDocSetting.docTreeEnable}
              title={formData.singleDocSetting.docTreeEnable
                ? pluginInstance.i18n["cs"]["docTreeDisabled"]
                : pluginInstance.i18n["cs"]["docTreeEnabled"]}
            />
            <span class="compact-label">{pluginInstance.i18n["cs"]["docTree"]}</span>
          </label>

          <!-- 文档大纲 -->
          <label class="compact-switch">
            <input
              type="checkbox"
              bind:checked={formData.singleDocSetting.outlineEnable}
              title={formData.singleDocSetting.outlineEnable
                ? pluginInstance.i18n["cs"]["outlineDisabled"]
                : pluginInstance.i18n["cs"]["outlineEnabled"]}
            />
            <span class="compact-label">{pluginInstance.i18n["cs"]["outline"]}</span>
          </label>
        </div>
      </div>

      <!-- 深度控制（按需显示） -->
      {#if formData.singleDocSetting.docTreeEnable || formData.singleDocSetting.outlineEnable}
        <div class="setting-row">
          <span class="setting-label" />
          <div class="input-group compact-depth-config">
            {#if formData.singleDocSetting.docTreeEnable}
              <div class="depth-item">
                <span class="depth-label">{pluginInstance.i18n["cs"]["docTreeDepth"]}</span>
                <select bind:value={formData.singleDocSetting.docTreeLevel} class="b3-select compact-select">
                  {#each [1, 2, 3, 4, 5, 6] as level}
                    <option value={level}>{level}</option>
                  {/each}
                </select>
              </div>
            {/if}

            {#if formData.singleDocSetting.outlineEnable}
              <div class="depth-item">
                <span class="depth-label">{pluginInstance.i18n["cs"]["outlineDepth"]}</span>
                <select bind:value={formData.singleDocSetting.outlineLevel} class="b3-select compact-select">
                  {#each [{ label: "h1", value: 1 }, { label: "h2", value: 2 }, { label: "h3", value: 3 }, { label: "h4", value: 4 }, { label: "h5", value: 5 }, { label: "h6", value: 6 }] as item}
                    <option value={item.value}>{item.label}</option>
                  {/each}
                </select>
              </div>
            {/if}
          </div>
        </div>
      {/if}

      <!-- 子文档数量限制 -->
      {#if formData.singleDocSetting.shareSubdocuments}
        <!-- 子文档树预览 -->
        <div class="subdocument-preview-section">
          <SubdocumentTreePreview
            {pluginInstance}
            {docId}
            onSubdocumentSelect={(selectedDocIds) => {
              // 保存用户选择的子文档ID到文档设置
              formData.singleDocSetting.selectedSubdocIds = selectedDocIds
              logger.debug("Selected subdocuments:", selectedDocIds)
            }}
          />
        </div>
      {/if}
    {/if}

    {#if isSingleDocMode && formData.shared && !formData.lock}
      <!-- 单文档模式且已分享：显示详细选项 -->
      <div class="share-content">
        <div class="divider" />

        <div class="setting-row">
          <span class="setting-label">{pluginInstance.i18n["ui"]["passwordTitle"]}</span>
          <div class="password-container">
            <input
              type="checkbox"
              bind:checked={formData.shareOptions.passwordEnabled}
              class="b3-switch fn__flex-center password-toggle"
              title={formData.shareOptions.passwordEnabled
                ? pluginInstance.i18n["ui"]["passwordDisabled"]
                : pluginInstance.i18n["ui"]["passwordEnabled"]}
              on:change={handlePasswordChange}
            />
            {#if formData.shareOptions.passwordEnabled}
              <div class="password-input-container">
                {#if formData.userPreferences.showPassword}
                  <input
                    type="text"
                    bind:value={formData.shareOptions.password}
                    placeholder={pluginInstance.i18n["ui"]["passwordPlaceholder"]}
                    class="password-input"
                    title={pluginInstance.i18n["ui"]["passwordTip"]}
                    on:blur={handlePasswordChange}
                    on:keydown={(e) => e.key === "Enter" && handlePasswordChange()}
                  />
                {:else}
                  <input
                    type="password"
                    bind:value={formData.shareOptions.password}
                    placeholder={pluginInstance.i18n["ui"]["passwordPlaceholder"]}
                    class="password-input"
                    title={pluginInstance.i18n["ui"]["passwordTip"]}
                    on:blur={handlePasswordChange}
                    on:keydown={(e) => e.key === "Enter" && handlePasswordChange()}
                  />
                {/if}
                <button
                  type="button"
                  class="password-visibility-toggle"
                  on:click={(event) => {
                    event.stopPropagation()
                    formData.userPreferences.showPassword = !formData.userPreferences.showPassword
                  }}
                  title={formData.userPreferences.showPassword
                    ? pluginInstance.i18n["ui"]["hidePassword"]
                    : pluginInstance.i18n["ui"]["showPassword"]}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    {#if formData.userPreferences.showPassword}
                      <path
                        fill="currentColor"
                        d="M11.83 9L15 12.16V12a3 3 0 0 0-3-3h-.17m-4.3.8l1.55 1.55c-.05.21-.08.42-.08.65a3 3 0 0 0 3 3c.22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53a5 5 0 0 1-5-5c0-.79.2-1.53.53-2.2M2 4.27l2.28 2.28l.45.45C3.08 8.3 1.78 10 1 12c1.73 4.39 6 7.5 11 7.5c1.55 0 3.03-.3 4.38-.84l.43.42L19.73 22 21 20.73 3.27 3M12 7a5 5 0 0 1 5 5c0 .64-.13 1.26-.36 1.82l2.93 2.93c1.5-1.25 2.7-2.89 3.43-4.75c-1.73-4.39-6-7.5-11-7.5S2.73 16.39 1 12c1.73-4.39 6-7.5 11-7.5M3.18 12a9.821 9.821 0 0 0 17.64 0a9.821 9.821 0 0 0-17.64 0z"
                      />
                    {:else}
                      <path
                        fill="currentColor"
                        d="M12 9a3 3 0 0 1 3 3a3 3 0 0 1-3 3a3 3 0 0 1-3-3a3 3 0 0 1 3-3m0-4.5c5 0 9.27 3.11 11 7.5c-1.73 4.39-6 7.5-11 7.5S2.73 16.39 1 12c1.73-4.39 6-7.5 11-7.5M3.18 12a9.821 9.821 0 0 0 17.64 0a9.821 9.821 0 0 0-17.64 0z"
                      />
                    {/if}
                  </svg>
                </button>
                <button
                  type="button"
                  class="password-visibility-toggle"
                  on:click={(event) => {
                    event.stopPropagation()
                    formData.shareOptions.password = PasswordUtils.getNewRndPassword()
                    handlePasswordChange()
                  }}
                  title={pluginInstance.i18n["ui"]["refreshPassword"]}
                >
                  {@html icons.iconReShare}
                </button>
              </div>
            {/if}
          </div>
        </div>

        <div class="setting-row">
          <span class="setting-label">{pluginInstance.i18n["ui"]["expiresTitle"]}</span>
          <div class="input-group">
            <input
              type="number"
              bind:value={formData.singleDocSetting.expiresTime}
              min="0"
              max="604800"
              step="1"
              class="share-expired-input"
              placeholder={pluginInstance.i18n["ui"]["expiresPlaceholder"]}
              title={pluginInstance.i18n["ui"]["expiresTip"]}
            />
            <button on:click={handleExpiresTime}>{pluginInstance.i18n["ui"]["saveExpires"]}</button>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style lang="stylus">
  #share
    /* 基础样式 */
    // 尽量继承宿主的字体，不要单独搞一套
    //font-family "Open Sans", "LXGW WenKai", "JetBrains Mono", "-apple-system", "Microsoft YaHei", "Times New Roman",
    //"方正北魏楷书_GBK", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans",
    //"Droid Sans", "Helvetica Neue", sans-serif
    max-width 600px
    min-width auto
    margin auto
    padding 8px
    padding-top 10px
    padding-bottom 0
    padding-left 14px
    padding-right 14px

    @media (min-width: 768px)
      min-width 475px

    .share-header
      font-size 14px
      font-weight 600

    .share-title-row
      display flex
      align-items center
      justify-content space-between
      gap 12px

    .share-title-wrapper
      display flex
      flex-direction column
      flex-grow 1
      gap 4px

    .share-title
      flex-grow 1

    .last-share-time
      font-size 12px
      color var(--b3-theme-on-surface-light)
      opacity 0.75
      font-weight 400
      line-height 1.4
      letter-spacing 0.2px
      transition opacity 0.2s ease, color 0.2s ease

      &:hover
        opacity 1
        color var(--b3-theme-on-surface)

    // 大厂设计：错误警告条样式（参考阿里云/字节设计规范）
    .error-banner
      display flex
      align-items center
      gap 8px
      padding 10px 14px
      margin-bottom 12px
      background-color #fff2f0
      border 1px solid #ffccc7
      border-radius 6px
      color #f5222d
      font-size 13px
      cursor pointer
      transition all 0.2s ease
      box-shadow 0 2px 8px rgba(245, 34, 45, 0.08)

      &:hover
        background-color #fff1f0
        border-color #ffa39e
        box-shadow 0 4px 12px rgba(245, 34, 45, 0.12)

    .error-banner-icon
      font-size 16px
      flex-shrink 0

    .error-banner-text
      flex-grow 1
      font-weight 500

    .error-banner-action
      color #f5222d
      font-weight 600
      text-decoration underline
      text-underline-offset 2px
      flex-shrink 0

    .error-banner-close
      background none
      border none
      color #f5222d
      font-size 18px
      cursor pointer
      padding 0 4px
      line-height 1
      opacity 0.6
      transition opacity 0.2s ease
      flex-shrink 0

      &:hover
        opacity 1

    // 暗色模式适配
    html[data-theme-mode="dark"] #share
      .error-banner
        background-color rgba(245, 34, 45, 0.15)
        border-color rgba(245, 34, 45, 0.3)
        color #ff7875

        &:hover
          background-color rgba(245, 34, 45, 0.2)
          border-color rgba(245, 34, 45, 0.4)

      .error-banner-action
        color #ff7875

      .error-banner-close
        color #ff7875

    .global-actions
      display flex
      align-items center
      gap 8px
      flex-shrink 0

    .divider
      height 1px
      margin 8px 0
      background-color #e0e0e0

    .professional-loading
      display flex
      flex-direction column
      justify-content center
      align-items center
      min-height 120px
      padding 24px
      gap 16px

    .professional-spinner
      width 32px
      height 32px
      border 3px solid transparent
      border-top 3px solid var(--b3-theme-primary)
      border-radius 50%
      animation spin 1s ease-in-out infinite
      box-shadow 0 4px 12px rgba(24, 144, 255, 0.2)

    .professional-loading-text
      font-size 14px
      font-weight 500
      color var(--b3-theme-on-surface)
      opacity 0.9

    @keyframes spin
      from
        transform rotate(0deg)
      to
        transform rotate(360deg)

    .share-content
      margin-top 14px

    .input-group input,
    .password-input,
    .share-expired-input
      &:focus
        border-color: #1890ff  /* Ant Design主蓝色 */
        box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2)  /* 标准Ant Design阴影 */
        outline: none
        transition: all 0.3s cubic-bezier(0.645, 0.045, 0.355, 1)  /* Ant Design标准过渡 */

    /* 紧凑分享配置样式 */
    .compact-share-config
      display flex
      gap 12px
      align-items center
      flex-wrap wrap

    .compact-switch
      display flex
      align-items center
      gap 4px
      cursor pointer
      padding 4px 8px
      border-radius 4px
      transition background-color 0.2s

    .compact-switch:hover
      background-color var(--b3-theme-surface-light)

    .compact-switch input[type="checkbox"]
      width 16px
      height 16px
      margin 0
      cursor pointer

    .compact-label
      font-size 12px
      color var(--b3-theme-on-background)
      white-space nowrap

    .compact-depth-config
      display flex
      gap 12px
      align-items center
      flex-wrap wrap

    .depth-item
      display flex
      align-items center
      gap 6px

    .depth-label
      font-size 12px
      color var(--b3-theme-on-background)
      white-space nowrap

    .compact-select
      width auto
      min-width 60px
      font-size 12px
      padding 2px 8px

    html[data-theme-mode="dark"] #share
      .input-group input:focus,
      .password-input:focus,
      .share-expired-input:focus
        border-color: #177ddc  /* 暗色主蓝 */
        box-shadow: 0 0 0 2px rgba(23, 125, 220, 0.2)  /* 暗色阴影 */

    .setting-row
      display flex
      align-items center
      justify-content space-between
      margin-bottom 8px
      gap 6px


    .setting-label
      font-size 14px
      white-space nowrap
      margin-right 8px
      color var(--b3-theme-on-surface)

    .input-group
      display flex
      align-items center
      gap 6px
      flex-grow 1
      width 100%

    button
      padding 3px 10px
      font-size 13px
      color #ffffff
      border none
      border-radius 4px
      cursor pointer
      background-color #0073e6
      transition all 0.2s ease
      white-space nowrap
      flex-shrink 0
      height 26px
      line-height 20px

      &:hover
        background-color #005bb5
        box-shadow 0 2px 4px rgba(0, 0, 0, 0.1)

      &:active
        background-color #004999
        transform translateY(1px)

    .password-container
      display flex
      align-items center
      gap 6px
      width 100%

    .input-group input
      flex-grow 1
      height 28px
      padding 4px 8px
      border 1px solid #cccccc
      border-radius 4px
      font-size 14px
      background-color #f9f9f9
      color #333333
      box-sizing border-box
      min-width 0
      transition all 0.2s ease

    .input-group input[readonly]
      color #aaa
      cursor pointer

    .share-link-input
      height 28px
      padding 4px 8px
      border 1px solid #cccccc
      border-radius 4px
      font-size 14px
      background-color #f0f0f0
      color #aaaaaa
      box-sizing border-box
      cursor pointer
      transition all 0.2s ease

      &:hover
        background-color #e6e6e6

    .doc-actions
      display flex
      align-items center
      gap 12px

    .action-btn
      display inline-flex
      cursor pointer
      transition all 0.3s ease
      font-size 16px
      line-height 1
      color #333
      padding 4px
      border-radius 4px
      background-color transparent
      border none
      outline none

      &:hover
        background-color rgba(0, 115, 230, 0.1)
        color #0073e6

      &:focus
        outline none

      svg
        width 16px
        height 16px

    .password-input-container
      position relative
      flex-grow 1
      min-width 0
      display flex
      align-items center

    .password-input
      flex-grow 1
      padding-right 70px
      height 24px
      padding-left 4px
      border 1px solid #cccccc
      border-radius 4px
      font-size 14px
      background-color #f9f9f9
      color #333333
      transition all 0.2s ease

    .share-expired-input
      flex-grow 1
      height 28px
      padding 4px 8px
      border 1px solid #cccccc
      border-radius 4px
      font-size 14px
      background-color #f9f9f9
      color #333333
      box-sizing border-box
      min-width 0
      transition all 0.2s ease

    .password-visibility-toggle
      position absolute
      right 36px
      top 0
      height 28px
      background none
      border none
      cursor pointer
      padding 0
      width 24px
      color var(--b3-theme-on-surface)
      z-index 1
      display flex
      align-items center
      justify-content center
      opacity 0.7
      transition all 0.2s ease

      &:hover
        opacity 1
        color var(--b3-theme-primary)
        background-color rgba(0, 115, 230, 0.1)

      svg
        width 16px
        height 16px

    .password-visibility-toggle + .password-visibility-toggle
      right 8px
      width 24px

    .subdocument-preview-section
      margin-top 12px
      border-top 1px solid var(--b3-theme-surface-light)

    .progress-section
      margin-top 12px
      padding 12px
      background-color var(--b3-theme-surface-light)
      border-radius 4px

    .progress-bar
      width 100%
      height 8px
      background-color var(--b3-theme-surface)
      border-radius 4px
      overflow hidden

    .progress-fill
      height 100%
      background-color var(--b3-theme-primary)
      transition width 0.3s ease

    .progress-text
      margin-top 4px
      font-size 12px
      color var(--b3-theme-on-surface)
      text-align center

    .cancel-btn
      margin-top 8px
      padding 4px 12px
      font-size 12px
      background-color var(--b3-theme-error)
      color white
      border none
      border-radius 3px
      cursor pointer
      transition all 0.2s ease

      //&:hover
      //  background-color darken(var(--b3-theme-error), 10%)

    /* 暗色模式 */
    html[data-theme-mode="dark"] #share
      .divider
        background-color #444

      .setting-label
        color var(--b3-theme-on-background)

      .input-group input
        border-color #444444
        background-color #2c2c2c
        color var(--b3-theme-on-background)

      .input-group input[readonly]
        color #777

      .share-link-input
        background-color #333
        color #999

        &:hover
          background-color #3a3a3a

      .password-input
        border-color #444444
        background-color #2c2c2c
        color var(--b3-theme-on-background)

      .share-expired-input
        border-color #444444
        background-color #2c2c2c
        color var(--b3-theme-on-background)

      .password-visibility-toggle
        color var(--b3-theme-on-background)

        &:hover
          color var(--b3-theme-primary)
          background-color rgba(0, 115, 230, 0.2)

      .action-btn
        color var(--b3-theme-on-background)

        &:hover
          color var(--b3-theme-primary)
          background-color rgba(0, 115, 230, 0.2)

      .b3-switch.fn__flex-center
        background-color: #555

        &::after
          background-color: #ddd

        &:checked
          background-color: #0073e6

    /* 核心操作按钮 - 付费软件专业设计 */
    .primary-action-btn
      padding 6px 12px
      font-size 13px
      color white
      border none
      border-radius 4px
      cursor pointer
      background-color #0073e6
      transition all 0.2s ease
      height 28px
      line-height 18px
      font-weight 500
      display flex
      align-items center
      gap 6px
      width auto
      max-width 100%

    /* 取消分享状态 - 红色背景 */
    .primary-action-btn.cancel-share
      background-color #f5222d

    .primary-action-btn.cancel-share:hover:not(:disabled)
      background-color #d91a21
      box-shadow 0 2px 8px rgba(245, 34, 45, 0.3)

    .primary-action-btn.cancel-share:active:not(:disabled)
      background-color #b3161d

      &:hover:not(:disabled)
        background-color #005bb5
        box-shadow 0 2px 8px rgba(0, 115, 230, 0.3)

      &:active:not(:disabled)
        background-color #004999
        transform translateY(1px)

      &:disabled
        background-color #cccccc
        cursor not-allowed
        opacity 0.7

    .loading-spinner,
    .loading-spinner-large
      width 16px
      height 16px
      border 2px solid transparent
      border-top 2px solid currentColor
      border-radius 50%
      animation spin 1s linear infinite

    .loading-spinner-large
      width 24px
      height 24px
      border-width 3px

    @keyframes spin
      from
        transform rotate(0deg)
      to
        transform rotate(360deg)

    /* 操作遮罩层 */
    .operation-overlay
      position absolute
      top 0
      left 0
      right 0
      bottom 0
      background-color rgba(0, 0, 0, 0.6)
      z-index 1000
      display flex
      align-items center
      justify-content center
      border-radius 8px

    .overlay-content
      text-align center
      color white

    .overlay-message
      margin-top 12px
      font-size 16px
      font-weight 500
</style>
