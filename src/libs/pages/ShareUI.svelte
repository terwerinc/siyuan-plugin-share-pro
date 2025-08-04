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
        if(formData.passwordEnabled){
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
        if (!singleDocSetting) {
            singleDocSetting = {}
            await kernelApi.setSingleBlockAttr(docId, singleDocSettingKey, JSON.stringify({}))
        }
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
        const cfg = await pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
        await initSingleDocSetting(cfg)
        const { blogApi } = useSiyuanApi(cfg)
        formData.post = await blogApi.getPost(docId)
        const docInfo = await shareService.getSharedDocInfo(docId)
        formData.shared = docInfo.code === 0
        formData.shareData = docInfo?.data ? JSON.parse(docInfo.data) : null
        const customDomain = cfg?.appConfig?.domain ?? "https://siyuan.wiki"
        const customPath = cfg?.appConfig?.docPath ?? "s"
        formData.shareLink = `${customDomain}/${customPath}/${docId}`

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
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    {#if formData.showPassword}
                      <path fill="currentColor" d="M11.83 9L15 12.16V12a3 3 0 0 0-3-3h-.17m-4.3.8l1.55 1.55c-.05.21-.08.42-.08.65a3 3 0 0 0 3 3c.22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53a5 5 0 0 1-5-5c0-.79.2-1.53.53-2.2M2 4.27l2.28 2.28l.45.45C3.08 8.3 1.78 10 1 12c1.73 4.39 6 7.5 11 7.5c1.55 0 3.03-.3 4.38-.84l.43.42L19.73 22 21 20.73 3.27 3M12 7a5 5 0 0 1 5 5c0 .64-.13 1.26-.36 1.82l2.93 2.93c1.5-1.25 2.7-2.89 3.43-4.75c-1.73-4.39-6-7.5-11-7.5c-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7Z"/>
                    {:else}
                      <path fill="currentColor" d="M12 9a3 3 0 0 1 3 3a3 3 0 0 1-3 3a3 3 0 0 1-3-3a3 3 0 0 1 3-3m0-4.5c5 0 9.27 3.11 11 7.5c-1.73 4.39-6 7.5-11 7.5S2.73 16.39 1 12c1.73-4.39 6-7.5 11-7.5M3.18 12a9.821 9.821 0 0 0 17.64 0a9.821 9.821 0 0 0-17.64 0z"/>
                    {/if}
                  </svg>
                </button>
                <button
                        type="button"
                        class="password-visibility-toggle"
                        on:click={(event) => {
                        event.stopPropagation()
                        formData.password = getNewRndPassword()
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
      </div>
    {/if}
  {/if}
</div>

<style lang="stylus">
  #share
    /* 保持原有样式不变 */
    font-family "Open Sans", "LXGW WenKai", "JetBrains Mono", "-apple-system", "Microsoft YaHei", "Times New Roman",
    "方正北魏楷书_GBK", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans",
    "Droid Sans", "Helvetica Neue", sans-serif
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

    .divider
      height 1px
      margin 8px 0
      background-color #e0e0e0

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
      white-space nowrap
      margin-right 8px
      color var(--b3-theme-on-surface)

    .input-group
      display flex
      align-items center
      gap 8px
      flex-grow 1
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

    .input-group input:focus
      outline none
      border-color #0073e6
      box-shadow 0 0 4px rgba(0, 115, 230, 0.5)

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

    button
      padding 4px 12px
      font-size 14px
      color #ffffff
      border none
      border-radius 4px
      cursor pointer
      background-color #0073e6
      transition all 0.2s ease
      white-space nowrap
      flex-shrink 0
      height 28px

      &:hover
        background-color #005bb5
        box-shadow 0 2px 4px rgba(0, 0, 0, 0.1)

      &:active
        background-color #004999
        transform translateY(1px)

    .reshare-container
      display flex
      align-items center
      gap 12px

    .reshare-btn
      display inline-flex
      cursor pointer
      transition all 0.3s ease
      font-size 16px
      line-height 1
      color #333
      padding 4px
      border-radius 4px

      &:hover
        background-color rgba(0, 115, 230, 0.1)
        color #0073e6

      svg
        width 16px
        height 16px

    /* 密码输入框专用样式 */
    .password-container
      display flex
      align-items center
      gap 8px
      width 100%

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

    /* 第二个按钮（刷新图标） */
    .password-visibility-toggle + .password-visibility-toggle
      right 8px
      width 24px

    /* 暗色模式适配 */
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

      .password-visibility-toggle
        color var(--b3-theme-on-background)

        &:hover
          color var(--b3-theme-primary)
          background-color rgba(0, 115, 230, 0.2)

      .reshare-btn
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
</style>