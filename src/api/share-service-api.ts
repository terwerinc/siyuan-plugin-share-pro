/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2024 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import { isDev, SHARE_PRO_STORE_NAME } from "../Constants"
import ShareProPlugin from "../index"
import { ShareProConfig } from "../models/ShareProConfig"
import { ILogger, simpleLogger } from "zhi-lib-base"
import { showMessage } from "siyuan"

class ShareServiceApi {
  private logger: ILogger
  private pluginInstance: ShareProPlugin

  constructor(pluginInstance: ShareProPlugin) {
    this.pluginInstance = pluginInstance
    this.logger = simpleLogger("share-service-api", "custom-slug", isDev)
  }

  public async createShare() {
    const shareBody = {
      docId: "20220924223854-qygzxps",
      html: '[{"tag":"p","children":["简单分享测试啊240627。Hello, world!"]}]',
      docAttrs: "{}",
    }
    const res = await this.shareServiceRequest(ServiceApiKeys.API_SHARE_CREATE, shareBody)
    this.logger.info("share created =>", res)
    return res
  }

  public async getVipInfo(token: string) {
    const headers = {
      Authorization: `${token}`,
    }
    const res = await this.shareServiceRequest(ServiceApiKeys.API_LICENSE_VIP_INFO, {}, headers)
    this.logger.info("vip info =>", res)
    return res
  }

  // ================
  // private function
  // ================

  /**
   * 向思源请求数据
   *
   * @param url - url
   * @param data - 数据
   * @param headers - 头部信息
   */
  private async shareServiceRequest(
    url: string,
    data: object,
    headers?: Record<string, any>
  ): Promise<ServiceResponse> {
    const cfg = await this.pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
    const shareApiEndPoint = cfg?.serviceApiConfig?.apiUrl ?? ""
    if (shareApiEndPoint.trim() == "") {
      showMessage("未找到分享服务，请先初始化", 7000, "error")
      return
    }
    const reqUrl = `${shareApiEndPoint}${url}`

    const fetchOps = {
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(data),
      method: "POST",
    }
    if (cfg.serviceApiConfig.token !== "") {
      Object.assign(fetchOps, {
        headers: {
          Authorization: `${cfg.serviceApiConfig.token}`,
        },
      })
    }

    if (isDev) {
      this.logger.debug("开始向分享服务请求数据，reqUrl=>", reqUrl)
      this.logger.debug("开始向分享服务请求数据，fetchOps=>", fetchOps)
    }

    const response = await fetch(reqUrl, fetchOps)
    const resJson = await response.json()
    if (isDev) {
      this.logger.debug("分享服务请求数据返回，resJson=>", resJson)
    }
    return resJson
  }
}

enum ServiceApiKeys {
  API_SHARE_CREATE = "/api/share/create",
  API_LICENSE_VIP_INFO = "/api/license/vipInfo",
}

class ServiceResponse {
  code: number
  msg: string
  data: any
}

export { ShareServiceApi, ServiceResponse }
