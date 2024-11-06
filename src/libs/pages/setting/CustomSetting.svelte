<!--
  -            GNU GENERAL PUBLIC LICENSE
  -               Version 3, 29 June 2007
  -
  -  Copyright (C) 2024 Terwer, Inc. <https://terwer.space/>
  -  Everyone is permitted to copy and distribute verbatim copies
  -  of this license document, but changing it is not allowed.
  -->

<script lang="ts">
  import { SettingService } from "../../../service/SettingService"
  import { ShareProConfig } from "../../../models/ShareProConfig"
  import { onMount } from "svelte"
  import { isDev, SHARE_PRO_STORE_NAME } from "../../../Constants"
  import { ApiUtils } from "../../../utils/ApiUtils"
  import { Dialog, showMessage } from "siyuan"
  import { simpleLogger } from "zhi-lib-base"
  import ShareProPlugin from "../../../index"
  import { KeyInfo } from "../../../models/KeyInfo"

  const logger = simpleLogger("custom-setting", "share-pro", isDev)
  export let pluginInstance: ShareProPlugin
  export let dialog: Dialog
  let theme = "Zhihu"
  const settingService = new SettingService(pluginInstance)

  let settingConfig: ShareProConfig = pluginInstance.getDefaultCfg()

  const onSaveSetting = async () => {
    // 构建appConfig
    settingConfig = await buildAppConfig(settingConfig)
    await pluginInstance.saveData(SHARE_PRO_STORE_NAME, settingConfig)
    try {
      await syncAppConfig()
      showMessage(`${pluginInstance.i18n.settingConfigSaveSuccess}`, 2000, "info")
    } catch (e) {
      showMessage(`${pluginInstance.i18n.settingConfigSaveFail},${e}`, 7000, "error")
    }

    dialog.destroy()
  }

  const buildAppConfig = async (settingConfig: ShareProConfig) => {
    settingConfig.appConfig ||= {
      lang: "zh_CN",
      siteUrl: "https://siyuannote.space",
      siteTitle: "在线分享专业版",
      siteSlogan: "随时随地分享您的思源笔记",
      siteDescription: "给您的知识安个家",
      theme: {
        mode: "light",
        lightTheme: "Zhihu",
        darkTheme: "Zhihu",
        themeVersion: "0.1.1",
      },
      footer: "",
      shareTemplate: "[url]",
      homePageId: "20240903115146-wdyz9ue",

      customCss: [] as any,
    }
    const supportedThemes = {
      light: [
        { value: "daylight", label: "daylight" },
        { value: "Zhihu", label: "Zhihu" },
        { value: "Savor", label: "写未" },
        { value: "Tsundoku", label: "積読" },
        { value: "pink-room", label: "粉色小屋" },
        { value: "trends-in-siyuan", label: "Trends" },
      ],
      dark: [
        { value: "midlight", label: "midlight" },
        { value: "Zhihu", label: "Zhihu" },
        { value: "Savor", label: "写未" },
        { value: "Tsundoku", label: "積読" },
        { value: "pink-room", label: "粉色小屋" },
        { value: "trends-in-siyuan", label: "Trends" },
      ],
    }
    const versionMap = {
      midlight: "3.1.10",
      daylight: "3.1.10",
      Zhihu: "0.1.3",
      Savor: "4.2.3",
      Tsundoku: "2.3.5",
      "pink-room": "0.9.4",
      "trends-in-siyuan": "0.4.0",
    }
    settingConfig.appConfig.theme = {
      mode: "light",
      lightTheme: supportedThemes.light.find((x) => x.value === theme)?.value || "daylight",
      darkTheme: supportedThemes.dark.find((x) => x.value === theme)?.value || "midlight",
      themeVersion: versionMap[theme] || "unknown",
    }

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

  const syncAppConfig = async () => {
    const appConfig = settingConfig.appConfig
    const res = await settingService.syncSetting(settingConfig.serviceApiConfig.token, appConfig)
    if (res.code == 1) {
      throw res.msg
    }
  }

  const onCancel = async () => {
    dialog.destroy()
  }

  onMount(async () => {
    //  1、加载最新配置
    settingConfig = await pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
    theme = settingConfig?.appConfig?.theme?.lightTheme ?? "Zhihu"
    settingConfig.isCustomCssEnabled = settingConfig.isCustomCssEnabled ?? true
    if (settingConfig.siyuanConfig?.apiUrl.length == 0) {
      settingConfig.siyuanConfig.apiUrl = window.location.origin
    }
    // 2、构建appConfig
    settingConfig = await buildAppConfig(settingConfig)
  })
</script>

<div>
  <div class="config__tab-container">
    <div class="fn__block form-item">
      主题
      <div class="b3-label__text form-item-tip">自定义分享页面主题</div>
      <span class="fn__hr" />
      <select id="theme" class="b3-select fn__flex-center fn__size200" bind:value={theme}>
        <option value="daylight">默认浅色(daylight)</option>
        <option value="midlight">默认暗色(midlight)</option>
        <option value="Zhihu">知乎(Zhihu)</option>
        <option value="Savor">写未(Savor)</option>
        <option value="Tsundoku">積読(Tsundoku)</option>
        <option value="pink-room">粉色小屋(pink-room)</option>
        <option value="trends-in-siyuan">Trends</option>
      </select>
    </div>

    <div class="fn__block form-item">
      启用自定义css片段
      <div class="b3-label__text form-item-tip">同步自定义css片段到分享页面</div>
      <span class="fn__hr" />
      <input
        class="b3-switch fn__flex-center"
        id="syncCss"
        type="checkbox"
        bind:checked={settingConfig.isCustomCssEnabled}
      />
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
