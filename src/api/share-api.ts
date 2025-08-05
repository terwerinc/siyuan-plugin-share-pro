/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2024 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import { showMessage } from "siyuan"
import { ILogger, simpleLogger } from "zhi-lib-base"
import { isDev, SHARE_PRO_STORE_NAME } from "../Constants"
import ShareProPlugin from "../index"
import { ShareProConfig } from "../models/ShareProConfig"

class ShareApi {
  private logger: ILogger
  private pluginInstance: ShareProPlugin

  constructor(pluginInstance: ShareProPlugin) {
    this.pluginInstance = pluginInstance
    this.logger = simpleLogger("share-service-api", "share-pro", isDev)
  }

  public async getDoc(docId: string, token?: string) {
    const headers = {
      Authorization: `${token}`,
    }
    const body = {
      fdId: docId,
    }
    const res = await this.shareServiceRequest(ServiceApiKeys.API_SHARE_GET_DOC, body, headers)
    this.logger.info("get doc info =>", res)
    return res
  }

  async deleteDoc(docId: string) {
    const body = {
      fdId: docId,
    }
    const res = await this.shareServiceRequest(ServiceApiKeys.API_SHARE_DELETE_DOC, body)
    this.logger.info("delete doc =>", res)
    return res
  }

  public async createShare(shareBody: any) {
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

  public async uploadMedia(shareBody: any) {
    const res = await this.shareServiceRequest(ServiceApiKeys.API_UPLOAD_MEDIA, shareBody)
    this.logger.info("media uploaded =>", res)
    return res
  }

  public async listDoc(params: any) {
    const res = await this.shareServiceRequest(ServiceApiKeys.API_LIST_DOC, params)
    this.logger.info("get share list =>", res)
    return res
  }

  public async getSettingByAuthor(author: string) {
    const params = {
      group: "GENERAL",
      key: "static.app.config.json",
      author: author,
    }
    const res = (await this.shareServiceRequest(ServiceApiKeys.API_GET_SETTING_BY_AUTHOR, params, {})) as any
    this.logger.info("get setting by author=>", res)
    return res
  }

  public async saveSetting(token: string, setting: any) {
    const headers = {
      Authorization: `${token}`,
    }
    const params = {
      group: "GENERAL",
      key: "static.app.config.json",
      value: JSON.stringify(setting),
    }
    const res = await this.shareServiceRequest(ServiceApiKeys.API_UPDATE_SETTING, params, headers)
    this.logger.info("get setting by author =>", res)
    return res
  }

  /**
   * 更新分享选项（如密码等），不重新上传内容
   */
  public async updateShareOptions(updateBody: any) {
    const res = await this.shareServiceRequest(ServiceApiKeys.API_SHARE_UPDATE_OPTIONS, updateBody)
    this.logger.info("share options updated =>", res)
    return res
  }

  // ================
  // private function
  // ================

  /**
   * 向分享服务数据
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
      fetchOps.headers["Authorization"] = `${cfg.serviceApiConfig.token}`
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
  API_SHARE_GET_DOC = "/api/share/getDoc",
  API_SHARE_DELETE_DOC = "/api/share/delete",
  API_SHARE_CREATE = "/api/share/create",
  API_SHARE_UPDATE_OPTIONS = "/api/share/updateOptions",
  API_LICENSE_VIP_INFO = "/api/license/vipInfo",
  API_UPLOAD_MEDIA = "/api/asset/upload",
  API_LIST_DOC = "/api/share/listDoc",
  API_GET_SETTING = "/api/settings/share",
  API_GET_SETTING_BY_AUTHOR = "/api/settings/byAuthor",
  API_UPDATE_SETTING = "/api/settings/update",
}

class ServiceResponse {
  code: number
  msg: string
  data: any
}

export { ServiceResponse, ShareApi }
