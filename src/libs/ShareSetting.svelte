<script lang="ts">
  import ShareProPlugin from "../index"
  import { Dialog, showMessage } from "siyuan"
  import { ShareProConfig } from "../models/ShareProConfig"
  import { isDev, SHARE_PRO_STORE_NAME } from "../Constants"
  import { onMount } from "svelte"
  import { KeyInfo } from "../models/KeyInfo"
  import { getRegisterInfo } from "../utils/LicenseUtils"
  import { simpleLogger } from "zhi-lib-base"
  import { ApiUtils } from "../utils/ApiUtils"
  import { SettingService } from "../service/SettingService"

  const logger = simpleLogger("share-setting", "share-pro", isDev)
  export let pluginInstance: ShareProPlugin
  export let dialog: Dialog
  export let vipInfo: {
    code: number
    msg: string
    data: KeyInfo
  }
  let theme = "Zhihu"
  const settingService = new SettingService(pluginInstance)

  let settingConfig: ShareProConfig = pluginInstance.getDefaultCfg()
  // let isPC = getFrontend() == "desktop"
  // let isDocker = getBackend() == "docker"

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
      ],
      dark: [
        { value: "midlight", label: "midlight" },
        { value: "Zhihu", label: "Zhihu" },
        { value: "Savor", label: "写未" },
      ],
    }
    const versionMap = {
      midlight: "3.0.10",
      daylight: "3.0.10",
      Zhihu: "0.1.1",
      Savor: "3.9.2",
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

  const autoSetApiUrl = () => {
    settingConfig.siyuanConfig.apiUrl = window.location.origin as string
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
    {#if vipInfo.code === 1}
      <div class="fn__block form-item no-register">注册码不合法或尚未注册</div>
    {:else}
      <div class="fn__block form-item registered">
        <span>已注册[{vipInfo.data.isVip ? "vip" : "普通用户"}]， </span>
        <span>注册给：{vipInfo.data.email}，</span>
        <span>注册类型: {getRegisterInfo(vipInfo.data.payType)}，</span>
        <span>有效期：{vipInfo.data.num >= 999 ? "永久" : vipInfo.data.num}， </span>
        <span>注册时间：{vipInfo.data.from}</span>
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
    {#if false}
      <div class="fn__block form-item">
        思源鉴权token
        <!--
                          <div class="b3-label__text form-item-tip">思源笔记鉴权token，请从设置->关于复制，本地可留空</div>
                          -->
        <span class="fn__hr" />
        <input
          class="b3-text-field fn__block"
          id="siyuanAuthToken"
          bind:value={settingConfig.siyuanConfig.token}
          placeholder="请输入思源token，本地可留空"
        />
      </div>
      <div class="fn__block form-item">
        思源cookie
        <!--
                  <div class="b3-label__text form-item-tip">开启了授权码之后必须复制cookie，否则可留空</div>
                  -->
        <span class="fn__hr" />
        <input
          class="b3-text-field fn__block"
          id="siyuanCookie"
          bind:value={settingConfig.siyuanConfig.cookie}
          placeholder="请输入思源cookie，未开启授权码可留空"
        />
      </div>
    {/if}

    <div class="fn__block form-item">
      注册码
      <div class="b3-label__text form-item-tip">
        <!--
                <a class="fn__code" href="https://store.terwer.space/products/share-pro">点击这里</a>
                自助获取注册码，或者
                -->
        发邮件到 youweics@163.com 申请试用
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

    <div class="fn__block form-item">
      主题
      <div class="b3-label__text form-item-tip">自定义分享页面主题</div>
      <span class="fn__hr" />
      <select id="theme" class="b3-select fn__flex-center fn__size200" bind:value={theme}>
        <option value="daylight">daylight</option>
        <option value="midlight">midlight</option>
        <option value="Zhihu">Zhihu</option>
        <option value="Savor">写未</option>
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

  .no-register {
    color: red !important;
    padding-bottom: 0;
  }

  .registered {
    color: green !important;
    padding-bottom: 0;
  }
</style>
