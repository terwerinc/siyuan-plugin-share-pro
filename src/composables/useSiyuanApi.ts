/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2024 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 *
 */

import { simpleLogger } from "zhi-lib-base"
import { isDev } from "../Constants"
import { SiYuanApiAdaptor, SiyuanConfig, SiyuanKernelApi } from "zhi-siyuan-api"
import { ShareProConfig } from "../models/ShareProConfig"

/**
 * 通用 Siyuan API 封装
 */
export const useSiyuanApi = (cfg: ShareProConfig) => {
  const logger = simpleLogger("use-siyuan-api", "share-pro", isDev)

  const siyuanConfig = new SiyuanConfig(cfg.siyuanConfig.apiUrl, cfg.siyuanConfig.token)
  // 开启了授权码可能不可用
  siyuanConfig.cookie = cfg.siyuanConfig.cookie
  // 一些常用设置
  siyuanConfig.preferenceConfig.fixTitle = true
  siyuanConfig.preferenceConfig.removeFirstH1 = true
  siyuanConfig.preferenceConfig.removeMdWidgetTag = true
  const blogApi = new SiYuanApiAdaptor(siyuanConfig)
  const kernelApi = new SiyuanKernelApi(siyuanConfig)
  logger.debug("siyuan api initd")

  return {
    blogApi,
    kernelApi,
  }
}