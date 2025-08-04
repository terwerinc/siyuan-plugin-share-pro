/*
 * Copyright (c) 2023, Terwer . All rights reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * This code is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 2 only, as
 * published by the Free Software Foundation.  Terwer designates this
 * particular file as subject to the "Classpath" exception as provided
 * by Terwer in the LICENSE file that accompanied this code.
 *
 * This code is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
 * version 2 for more details (a copy is included in the LICENSE file that
 * accompanied this code).
 *
 * You should have received a copy of the GNU General Public License version
 * 2 along with this work; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA.
 *
 * Please contact Terwer, Shenzhen, Guangdong, China, youweics@163.com
 * or visit www.terwer.space if you need additional information or have any
 * questions.
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

  // 加上字符串索引签名，兼容 AppConfigInput 约束
  [key: string]: any
}

export { type AppConfig }
