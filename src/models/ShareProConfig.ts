/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2024 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import { IServiceApiConfig } from "./cfg"
import { AppConfig } from "./AppConfig"

class ShareProConfig {
  siyuanConfig?: {
    apiUrl: string
    token: string
    cookie: string
    preferenceConfig?: {
      fixTitle: boolean
    }
  }
  serviceApiConfig?: IServiceApiConfig
  appConfig?: AppConfig
  isCustomCssEnabled?: boolean
  inited: boolean
}

export { ShareProConfig }
