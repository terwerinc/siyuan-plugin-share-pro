/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2024 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import { ShareProConfig } from "../models/ShareProConfig"
import { SHARE_PRO_STORE_NAME } from "../Constants"
import { useSiyuanApi } from "../composables/useSiyuanApi"
import ShareProPlugin from "../index"

class ApiUtils {
  public static async getSiyuanKernelApi(pluginInstance: ShareProPlugin) {
    const cfg = await pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
    const { kernelApi } = useSiyuanApi(cfg)
    return {
      cfg,
      kernelApi,
    }
  }
}

export { ApiUtils }
