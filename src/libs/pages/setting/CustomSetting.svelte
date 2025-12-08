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
  import {DEFAULT_SIYUAN_LANG, isDev, SHARE_PRO_STORE_NAME} from "../../../Constants"
  import { ApiUtils } from "../../../utils/ApiUtils"
  import { Dialog, showMessage } from "siyuan"
  import { simpleLogger } from "zhi-lib-base"
  import ShareProPlugin from "../../../index"
  import { DefaultAppConfig, getSupportedThemes, syncAppConfig, versionMap } from "../../../utils/ShareConfigUtils"
  import { SettingService } from "../../../service/SettingService"
  import { KeyInfo } from "../../../models/KeyInfo"

  const logger = simpleLogger("custom-setting", "share-pro", isDev)
  export let pluginInstance: ShareProPlugin
  export let dialog: Dialog
  export let vipInfo: {
    code: number
    msg: string
    data: KeyInfo
  }

  let theme = "Zhihu"
  let themes = getSupportedThemes(pluginInstance)
  let domain = isDev ? "http://localhost:4000" : "https://siyuannote.site"
  let domains = isDev ? ["http://localhost:4000"] : ["https://siyuannote.site", "https://siyuannote.space"]
  let docPath = "x"
  let docPaths = ["x", "s", "p", "a", "static", "post", "link", "doc", "article"]
  let domainApplyUrl = "https://github.com/terwerinc/siyuan-plugin-share-pro/issues/114"

  let settingConfig: ShareProConfig = pluginInstance.getDefaultCfg()
  const settingService = new SettingService(pluginInstance)

  const onSaveSetting = async () => {
    // 构建appConfig
    settingConfig = await buildAppConfig(settingConfig)
    await pluginInstance.saveData(SHARE_PRO_STORE_NAME, settingConfig)
    try {
      await syncAppConfig(settingService, settingConfig)
      showMessage(`${pluginInstance.i18n.settingConfigSaveAndSyncSuccess}`, 2000, "info")
    } catch (e) {
      showMessage(`${pluginInstance.i18n.settingConfigSaveFail},${e}`, 7000, "error")
    }

    dialog.destroy()
  }

  const buildAppConfig = async (settingConfig: ShareProConfig) => {
    settingConfig.appConfig ||= DefaultAppConfig
    settingConfig.appConfig.lang = DEFAULT_SIYUAN_LANG
    settingConfig.appConfig.theme = {
      mode: "light",
      lightTheme: themes.light.find((x) => x.value === theme)?.value || "daylight",
      darkTheme: themes.dark.find((x) => x.value === theme)?.value || "midlight",
      themeVersion: versionMap[theme] || "unknown",
    }
    // 域名
    settingConfig.appConfig.domains = domains
    settingConfig.appConfig.domain = domain
    // 文档路径
    settingConfig.appConfig.docPaths = docPaths
    settingConfig.appConfig.docPath = docPath

    if (settingConfig.isCustomCssEnabled) {
      settingConfig.appConfig.customCss = await fetchCustomCss()
    } else {
      settingConfig.appConfig.customCss = [] as any
    }
    return settingConfig
  }

  const fetchCustomCss = async () => {
    let cssArray = []
    // 当前运行在思源笔记中
    try {
      const { kernelApi } = await ApiUtils.getSiyuanKernelApi(pluginInstance)
      const customCss = await kernelApi.siyuanRequest("/api/snippet/getSnippet", { type: "css", enabled: 2 })
      if (customCss?.snippets?.length > 0) {
        cssArray = customCss.snippets.filter((x) => x.enabled)
      }
    } catch (e) {
      logger.error("get custom css error", e)
    }
    logger.info("get custom css", cssArray)
    return cssArray as any
  }

  const onCancel = async () => {
    dialog.destroy()
  }

  onMount(async () => {
    //  1、加载最新配置
    settingConfig = await pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
    theme = settingConfig?.appConfig?.theme?.lightTheme ?? "Zhihu"
    settingConfig.isCustomCssEnabled = settingConfig.isCustomCssEnabled ?? true
    settingConfig.siyuanConfig.preferenceConfig ||= {} as any
    settingConfig.siyuanConfig.preferenceConfig.fixTitle = settingConfig.siyuanConfig.preferenceConfig.fixTitle ?? false
    if (settingConfig.siyuanConfig?.apiUrl.length == 0) {
      settingConfig.siyuanConfig.apiUrl = window.location.origin
    }
    // 2、构建appConfig
    settingConfig = await buildAppConfig(settingConfig)
    // 3、初始化appConfig到本地
    const sAppConfig = await settingService.getSettingByAuthor(vipInfo.data.email)
    domains = sAppConfig?.domains ?? domains
    domain = sAppConfig?.domain ?? domain
    docPaths = sAppConfig?.docPaths ?? docPaths
    docPath = sAppConfig?.docPath ?? docPath
  })
</script>

<div>
  <div class="config__tab-container">
    <div class="fn__block form-item">
      {pluginInstance.i18n.cs.theme}
      <div class="b3-label__text form-item-tip">{pluginInstance.i18n.cs.themeTip}</div>
      <span class="fn__hr" />
      <select id="theme" class="b3-select fn__flex-center fn__size200" bind:value={theme}>
        {#each themes.light as item}
          <option value={item.value}>{item.label}</option>
        {/each}
      </select>
    </div>

    <div class="fn__block form-item">
      {pluginInstance.i18n.cs.customCss}
      <div class="b3-label__text form-item-tip">{pluginInstance.i18n.cs.customCssTip}</div>
      <span class="fn__hr" />
      <input
        class="b3-switch fn__flex-center"
        id="syncCss"
        type="checkbox"
        bind:checked={settingConfig.isCustomCssEnabled}
      />
    </div>

    <div class="fn__block form-item">
      {pluginInstance.i18n.cs.fixTitle}
      <div class="b3-label__text form-item-tip">{pluginInstance.i18n.cs.fixTitleTip}</div>
      <span class="fn__hr" />
      <input
        class="b3-switch fn__flex-center"
        id="syncCss"
        type="checkbox"
        bind:checked={settingConfig.siyuanConfig.preferenceConfig.fixTitle}
      />
    </div>

    <div class="fn__block form-item">
      {pluginInstance.i18n.cs.domain}
      <div class="b3-label__text form-item-tip">
        {pluginInstance.i18n.cs.domainTip}
        <a href={domainApplyUrl} target="_blank">{pluginInstance.i18n.cs.domainClick}</a>
        {pluginInstance.i18n.cs.domainApply}
      </div>
      <span class="fn__hr" />
      <select id="theme" class="b3-select fn__flex-center fn__size200" bind:value={domain}>
        {#each domains as item}
          <option value={item}>{item}</option>
        {/each}
      </select>
    </div>

    <div class="fn__block form-item">
      {pluginInstance.i18n.cs.docPath}
      <div class="b3-label__text form-item-tip">{pluginInstance.i18n.cs.docPathTip}</div>
      <span class="fn__hr" />
      <select id="theme" class="b3-select fn__flex-center fn__size200" bind:value={docPath}>
        {#each docPaths as item}
          <option value={item}>{item}</option>
        {/each}
      </select>
    </div>

    <div class="b3-dialog__action">
      <button class="b3-button b3-button--cancel" on:click={onCancel}>{pluginInstance.i18n.cancel}</button>
      <div class="fn__space" />
      <button class="b3-button b3-button--text" on:click={onSaveSetting}>{pluginInstance.i18n.save}</button>
    </div>
  </div>
</div>

<style>
  .form-item {
    padding: 10px;
    width: 94%;
    margin: auto;
    font-size: 14px;
  }

  .form-item-tip {
    font-size: 12px !important;
    color: var(--b3-theme-on-background);
  }
</style>
