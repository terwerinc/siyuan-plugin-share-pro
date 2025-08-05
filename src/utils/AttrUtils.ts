/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import ShareProPlugin from "../index"
import { ApiUtils } from "./ApiUtils"
import { SettingKeys } from "./SettingKeys"
import { SingleDocSetting } from "../models/SingleDocSetting"

/**
 * 通用属性读取
 *
 * @author terwer
 * @since 1.13.0
 */
class AttrUtils {
  public static async getInt(pluginInstance: ShareProPlugin, docId: string, key: string) {
    const str = await this.getStr(pluginInstance, docId, key)
    if (isNaN(Number(str))) {
      return undefined
    }
    return parseInt(str)
  }

  public static async getBool(pluginInstance: ShareProPlugin, docId: string, key: string) {
    const str = await this.getStr(pluginInstance, docId, key)
    return str === "true"
  }

  public static async getStr(pluginInstance: ShareProPlugin, docId: string, key: string) {
    const { kernelApi } = await ApiUtils.getSiyuanKernelApi(pluginInstance)
    return await kernelApi.getSingleBlockAttr(docId, key)
  }

  public static toAttrs(from: Partial<SingleDocSetting>): Record<string, string> {
    const attrs: Record<string, string> = {}
    if (typeof from.docTreeEnable !== "undefined") {
      attrs[SettingKeys.CUSTOM_DOC_TREE_ENABLE] = from.docTreeEnable.toString()
    } else {
      attrs[SettingKeys.CUSTOM_DOC_TREE_ENABLE] = ""
    }
    if (typeof from.docTreeLevel !== "undefined" && !isNaN(from.docTreeLevel)) {
      attrs[SettingKeys.CUSTOM_DOC_TREE_LEVEL] = from.docTreeLevel.toString()
    } else {
      attrs[SettingKeys.CUSTOM_DOC_TREE_LEVEL] = ""
    }
    if (typeof from.outlineEnable !== "undefined") {
      attrs[SettingKeys.CUSTOM_OUTLINE_ENABLE] = from.outlineEnable.toString()
    } else {
      attrs[SettingKeys.CUSTOM_OUTLINE_ENABLE] = ""
    }
    if (typeof from.outlineLevel !== "undefined" && !isNaN(from.outlineLevel)) {
      attrs[SettingKeys.CUSTOM_OUTLINE_LEVEL] = from.outlineLevel.toString()
    } else {
      attrs[SettingKeys.CUSTOM_OUTLINE_LEVEL] = ""
    }
    if (typeof from.expiresTime !== "undefined") {
      attrs[SettingKeys.CUSTOM_EXPIRES] = from.expiresTime.toString()
    } else {
      attrs[SettingKeys.CUSTOM_EXPIRES] = ""
    }
    return attrs
  }
}

export { AttrUtils }
