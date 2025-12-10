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
  import { DEFAULT_SIYUAN_LANG, isDev, SHARE_PRO_STORE_NAME } from "../../../Constants"
  import { Dialog, showMessage } from "siyuan"
  import { simpleLogger } from "zhi-lib-base"
  import ShareProPlugin from "../../../index"
  import { DefaultAppConfig, syncAppConfig } from "../../../utils/ShareConfigUtils"
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

  let docTreeEnabled = true
  let docTreeLevel = 3
  let docTreeLevelOptions = [1, 2, 3, 4, 5, 6]
  let outlineEnabled = true
  let outlineLevel = 6
  let outlineLevelOptions = [
    {
      label: "h1",
      value: 1,
    },
    {
      label: "h2",
      value: 2,
    },
    {
      label: "h3",
      value: 3,
    },
    {
      label: "h4",
      value: 4,
    },
    {
      label: "h5",
      value: 5,
    },
    {
      label: "h6",
      value: 6,
    },
  ]
  let passwordEnabled = false
  let showPassword = false

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
    // 文档树
    settingConfig.appConfig.docTreeEnabled = docTreeEnabled
    settingConfig.appConfig.docTreeLevel = docTreeLevel
    // 文档大纲
    settingConfig.appConfig.outlineEnabled = outlineEnabled
    settingConfig.appConfig.outlineLevel = outlineLevel
    // 全局密码保护
    settingConfig.appConfig.passwordEnabled = passwordEnabled
    settingConfig.appConfig.showPassword = showPassword
    return settingConfig
  }

  const onCancel = async () => {
    dialog.destroy()
  }

  onMount(async () => {
    //  1、加载最新配置
    settingConfig = await pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
    // 2、构建appConfig
    settingConfig = await buildAppConfig(settingConfig)
    // 3、初始化appConfig到本地
    const sAppConfig = await settingService.getSettingByAuthor(vipInfo.data.email)
    docTreeEnabled = sAppConfig?.docTreeEnabled ?? docTreeEnabled
    docTreeLevel = sAppConfig?.docTreeLevel ?? docTreeLevel
    outlineEnabled = sAppConfig?.outlineEnabled ?? outlineEnabled
    outlineLevel = sAppConfig?.outlineLevel ?? outlineLevel
    passwordEnabled = sAppConfig?.passwordEnabled ?? passwordEnabled
    showPassword = sAppConfig?.showPassword ?? showPassword
  })
</script>

<div>
  <div class="config__tab-container">
    <div class="fn__block form-item">
      {pluginInstance.i18n.cs.docTree}
      <div class="b3-label__text form-item-tip">{pluginInstance.i18n.cs.docTreeTip}</div>
      <span class="fn__hr" />
      <input class="b3-switch fn__flex-center" id="syncCss" type="checkbox" bind:checked={docTreeEnabled} />
      {#if docTreeEnabled}
        &nbsp;{pluginInstance.i18n.cs.docTreeDepth}: &nbsp;
        <select id="theme" class="b3-select fn__flex-center fn__size200" bind:value={docTreeLevel}>
          {#each docTreeLevelOptions as item}
            <option value={item}>{item}</option>
          {/each}
        </select>
      {/if}
    </div>

    <div class="fn__block form-item">
      {pluginInstance.i18n.cs.outline}
      <div class="b3-label__text form-item-tip">{pluginInstance.i18n.cs.outlineTip}</div>
      <span class="fn__hr" />
      <input class="b3-switch fn__flex-center" id="syncCss" type="checkbox" bind:checked={outlineEnabled} />
      {#if outlineEnabled}
        &nbsp;{pluginInstance.i18n.cs.outlineDepth}: &nbsp;
        <select id="theme" class="b3-select fn__flex-center fn__size200" bind:value={outlineLevel}>
          {#each outlineLevelOptions as item}
            <option value={item.value}>{item.label}</option>
          {/each}
        </select>
      {/if}
    </div>

    <div class="fn__block form-item">
      {pluginInstance.i18n.cs.passwordEnabled}
      <div class="b3-label__text form-item-tip">{pluginInstance.i18n.cs.passwordEnabledTip}</div>
      <span class="fn__hr" />
      <input class="b3-switch fn__flex-center" id="passwordEnabled" type="checkbox" bind:checked={passwordEnabled} />
    </div>

    <div class="fn__block form-item">
      {pluginInstance.i18n.cs.showPassword}
      <div class="b3-label__text form-item-tip">{pluginInstance.i18n.cs.showPasswordTip}</div>
      <span class="fn__hr" />
      <input class="b3-switch fn__flex-center" id="showPassword" type="checkbox" bind:checked={showPassword} />
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
