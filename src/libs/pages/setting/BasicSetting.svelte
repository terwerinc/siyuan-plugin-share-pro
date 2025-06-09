<!--
  -            GNU GENERAL PUBLIC LICENSE
  -               Version 3, 29 June 2007
  -
  -  Copyright (C) 2024 Terwer, Inc. <https://terwer.space/>
  -  Everyone is permitted to copy and distribute verbatim copies
  -  of this license document, but changing it is not allowed.
  -->

<script lang="ts">
  import ShareProPlugin from "../../../index"
  import { Dialog, showMessage } from "siyuan"
  import { ShareProConfig } from "../../../models/ShareProConfig"
  import { isDev, SHARE_PRO_STORE_NAME } from "../../../Constants"
  import { onMount } from "svelte"
  import { KeyInfo } from "../../../models/KeyInfo"
  import { getRegisterInfo } from "../../../utils/LicenseUtils"
  import { simpleLogger } from "zhi-lib-base"
  import { DefaultAppConfig, syncAppConfig } from "../../../utils/ShareConfigUtils"
  import { SettingService } from "../../../service/SettingService"

  const logger = simpleLogger("basic-setting", "share-pro", isDev)
  export let pluginInstance: ShareProPlugin
  export let dialog: Dialog
  export let vipInfo: {
    code: number
    msg: string
    data: KeyInfo
  }

  let settingConfig: ShareProConfig = pluginInstance.getDefaultCfg()
  const settingService = new SettingService(pluginInstance)

  const onSaveSetting = async () => {
    if (!settingConfig.appConfig) {
      settingConfig.appConfig ||= DefaultAppConfig
      await pluginInstance.saveData(SHARE_PRO_STORE_NAME, settingConfig)
      try {
        await syncAppConfig(settingService, settingConfig)
        showMessage(`${pluginInstance.i18n.settingConfigSaveAndSyncSuccess}`, 2000, "info")
      } catch (e) {
        showMessage(`${pluginInstance.i18n.settingConfigSaveFail},${e}`, 7000, "error")
      }
    } else {
      await pluginInstance.saveData(SHARE_PRO_STORE_NAME, settingConfig)
      showMessage(`${pluginInstance.i18n.settingConfigSaveSuccess}`, 2000, "info")
    }
    dialog.destroy()
  }

  const onCancel = async () => {
    dialog.destroy()
  }

  const autoSetApiUrl = () => {
    settingConfig.siyuanConfig.apiUrl = window.location.origin as string
  }

  onMount(async () => {
    settingConfig = await pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
    autoSetApiUrl()
    // if (settingConfig.siyuanConfig?.apiUrl.length == 0) {
    //  settingConfig.siyuanConfig.apiUrl = window.location.origin
    // }
  })
</script>

<div>
  <div class="config__tab-container">
    {#if vipInfo.code === 1 || vipInfo.code === 403}
      <div class="fn__block form-item no-register">
        {pluginInstance.i18n.keyInfo.notValid}！
        详细信息：{vipInfo.msg}
      </div>
    {:else}
      <div class="fn__block form-item registered">
        <span>
          {pluginInstance.i18n.keyInfo.registered}
          [{vipInfo.data.isVip ? "vip" : pluginInstance.i18n.keyInfo.freeUser}]&nbsp;
        </span>
        <span>{pluginInstance.i18n.keyInfo.registerTo}{vipInfo.data.email}&nbsp;</span>
        <span>
          {pluginInstance.i18n.keyInfo.registerType}
          {getRegisterInfo(pluginInstance, vipInfo.data.payType)}&nbsp;
        </span>
        <span>
          {pluginInstance.i18n.keyInfo.expired}
          {vipInfo.data.num >= 999 ? pluginInstance.i18n.keyInfo.lifetime : vipInfo.data.num}&nbsp;
        </span>
        <span>{pluginInstance.i18n.keyInfo.expireTime}{vipInfo.data.from}</span>
      </div>
    {/if}

    <!-- 自动获取即可，没必要再设置了 -->
    <!--
    <div class="fn__block form-item">
      {pluginInstance.i18n.bs.siyuanApi}
      <div class="b3-label__text form-item-tip">
        {pluginInstance.i18n.bs.siyuanApiTip}
      </div>
      <span class="fn__hr" />
      <input
        class="b3-text-field fn__block"
        id="siyuanApiUrl"
        bind:value={settingConfig.siyuanConfig.apiUrl}
        placeholder={pluginInstance.i18n.bs.siyuanApiPlaceholder}
      />
      <a href="javascript:void(0)" id="autoSetApiUrl" on:click={autoSetApiUrl}>
        {pluginInstance.i18n.bs.siyuanApiAutoset}
      </a>
    </div>
    -->

    <div class="fn__block form-item">
      {pluginInstance.i18n.bs.newUI}<sup>1.9.0+ <span style="color:red">new</span></sup>
      <div class="b3-label__text form-item-tip">
        {pluginInstance.i18n.bs.newUITip}
        <a href={pluginInstance.i18n.bs.newUITipLink} target="_blank">{pluginInstance.i18n.bs.newUITipLink}</a>
      </div>
      <span class="fn__hr" />
      <input class="b3-switch fn__flex-center" id="newUI" type="checkbox" bind:checked={settingConfig.isNewUIEnabled} />
    </div>

    <div class="fn__block form-item">
      {pluginInstance.i18n.bs.regCode}
      <div class="b3-label__text form-item-tip">
        <a class="fn__code" href="https://store.terwer.space/products/share-pro">
          {pluginInstance.i18n.bs.regCodeClick}
        </a>
        {pluginInstance.i18n.bs.regCodeTip}
      </div>
      <span class="fn__hr" />
      <textarea
        class="b3-text-field fn__block"
        id="regCode"
        bind:value={settingConfig.serviceApiConfig.token}
        rows="5"
        placeholder={pluginInstance.i18n.bs.regCodePlaceholder}
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

  .no-register {
    color: red !important;
    padding-bottom: 0;
  }

  .registered {
    color: green !important;
    padding-bottom: 0;
  }
</style>
