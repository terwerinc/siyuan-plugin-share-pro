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
  import { onMount } from "svelte"
  import { Post } from "zhi-blog-api"
  import { simpleLogger } from "zhi-lib-base"
  import { useSiyuanApi } from "../../composables/useSiyuanApi"
  import { isDev, SHARE_PRO_STORE_NAME } from "../../Constants"
  import ShareProPlugin from "../../index"
  import { ShareProConfig } from "../../models/ShareProConfig"
  import { ShareService } from "../../service/ShareService"
  import { icons } from "../../utils/svg"

  export let pluginInstance: ShareProPlugin
  export let shareService: ShareService
  export let docId: string

  const logger = simpleLogger("share-ui", "share-pro", isDev)
  let singleDocSetting: any

  let formData = {
    post: Post as any,
    shared: false,
    shareData: {} as any,
    lock: false,

    shareLink: "",
  }

  const handleShare = async () => {
    if (formData.shared) {
      // 分享
      try {
        await shareService.createShare(docId)
      } catch (e) {
        formData.shared = false
        showMessage(pluginInstance.i18n["ui"]["shareSuccessError"], 3000, "info")
      }
    } else {
      // 状态检测
      logger.info("get shared data =>", formData.shareData)
      // 注意 undefined
      if (formData?.shareData?.shareStatus && formData.shareData.shareStatus !== "COMPLETED") {
        formData.lock = true
        showMessage(pluginInstance.i18n["ui"]["msgIngError"], 3000, "info")
        return
      }
      // 取消分享
      const ret = await shareService.deleteDoc(docId)
      if (ret.code === 0) {
        showMessage(pluginInstance.i18n["topbar"]["cancelSuccess"], 3000, "info")
      } else {
        showMessage(pluginInstance.i18n["topbar"]["cancelError"] + ret.msg, 7000, "error")
      }
    }
  }

  const handleReShare = async () => {
    await shareService.createShare(docId)
  }

  const copyWebLink = () => {
    const copyText = formData.shareLink
    // const shareTemplate =
    //         (StrUtil.isEmptyString(formData.setting.shareTemplate) ? formData.shareLink : formData.setting.shareTemplate) ?? formData.shareLink
    // const copyText = shareTemplate
    //         .replace(
    //                 /\[expired]/g,
    //                 StrUtil.isEmptyString(formData.expiredTime) || formData.expiredTime.toString().trim() === "0"
    //                         ? "永久"
    //                         : formData.expiredTime
    //         )
    //         .replace(/\[title]/g, formData.post.title)
    //         .replace(/\[url]/g, formData.shareLink)
    copy(copyText)
    showMessage(pluginInstance.i18n["ui"]["copySuccess"], 3000, "info")
  }

  const viewDoc = () => {
    window.open(formData.shareLink)
  }

  const initSingleDocSetting = async (cfg: ShareProConfig) => {
    const singleDocSettingKey = "share-pro-setting"
    const { kernelApi } = useSiyuanApi(cfg)
    singleDocSetting = await kernelApi.getSingleBlockAttr(docId, singleDocSettingKey)
    // 初始化
    if (!singleDocSetting) {
      singleDocSetting = {}
      await kernelApi.setSingleBlockAttr(docId, singleDocSettingKey, JSON.stringify({}))
    }
    // 同步配置
    const { docTreeEnable, docTreeLevel, outlineEnable, outlineLevel } = singleDocSetting
    cfg.siyuanConfig.preferenceConfig = {
      ...cfg.siyuanConfig.preferenceConfig,
      docTreeEnable: docTreeEnable ?? cfg.siyuanConfig?.preferenceConfig?.docTreeEnable ?? false,
      docTreeLevel: docTreeLevel ?? cfg.siyuanConfig?.preferenceConfig?.docTreeLevel ?? 3,
      outlineEnable: outlineEnable ?? cfg.siyuanConfig?.preferenceConfig?.outlineEnable ?? false,
      outlineLevel: outlineLevel ?? cfg.siyuanConfig?.preferenceConfig?.outlineLevel ?? 6,
    }
  }

  onMount(async () => {
    // 初始化单篇文档分享设置
    const cfg = await pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
    await initSingleDocSetting(cfg)
    // 初始化文档
    const { blogApi } = useSiyuanApi(cfg)
    formData.post = await blogApi.getPost(docId)
    // 获取分享信息
    const docInfo = await shareService.getSharedDocInfo(docId)
    formData.shared = docInfo.code === 0
    formData.shareData = docInfo?.data ? JSON.parse(docInfo.data) : null
    // 分享链接
    const customDomain = cfg?.appConfig?.domain ?? "https://siyuan.wiki"
    const customPath = cfg?.appConfig?.docPath ?? "s"
    formData.shareLink = `${customDomain}/${customPath}/${docId}`
  })
</script>

<div id="share">
  {#if typeof formData.post.title === "undefined"}
    <div class="loading-spinner">
      <div class="spinner" />
    </div>
  {:else}
    <div class="share-header">
      <div class="share-title">{formData.post.title}</div>
    </div>
    <div class="divider" />

    <div class="share-settings">
      <div class="setting-row">
        <span class="setting-label">
          {pluginInstance.i18n.sharePro} - {pluginInstance.i18n.shareProDesc}
        </span>

        <div class="reshare-container">
          {#if formData.shared}
            <span class="reshare-btn" title={pluginInstance.i18n.reShare} on:click={handleReShare}>
              {@html icons.iconReShare}
            </span>
          {/if}
          <input
            title={formData.shared ? pluginInstance.i18n.cancelShare : pluginInstance.i18n.startShare}
            class="b3-switch fn__flex-center share-btn"
            type="checkbox"
            bind:checked={formData.shared}
            on:change={handleShare}
          />
        </div>
      </div>
    </div>

    {#if formData.shared && !formData.lock}
      <div class="share-content">
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
      </div>
    {/if}
  {/if}
</div>

<style lang="stylus">
#share .reshare-btn
  color #333

html[data-theme-mode="dark"] #share .reshare-btn
  color #fff

#share
  font-family "Open Sans", "LXGW WenKai", "JetBrains Mono", "-apple-system", "Microsoft YaHei", "Times New Roman",
  "方正北魏楷书_GBK", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans",
  "Droid Sans", "Helvetica Neue", sans-serif
  max-width 600px
  min-width 475px
  margin auto
  padding 8px
  padding-top 10px
  padding-bottom 0
  padding-left 14px
  padding-right 14px

  .share-header
    font-size 14px
    font-weight 600

  .divider
    height 1px
    margin 8px 0

  .loading-spinner
    display flex
    justify-content center
    align-items center
    height 80px

  .spinner
    width 24px
    height 24px
    border 3px solid #ccc
    border-top 3px solid #0073e6
    border-radius 50%
    animation spin 1s linear infinite

  @keyframes spin
    from
      transform rotate(0deg)
    to
      transform rotate(360deg)

  .share-content
    margin-top 14px

  .setting-row
    display flex
    align-items center
    justify-content space-between
    margin-bottom 10px
    gap 8px

  .setting-label
    font-size 14px
    white-space nowrap /* 防止换行，字段宽度自适应 */
    margin-right 8px

  /* 与输入框保持适当间距 */

  .input-group
    display flex
    align-items center
    gap 8px
    flex-grow 1 /* 输入框占据剩余空间 */
    width 100%

  .input-group input,
  //.input-group select
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

  .input-group input[readonly]
    color #aaa

  /* 防止 flex 布局导致超出容器 */

  .input-group input:focus,
  //.input-group select:focus
    outline none
    border-color #0073e6
    box-shadow 0 0 4px rgba(0, 115, 230, 0.5)

  .share-link-input
    height 28px
    padding 4px 8px
    border 1px solid #cccccc
    border-radius 4px
    font-size 14px
    background-color #f0f0f0 /* 禁用时的背景色 */
    color #aaaaaa /* 禁用时的文字颜色 */
    box-sizing border-box
    cursor not-allowed

  /* 表明是不可交互的 */

  button
    padding 4px 12px
    font-size 14px
    color #ffffff
    border none
    border-radius 4px
    cursor pointer
    background-color #0073e6
    transition all 0.2s ease
    white-space nowrap /* 防止按钮内容换行 */
    flex-shrink 0

  /* 按钮保持固定大小 */

  button:hover
    background-color #005bb5
    transform scale(1.05)

  /* 重新分享 */
  .reshare-container
    display flex
    align-items center
    gap 12px
  .reshare-btn
    display inline-flex
    cursor pointer
    transition background-color 0.3s, box-shadow 0.3s
    font-size 16px
    line-height 1
    /* color 由顶部统一控制 */

//  .info-text
//    font-size 12px
//    margin-top 8px
//    margin-bottom 8px
//    color #ff4d4f
//
  html[data-theme-mode="light"]
    //.divider
    //  background-color #e3e3e3

    .input-group input,
    //.input-group select
      border-color #cccccc
      background-color #f9f9f9

    //.share-link-input
    //  border-color #cccccc
    //  background-color #f0f0f0
    //  color #aaaaaa

    //button
    //  background-color #0073e6
    //
    //button:hover
    //  background-color #005bb5

  html[data-theme-mode="dark"]
    //.divider
    //  background-color #333333

    .input-group input
      border-color #444444
      background-color #2c2c2c

    .input-group input:not([readonly])
      color var(--b3-theme-on-background)
      background-color #2c2c2c
      border-color #444444

    .input-group input:not([readonly]):focus
      border-color #0073e6
      background-color #3a3a3a
      box-shadow 0 0 4px rgba(0, 115, 230, 0.5)

//    .input-group select
//      border-color #444444
//      color var(--b3-theme-on-background)
//      background-color #2c2c2c
//
//    .input-group select option
//      color var(--b3-theme-on-background)
//      background-color #444444
//
//      &:hover, &:focus
//        background-color #555555
//        color #ffffff

    .share-link-input
      border-color #444444
      background-color #3a3a3a
      color #666666

    button
      background-color #0073e6

    button:hover
      background-color #005bb5
</style>
