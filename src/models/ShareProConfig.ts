/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2024 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import { AppConfig } from "./AppConfig"
import type { IServiceApiConfig } from "../types"

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
  
  /**
   * 增量分享配置
   *
   * @author terwer
   * @since 1.15.0
   */
  incrementalShareConfig?: {
    /**
     * 是否启用增量分享
     */
    enabled: boolean
    
    /**
     * 上次增量分享时间戳
     */
    lastShareTime?: number
    
    /**
     * 默认选择行为
     */
    defaultSelectionBehavior?: "all" | "none" | "remember"
    
    /**
     * 变更检测缓存策略
     */
    cacheStrategy?: "memory" | "disk" | "hybrid"
  }
  
  inited: boolean
}

export { ShareProConfig }
