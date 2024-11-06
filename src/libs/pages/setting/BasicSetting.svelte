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

  const logger = simpleLogger("basic-setting", "share-pro", isDev)
  export let pluginInstance: ShareProPlugin
  export let dialog: Dialog
  export let vipInfo: {
    code: number
    msg: string
    data: KeyInfo
  }

  let settingConfig: ShareProConfig = pluginInstance.getDefaultCfg()

  const onSaveSetting = async () => {
    await pluginInstance.saveData(SHARE_PRO_STORE_NAME, settingConfig)
    showMessage(`${pluginInstance.i18n.settingConfigSaveSuccess}`, 2000, "info")
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
    if (settingConfig.siyuanConfig?.apiUrl.length == 0) {
      settingConfig.siyuanConfig.apiUrl = window.location.origin
    }
  })
</script>

<div>
  <div class="config__tab-container">
    {#if vipInfo.code === 1}
      <div class="fn__block form-item no-register">{pluginInstance.i18n.keyInfo.notValid}</div>
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

    <div class="fn__block form-item">
      思源地址
      <div class="b3-label__text form-item-tip">
        思源笔记伺服地址，包括端口，本地单空间可固定：http://127.0.0.1:6806，多个工作空间或者 Docker 外网，请自动获取
      </div>
      <span class="fn__hr" />
      <input
        class="b3-text-field fn__block"
        id="siyuanApiUrl"
        bind:value={settingConfig.siyuanConfig.apiUrl}
        placeholder="请输入思源地址"
      />
      <a href="javascript:void(0)" id="autoSetApiUrl" on:click={autoSetApiUrl}>自动获取</a>
    </div>

    <div class="fn__block form-item">
      注册码
      <div class="b3-label__text form-item-tip">
        <a class="fn__code" href="https://store.terwer.space/products/share-pro">点击这里</a>
        自助获取注册码，或者 发邮件到 youweics@163.com 申请试用
      </div>
      <span class="fn__hr" />
      <textarea
        class="b3-text-field fn__block"
        id="regCode"
        bind:value={settingConfig.serviceApiConfig.token}
        rows="5"
        placeholder="请输入注册码"
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
