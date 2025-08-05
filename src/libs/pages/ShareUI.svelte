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
    import {showMessage} from "siyuan"
    import {onMount} from "svelte"
    import {Post} from "zhi-blog-api"
    import {simpleLogger} from "zhi-lib-base"
    import {useSiyuanApi} from "../../composables/useSiyuanApi"
    import {isDev, SHARE_PRO_STORE_NAME} from "../../Constants"
    import ShareProPlugin from "../../index"
    import {ShareOptions} from "../../models/ShareOptions"
    import {ShareProConfig} from "../../models/ShareProConfig"
    import {SingleDocSetting} from "../../models/SingleDocSetting"
    import {ShareService} from "../../service/ShareService"
    import {PasswordUtils} from "../../utils/PasswordUtils"
    import {icons} from "../../utils/svg"
    import {SiyuanKernelApi} from "zhi-siyuan-api"
    import {SettingKeys} from "../../utils/SettingKeys";
    import {AttrUtils} from "../../utils/AttrUtils";

    export let pluginInstance: ShareProPlugin
    export let shareService: ShareService
    export let docId: string

    const logger = simpleLogger("share-ui", "share-pro", isDev)

    let formData = {
        post: Post as any,
        shared: false,
        shareData: {} as any,
        lock: false,
        shareLink: "",
        kernelApi: SiyuanKernelApi,
        
        // 全局用户偏好设置（非文档级别）
        userPreferences: {
            showPassword: false
        },
        
        // 1、singleDocSetting，无敏感信息的，只在文档属性存储，例如文档大纲、文档有效期、文档状态
        singleDocSetting: {
            docTreeEnable: false,    // 是否显示文档树
            docTreeLevel: 3,         // 文档树层级
            outlineEnable: false,    // 是否显示大纲
            outlineLevel: 6,          // 大纲层级
            expiresTime: ""
        } as SingleDocSetting,
        
        // 2、shareOptions，有敏感信息，服务端存储，例如分享密码
        shareOptions: {
            password: "",
            passwordEnabled: false,
        } as ShareOptions
    }

    const handleShare = async () => {
        if (formData.shared) {
            // 分享
            try {
                const shareOptions: Partial<ShareOptions> = {}
                if (formData.shareOptions.passwordEnabled) {
                    shareOptions.passwordEnabled = formData.shareOptions.passwordEnabled
                    shareOptions.password = formData.shareOptions.password
                }
                if (formData.singleDocSetting.expiresTime && formData.singleDocSetting.expiresTime !== "") {
                    formData.singleDocSetting.expiresTime = formData.singleDocSetting.expiresTime.toString()
                }else{
                    formData.singleDocSetting.expiresTime = "0"
                }
                await shareService.createShare(docId, formData.singleDocSetting, shareOptions)
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
            const ret = await shareService.cancelShare(docId)
            if (ret.code === 0) {
                showMessage(pluginInstance.i18n["topbar"]["cancelSuccess"], 3000, "info")
            } else {
                showMessage(pluginInstance.i18n["topbar"]["cancelError"] + ret.msg, 7000, "error")
            }
        }
    }

    const handleReShare = async () => {
        // == 文档属性 ==
        // 有效期
        let expiredTime = Number(formData.singleDocSetting.expiresTime)
        if (isNaN(expiredTime) || expiredTime < 0 ) {
            expiredTime = 0;
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
    }

    const handlePasswordChange = async () => {
        if (formData.shared) {
            try {
                await shareService.updateShareOptions(docId, {
                    passwordEnabled: formData.shareOptions.passwordEnabled,
                    password: formData.shareOptions.password
                })
                showMessage(pluginInstance.i18n["ui"]["updateOptionsSuccess"], 3000, "info")
            } catch (e) {
                showMessage(pluginInstance.i18n["ui"]["updateOptionsError"], 3000, "error")
            }
        }
    }

    const handleExpiresTime = async () => {
        await handleReShare()
        showMessage(pluginInstance.i18n["ui"]["updateSettingSuccess"], 3000, "info")
    }

    const copyWebLink = () => {
        let copyText = formData.shareLink
        if(formData.shareOptions.passwordEnabled){
            copyText = copyText + " " + pluginInstance.i18n["cs"]["visitPassword"] + formData.shareOptions.password
        }
        copy(copyText)
        showMessage(pluginInstance.i18n["ui"]["copySuccess"], 3000, "info")
    }

    const viewDoc = () => {
        window.open(formData.shareLink)
    }

    const initSingleDocSetting = async (cfg: ShareProConfig) => {
        // 文档级别优先级最高
        const  docTreeEnable = await AttrUtils.getBool(pluginInstance,docId, SettingKeys.CUSTOM_DOC_TREE_ENABLE)
        const docTreeLevel = await AttrUtils.getInt(pluginInstance,docId, SettingKeys.CUSTOM_DOC_TREE_LEVEL)
        const outlineEnable = await AttrUtils.getBool(pluginInstance,docId, SettingKeys.CUSTOM_OUTLINE_ENABLE)
        const outlineLevel = await AttrUtils.getInt(pluginInstance,docId, SettingKeys.CUSTOM_OUTLINE_LEVEL)
        // 适配配置
        cfg.siyuanConfig.preferenceConfig = {
            ...cfg.siyuanConfig.preferenceConfig,
            docTreeEnable: docTreeEnable ?? cfg.siyuanConfig?.preferenceConfig?.docTreeEnable ?? false,
            docTreeLevel: docTreeLevel ?? cfg.siyuanConfig?.preferenceConfig?.docTreeLevel ?? 3,
            outlineEnable: outlineEnable ?? cfg.siyuanConfig?.preferenceConfig?.outlineEnable ?? false,
            outlineLevel: outlineLevel ?? cfg.siyuanConfig?.preferenceConfig?.outlineLevel ?? 6,
        }
        // 文档树、文档大纲
        formData.singleDocSetting.docTreeEnable = cfg.siyuanConfig.preferenceConfig.docTreeEnable
        formData.singleDocSetting.docTreeLevel = cfg.siyuanConfig.preferenceConfig.docTreeLevel
        formData.singleDocSetting.outlineEnable = cfg.siyuanConfig.preferenceConfig.outlineEnable
        formData.singleDocSetting.outlineLevel = cfg.siyuanConfig.preferenceConfig.outlineLevel
        // 分享有效期 - 界面上留空，只有实际有值时才显示
        const expiresTime = await AttrUtils.getInt(pluginInstance, docId, SettingKeys.CUSTOM_EXPIRES)
        formData.singleDocSetting.expiresTime = expiresTime > 0 ? expiresTime.toString() : ""
        logger.debug(`get single doc setting => ${JSON.stringify(formData.singleDocSetting)}`)
    }

    const initShareOptions = async (cfg: ShareProConfig) => {
        // 分享密码
        formData.shareOptions.passwordEnabled = formData.shareData?.passwordEnabled || cfg.appConfig?.passwordEnabled || false
        formData.userPreferences.showPassword = cfg.appConfig?.showPassword || false
        if (formData.shareOptions.passwordEnabled) {
            const rndPassword = PasswordUtils.getNewRndPassword()
            formData.shareOptions.password = formData.shareData?.password || rndPassword
        } else {
            formData.shareOptions.password = formData.shareData?.password || ""
        }
        
        logger.info(`get password option => passwordEnabled=${formData.shareOptions.passwordEnabled}, showPassword=${formData.userPreferences.showPassword}`)
        logger.debug(`get share options => ${JSON.stringify(formData.shareOptions)}`)
    }



    onMount(async () => {
        // 文档级别的两种 settings 标准
        // 1、singleDocSetting，无敏感信息的，只在文档属性存储，例如文档大纲、文档有效期、文档状态
        // 2、shareOptions，有敏感信息，服务端存储，例如分享密码

        // 初始化单文档设置
        const cfg = await pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
        await initSingleDocSetting(cfg)
        // 初始化基本信息
        const { blogApi } = useSiyuanApi(cfg)
        formData.post = await blogApi.getPost(docId)
        const docInfo = await shareService.getSharedDocInfo(docId)
        formData.shared = docInfo.code === 0
        formData.shareData = docInfo?.data ? JSON.parse(docInfo.data) : null
        const customDomain = cfg?.appConfig?.domain ?? "https://siyuan.wiki"
        const customPath = cfg?.appConfig?.docPath ?? "s"
        formData.shareLink = `${customDomain}/${customPath}/${docId}`
        // 初始化分享选项
        await initShareOptions(cfg)
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
                    bind:checked={formData.shareOptions.passwordEnabled}
                    class="b3-switch fn__flex-center password-toggle"
                    title={formData.shareOptions.passwordEnabled ? pluginInstance.i18n["ui"]["passwordDisabled"] : pluginInstance.i18n["ui"]["passwordEnabled"]}
                    on:change={handlePasswordChange}
            />
            {#if formData.shareOptions.passwordEnabled}
              <div class="password-input-container">
                <input
                        type={formData.userPreferences.showPassword ? "text" : "password"}
                        value={formData.shareOptions.password}
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
                        formData.userPreferences.showPassword = !formData.userPreferences.showPassword
                    }}
                        title={formData.userPreferences.showPassword ? pluginInstance.i18n["ui"]["hidePassword"] : pluginInstance.i18n["ui"]["showPassword"]}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    {#if formData.userPreferences.showPassword}
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

    .input-group input,
    .password-input,
    .share-expired-input
      &:focus
        border-color: #1890ff  /* Ant Design主蓝色 */
        box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2)  /* 标准Ant Design阴影 */
        outline: none
        transition: all 0.3s cubic-bezier(0.645, 0.045, 0.355, 1)  /* Ant Design标准过渡 */

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