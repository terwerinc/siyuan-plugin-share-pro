/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

type ThemeType = "system" | "dark" | "light"

interface AppConfig {
  lang?: string
  siteUrl?: string
  siteTitle?: string
  siteSlogan?: string
  siteDescription?: string
  homePageId?: string
  header?: string
  footer?: string
  shareTemplate?: string

  theme?: {
    mode?: ThemeType
    lightTheme?: string
    darkTheme?: string
    themeVersion?: string
  }

  customCss?: [
    {
      name: string
      content: string
    }
  ]

  // add by v5.4.0+
  themeConfig: {
    // 导航栏logo
    logo?: string
  }

  // pro only
  domains: Array<string>
  domain: string
  basePaths: Array<string>
  docPath: string

  docTreeEnabled: boolean
  docTreeLevel: number
  outlineEnabled: boolean
  outlineLevel: number

  // 全局密码保护功能
  passwordEnabled?: boolean
  showPassword?: boolean

  // 增量分享配置
  // add by v1.15.0+
  // 专业版专属配置
  incrementalShareConfig?: {
    enabled: boolean
    lastShareTime?: number
    notebookBlacklist?: Array<{
      id: string
      name: string
      type: "notebook"
      addedTime: number
      note?: string
    }>
  }

  // 加上字符串索引签名，兼容 AppConfigInput 约束
  [key: string]: any
}

export { type AppConfig }
