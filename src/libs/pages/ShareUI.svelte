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
    password: "",
    passwordEnabled: false,
    showPassword: false
  }

  const handleShare = async () => {
    if (formData.shared) {
      // 分享
      try {
        await shareService.createShare(docId, undefined, {
          passwordEnabled: formData.passwordEnabled,
          password: formData.password
        })
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
    await shareService.createShare(docId, undefined, {
      passwordEnabled: formData.passwordEnabled,
      password: formData.password
    })
  }

  const handlePasswordChange = async () => {
    if (formData.shared) {
      try {
        await shareService.updateShareOptions(docId, {
          passwordEnabled: formData.passwordEnabled,
          password: formData.password
        })
        showMessage(pluginInstance.i18n["ui"]["updateOptionsSuccess"], 3000, "info")
      } catch (e) {
        showMessage(pluginInstance.i18n["ui"]["updateOptionsError"], 3000, "error")
      }
    }
  }

  const copyWebLink = () => {
    let copyText = formData.shareLink
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
      if(formData.passwordEnabled){
          // copyText = copyText.replace(/\[password]/g, formData.password)
          copyText = copyText + " " + pluginInstance.i18n["cs"]["visitPassword"] + formData.password
      }
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

  const getNewRndPassword = ()=>{
      return Math.random().toString(36).substring(2, 15)
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

    // 初始化密码设置
    formData.passwordEnabled = formData.shareData?.passwordEnabled || cfg.appConfig?.passwordEnabled || false
    formData.showPassword = cfg.appConfig?.showPassword || false
    if (formData.passwordEnabled) {
        const rndPassword = getNewRndPassword()
        formData.password = formData.shareData?.password || rndPassword
    } else {
        formData.password = formData.shareData?.password || ""
    }
    logger.info(`get password option => passwordEnabled=${formData.passwordEnabled}, showPassword=${formData.showPassword}`)
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
          {pluginInstance.i18n["sharePro"]} - {pluginInstance.i18n["shareProDesc"]}
        </span>

        <div class="reshare-container">
          {#if formData.shared}
            <span class="reshare-btn" title={pluginInstance.i18n["reShare"]} on:click={handleReShare}>
              {@html icons.iconReShare}
            </span>
          {/if}
          <input
            title={formData.shared ? pluginInstance.i18n["cancelShare"] : pluginInstance.i18n["startShare"]}
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

        <!-- 密码设置 -->
        <div class="setting-row">
          <span class="setting-label">{pluginInstance.i18n["ui"]["passwordTitle"]}</span>
          <div class="password-container">
            <input
              type="checkbox"
              bind:checked={formData.passwordEnabled}
              class="b3-switch fn__flex-center password-toggle"
              title={formData.passwordEnabled ? pluginInstance.i18n["ui"]["passwordDisabled"] : pluginInstance.i18n["ui"]["passwordEnabled"]}
              on:change={handlePasswordChange}
            />
            {#if formData.passwordEnabled}
              <div class="password-input-container">
                <input
                    type={formData.showPassword ? "text" : "password"}
                    value={formData.password}
                    placeholder={pluginInstance.i18n["ui"]["passwordPlaceholder"]}
                    class="password-input"
                    title={pluginInstance.i18n["ui"]["passwordTip"]}
                    on:blur={handlePasswordChange}
                />
                <button
                    type="button"
                    class="password-visibility-toggle"
                    on:click={(event) => {
                        event.stopPropagation()
                        formData.showPassword = !formData.showPassword
                    }}
                    title={formData.showPassword ? pluginInstance.i18n["ui"]["hidePassword"] : pluginInstance.i18n["ui"]["showPassword"]}
                >
                  {#if formData.showPassword}
                    <!-- 隐藏密码图标 -->
                    ***
                  {:else}
                    <!-- 显示密码图标 -->
                    <svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M12 9a3 3 0 0 1 3 3a3 3 0 0 1-3 3a3 3 0 0 1-3-3a3 3 0 0 1 3-3m0-4.5c5 0 9.27 3.11 11 7.5c-1.73 4.39-6 7.5-11 7.5S2.73 16.39 1 12c1.73-4.39 6-7.5 11-7.5M3.18 12a9.821 9.821 0 0 0 17.64 0a9.821 9.821 0 0 0-17.64 0z"/></svg>
                  {/if}
                </button>
                <button
                    type="button"
                    class="password-visibility-toggle"
                    on:click={(event) => {
                        event.stopPropagation()
                        formData.password = getNewRndPassword()
                    }}
                    title={pluginInstance.i18n["ui"]["refreshPassword"]}
                >
                  <!-- 刷新密码图标 -->
                  <svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M12 9a3 3 0 0 1 3 3a3 3 0 0 1-3 3a3 3 0 0 1-3-3a3 3 0 0 1 3-3m0-4.5c5 0 9.27 3.11 11 7.5c-1.73 4.39-6 7.5-11 7.5S2.73 16.39 1 12c1.73-4.39 6-7.5 11-7.5M3.18 12a9.821 9.821 0 0 0 17.64 0a9.821 9.821 0 0 0-17.64 0z"/></svg>
                </button>
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style lang="stylus">
#share
  font-family "Open Sans", "LXGW WenKai", "JetBrains Mono", "-apple-system", "Microsoft YaHei", "Times New Roman",
  "方正北魏楷书_GBK", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans",
  "Droid Sans", "Helvetica Neue", sans-serif
  max-width 600px
  //min-width 475px
  min-width auto
  margin auto
  padding 8px
  padding-top 10px
  padding-bottom 0
  padding-left 14px
  padding-right 14px

  /* 添加媒体查询，仅在 PC 端应用 min-width */
  @media (min-width: 768px)
    min-width 475px

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

  button:hover
    background-color #005bb5

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
    color #333

  .password-container
    display flex
    align-items center
    gap 8px
    width 100%

  .password-input-container
    position relative
    flex-grow 1
    min-width 0

  .password-input
    width 100%
    box-sizing border-box
    height 28px
    padding 4px 8px
    border 1px solid #cccccc
    border-radius 4px
    font-size 14px
    background-color #f9f9f9
    color #333333
    min-width 0

  .password-visibility-toggle
    position absolute
    right 8px
    top 50%
    transform translateY(-50%)
    background none
    border none
    cursor pointer
    padding 0
    color var(--b3-theme-on-surface)
    &:hover
      background none
      border none
      color var(--b3-theme-on-surface) !important
      opacity 0.8

html[data-theme-mode="light"] #share
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

html[data-theme-mode="dark"] #share
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

  .password-input
    border-color #444444
    background-color #2c2c2c
    color var(--b3-theme-on-background)

  .password-input:focus
    border-color #0073e6
    background-color #3a3a3a
    box-shadow 0 0 4px rgba(0, 115, 230, 0.5)

  //.input-group select
  //  border-color #444444
  //  color var(--b3-theme-on-background)
  //  background-color #2c2c2c
  //
  //.input-group select option
  //  color var(--b3-theme-on-background)
  //  background-color #444444
  //
  //  &:hover, &:focus
  //    background-color #555555
  //    color #ffffff

  .reshare-btn
    color #fff
</style>
