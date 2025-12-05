/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2024 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import { IServiceApiConfig } from "../types"
import { AppConfig } from "./AppConfig"

class ShareProConfig {
  siyuanConfig?: {
    apiUrl: string
    token: string
    cookie: string
    preferenceConfig?: {
      fixTitle: boolean
      docTreeEnable: boolean
      docTreeLevel: number
      outlineEnable: boolean
      outlineLevel: number
    }
  }
  serviceApiConfig?: IServiceApiConfig
  appConfig?: AppConfig
  isCustomCssEnabled?: boolean
  /**
   * 是否启用新 UI
   *
   * @author terwer
   * @since 1.9.0
   */
  isNewUIEnabled?: boolean
  inited: boolean
}

export { ShareProConfig }
