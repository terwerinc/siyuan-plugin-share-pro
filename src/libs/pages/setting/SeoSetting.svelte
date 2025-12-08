<!--
  -            GNU GENERAL PUBLIC LICENSE
  -               Version 3, 29 June 2007
  -
  -  Copyright (C) 2024-2025 Terwer, Inc. <https://terwer.space/>
  -  Everyone is permitted to copy and distribute verbatim copies
  -  of this license document, but changing it is not allowed.
  -->

<!--suppress ALL -->
<script lang="ts">
    import { ShareProConfig } from "../../../models/ShareProConfig"
    import { onMount } from "svelte"
    import { isDev, SHARE_PRO_STORE_NAME } from "../../../Constants"
    import { Dialog, showMessage } from "siyuan"
    import { simpleLogger } from "zhi-lib-base"
    import ShareProPlugin from "../../../index"
    import { DefaultAppConfig, syncAppConfig } from "../../../utils/ShareConfigUtils"
    import { SettingService } from "../../../service/SettingService"
    import { KeyInfo } from "../../../models/KeyInfo"

    const logger = simpleLogger("seo-setting", "share-pro", isDev)
    export let pluginInstance: ShareProPlugin
    export let dialog: Dialog
    export let vipInfo: {
        code: number
        msg: string
        data: KeyInfo
    }

    let siteTitle = ""
    let siteSlogan = ""
    let siteDescription = ""
    let headerContent = ""
    let footerContent = ""
    let shareTemplate = ""

    let settingConfig: ShareProConfig = pluginInstance.getDefaultCfg()
    const settingService = new SettingService(pluginInstance)

    const onSaveSetting = async () => {
        settingConfig = await buildSeoConfig(settingConfig)
        await pluginInstance.saveData(SHARE_PRO_STORE_NAME, settingConfig)
        try {
            await syncAppConfig(settingService, settingConfig)
            showMessage(`${pluginInstance.i18n.seo.saveSuccess}`, 2000, "info")
        } catch (e) {
            showMessage(`${pluginInstance.i18n.seo.saveFail}：${e}`, 7000, "error")
        }
        dialog.destroy()
    }

    const buildSeoConfig = async (config: ShareProConfig) => {
        config.appConfig ||= DefaultAppConfig
        config.appConfig.siteTitle = siteTitle
        config.appConfig.siteSlogan = siteSlogan
        config.appConfig.siteDescription = siteDescription
        config.appConfig.header = headerContent
        config.appConfig.footer = footerContent
        config.appConfig.shareTemplate = shareTemplate
        return config
    }

    const onCancel = () => dialog.destroy()

    onMount(async () => {
        settingConfig = await pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
        const sAppConfig = await settingService.getSettingByAuthor(vipInfo.data.email)

        siteTitle = sAppConfig?.siteTitle ?? ""
        siteSlogan = sAppConfig?.siteSlogan ?? ""
        siteDescription = sAppConfig?.siteDescription ?? ""
        headerContent = sAppConfig?.header ?? ""
        footerContent = sAppConfig?.footer ?? ""
        shareTemplate = sAppConfig?.shareTemplate ?? ""
    })
</script>

<div>
  <div class="config__tab-container">
    <!-- 站点基本信息 -->
    <div class="fn__block form-item">
      <label>{pluginInstance.i18n.seo.siteTitle}</label>
      <input class="b3-text-field fn__block" bind:value={siteTitle}
             placeholder={pluginInstance.i18n.seo.siteTitlePlaceholder} />

      <label class="fn__flex-center fn__mt10">{pluginInstance.i18n.seo.siteSlogan}</label>
      <input class="b3-text-field fn__block" bind:value={siteSlogan}
             placeholder={pluginInstance.i18n.seo.siteSloganPlaceholder} />

      <label class="fn__flex-center fn__mt10">{pluginInstance.i18n.seo.siteDescription}</label>
      <textarea class="b3-text-field fn__block" rows="3" bind:value={siteDescription}
                placeholder={pluginInstance.i18n.seo.siteDescriptionPlaceholder} />
    </div>

    <!-- 自定义头部/底部 -->
    <div class="fn__block form-item">
      <label>{pluginInstance.i18n.seo.customHeader}</label>
      <div class="b3-label__text">{pluginInstance.i18n.seo.customHeaderTip}</div>
      <textarea class="b3-text-field fn__block" rows="2" bind:value={headerContent} />

      <label class="fn__flex-center fn__mt10">{pluginInstance.i18n.seo.customFooter}</label>
      <div class="b3-label__text">{pluginInstance.i18n.seo.customFooterTip}</div>
      <textarea class="b3-text-field fn__block" rows="2" bind:value={footerContent} />
    </div>

    <!-- 分享模板 -->
    <div class="fn__block form-item">
      <label>{pluginInstance.i18n.seo.shareTemplate}</label>
      <div class="b3-label__text">{pluginInstance.i18n.seo.shareTemplateTip}</div>
      <textarea class="b3-text-field fn__block" rows="2" bind:value={shareTemplate}
                placeholder={pluginInstance.i18n.seo.shareTemplatePlaceholder} />
    </div>

    <!-- 操作按钮 -->
    <div class="b3-dialog__action">
      <button class="b3-button b3-button--cancel" on:click={onCancel}>{pluginInstance.i18n.cancel}</button>
      <div class="fn__space" />
      <button class="b3-button b3-button--text" on:click={onSaveSetting}>{pluginInstance.i18n.save}</button>
    </div>
  </div>
</div>

<style>
    .form-item {
        padding: 5px;
        width: 94%;
        margin: auto;
        font-size: 14px;
    }

    label {
        display: block;
        margin: 8px 0;
        color: var(--b3-theme-on-surface);
    }

    .b3-text-field {
        width: 100%;
        margin: 5px 0;
        padding: 8px;
        border: 1px solid var(--b3-border-color);
        border-radius: 4px;
    }

    textarea {
        resize: vertical;
        min-height: 40px;
    }
</style>