/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2024 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import { AppConfig } from "../models/AppConfig"
import { SettingService } from "../service/SettingService"
import { ShareProConfig } from "../models/ShareProConfig"
import ShareProPlugin from "../index"
import { DEFAULT_SIYUAN_LANG } from "../Constants"

const DefaultAppConfig: AppConfig = {
  lang: DEFAULT_SIYUAN_LANG,
  siteUrl: "https://siyuan.wiki",
  siteTitle: "在线分享专业版",
  siteSlogan: "随时随地分享您的思源笔记",
  siteDescription: "给您的知识安个家",
  header: "",
  footer: "",
  shareTemplate: "[url]",
  homePageId: "20240903115146-wdyz9ue",
  theme: {
    mode: "light",
    lightTheme: "Zhihu",
    darkTheme: "Zhihu",
    themeVersion: "0.1.5",
  },

  customCss: [] as any,
} as AppConfig

const getSupportedThemes = (pluginInstance: ShareProPlugin) => {
  return {
    light: [
      { value: "daylight", label: pluginInstance.i18n.cs.themeTypeDaylight },
      { value: "Zhihu", label: pluginInstance.i18n.cs.themeTypeZhihu },
      { value: "Savor", label: pluginInstance.i18n.cs.themeTypeSavor },
      { value: "Tsundoku", label: pluginInstance.i18n.cs.themeTypeTsundoku },
      { value: "pink-room", label: pluginInstance.i18n.cs.themeTypePinkRoom },
      { value: "trends-in-siyuan", label: pluginInstance.i18n.cs.themeTypeTrends },
    ],
    dark: [
      { value: "midlight", label: pluginInstance.i18n.cs.themeTypeMidlight },
      { value: "Zhihu", label: pluginInstance.i18n.cs.themeTypeZhihu },
      { value: "Savor", label: pluginInstance.i18n.cs.themeTypeSavor },
      { value: "Tsundoku", label: pluginInstance.i18n.cs.themeTypeTsundoku },
      { value: "pink-room", label: pluginInstance.i18n.cs.themeTypePinkRoom },
      { value: "trends-in-siyuan", label: pluginInstance.i18n.cs.themeTypeTrends },
    ],
  }
}
const versionMap = {
  midlight: "3.1.17",
  daylight: "3.1.17",
  Zhihu: "0.1.5",
  Savor: "4.2.3",
  Tsundoku: "2.3.5",
  "pink-room": "0.9.4",
  "trends-in-siyuan": "0.4.0",
}

const syncAppConfig = async (settingService: SettingService, settingConfig: ShareProConfig) => {
  const appConfig = settingConfig.appConfig
  const res = await settingService.syncSetting(settingConfig.serviceApiConfig.token, appConfig)
  if (res.code == 1) {
    throw res.msg
  }
}

export { DefaultAppConfig, syncAppConfig, getSupportedThemes, versionMap }
