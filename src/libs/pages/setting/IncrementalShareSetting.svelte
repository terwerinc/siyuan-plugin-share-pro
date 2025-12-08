<!--
  -            GNU GENERAL PUBLIC LICENSE
  -               Version 3, 29 June 2007
  -
  -  Copyright (C) 2024-2025 Terwer, Inc. <https://terwer.space/>
  -  Everyone is permitted to copy and distribute verbatim copies
  -  of this license document, but changing it is not allowed.
  -->

<script lang="ts">
  import ShareProPlugin from "../../../index"
  import { Dialog, showMessage } from "siyuan"
  import { ShareProConfig } from "../../../models/ShareProConfig"
  import { isDev, SHARE_PRO_STORE_NAME } from "../../../Constants"
  import { onMount } from "svelte"
  import { simpleLogger } from "zhi-lib-base"
  import { syncAppConfig, DefaultAppConfig } from "../../../utils/ShareConfigUtils"
  import { SettingService } from "../../../service/SettingService"
  import { KeyInfo } from "../../../models/KeyInfo"

  const logger = simpleLogger("incremental-share-setting", "share-pro", isDev)
  export let pluginInstance: ShareProPlugin
  export let dialog: Dialog
  export let vipInfo: {
    code: number
    msg: string
    data: KeyInfo
  }

  let settingConfig: ShareProConfig = pluginInstance.getDefaultCfg()
  const settingService = new SettingService(pluginInstance)
  
  // 使用本地变量避免 undefined 错误
  // 默认值为 true（启用），只有显式保存才能关闭
  let isEnabled = true

  const onSaveSetting = async () => {
    // 确保 appConfig 存在
    settingConfig.appConfig ||= DefaultAppConfig
    // 不要重置已存在的配置，只初始化不存在的
    if (typeof settingConfig.appConfig.incrementalShareConfig === "undefined") {
      settingConfig.appConfig.incrementalShareConfig = {
        enabled: true  // 默认启用
      }
    }
    
    // 更新配置值
    settingConfig.appConfig.incrementalShareConfig.enabled = isEnabled

    // 保存到本地
    await pluginInstance.saveData(SHARE_PRO_STORE_NAME, settingConfig)

    // 同步到服务端
    try {
      await syncAppConfig(settingService, settingConfig)
      showMessage(`${pluginInstance.i18n.settingConfigSaveAndSyncSuccess}`, 2000, "info")
    } catch (e) {
      showMessage(`${pluginInstance.i18n.settingConfigSaveFail},${e}`, 7000, "error")
    }

    dialog.destroy()
  }

  const onCancel = async () => {
    dialog.destroy()
  }

  onMount(async () => {
    // 1、加载本地配置
    settingConfig = await pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
    settingConfig.appConfig ||= DefaultAppConfig
    // 初始化默认配置（默认启用）- 只在不存在时初始化
    if (typeof settingConfig.appConfig.incrementalShareConfig === "undefined") {
      settingConfig.appConfig.incrementalShareConfig = {
        enabled: true
      }
    }
    
    // 2、从远程读取配置（覆盖本地）
    try {
      const sAppConfig = await settingService.getSettingByAuthor(vipInfo.data.email)
      if (typeof sAppConfig?.incrementalShareConfig !== "undefined") {
        // 远程配置优先
        isEnabled = sAppConfig.incrementalShareConfig.enabled ?? true
      } else {
        // 远程没有，使用本地
        isEnabled = settingConfig.appConfig.incrementalShareConfig.enabled
      }
    } catch (e) {
      // 远程读取失败，使用本地
      logger.warn("Failed to load remote config, using local", e)
      isEnabled = settingConfig.appConfig.incrementalShareConfig.enabled
    }
  })
</script>

<div>
  <div class="config__tab-container">
    <div class="fn__block form-item">
      {pluginInstance.i18n.incrementalShare.enabled}
      <div class="b3-label__text form-item-tip">
        {pluginInstance.i18n.incrementalShare.enabledTip}
      </div>
      <span class="fn__hr" />
      <input
        class="b3-switch fn__flex-center"
        id="incrementalShareEnabled"
        type="checkbox"
        bind:checked={isEnabled}
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
