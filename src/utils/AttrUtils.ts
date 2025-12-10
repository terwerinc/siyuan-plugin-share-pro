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
import { isEmptyString } from "./utils"
import { NULL_VALUE_FOR_SIYUAN_ATTR_REMOVE } from "../Constants"

/**
 * 通用属性读取
 *
 * @author terwer
 * @since 1.13.0
 */
class AttrUtils {
  public static async getInt(pluginInstance: ShareProPlugin, docId: string, key: string): Promise<number> {
    const str = await this.getStr(pluginInstance, docId, key)
    if (isEmptyString(str)) {
      return undefined
    }
    const num = parseInt(str)
    return isNaN(num) ? undefined : num
  }

  public static async getBool(
    pluginInstance: ShareProPlugin,
    docId: string,
    key: string
  ): Promise<boolean | undefined> {
    const str = await this.getStr(pluginInstance, docId, key)
    if (isEmptyString(str)) {
      return undefined
    }
    return str === "true"
  }

  public static async getStr(pluginInstance: ShareProPlugin, docId: string, key: string): Promise<string> {
    const { kernelApi } = await ApiUtils.getSiyuanKernelApi(pluginInstance)
    return await kernelApi.getSingleBlockAttr(docId, key)
  }

  /**
   * 将 SingleDocSetting 对象转换为键值对（键为 SettingKeys 枚举值）
   * @param from 部分 SingleDocSetting 对象
   * @returns 键为 SettingKeys 枚举值，值为字符串的 Record
   */
  public static toAttrs(from: Partial<SingleDocSetting>): Record<SettingKeys, string> {
    // 初始化返回对象，限定键为 SettingKeys 枚举
    const attrs: Partial<Record<SettingKeys, string>> = {}

    // 字段映射配置（核心映射关系）
    const fieldMappings: Array<{ objectKey: keyof SingleDocSetting; settingKey: SettingKeys; isNumber: boolean }> = [
      {
        objectKey: "docTreeEnable",
        settingKey: SettingKeys.CUSTOM_DOC_TREE_ENABLE,
        isNumber: false,
      },
      {
        objectKey: "docTreeLevel",
        settingKey: SettingKeys.CUSTOM_DOC_TREE_LEVEL,
        isNumber: true,
      },
      {
        objectKey: "outlineEnable",
        settingKey: SettingKeys.CUSTOM_OUTLINE_ENABLE,
        isNumber: false,
      },
      {
        objectKey: "outlineLevel",
        settingKey: SettingKeys.CUSTOM_OUTLINE_LEVEL,
        isNumber: true,
      },
      {
        objectKey: "expiresTime",
        settingKey: SettingKeys.CUSTOM_EXPIRES,
        isNumber: false,
      },
    ]

    // 处理每个字段
    fieldMappings.forEach(({ objectKey, settingKey, isNumber }) => {
      // 首先检查 from 是否存在
      if (!from || typeof from !== "object") {
        attrs[settingKey] = NULL_VALUE_FOR_SIYUAN_ATTR_REMOVE
        return attrs
      }
      // 1. 获取原始值（直接从接口键名获取）
      // const value = from[objectKey]
      const value = Object.prototype.hasOwnProperty.call(from, objectKey) ? from[objectKey] : undefined

      // 2. 验证逻辑（完全拆解版）
      // 2.1 检查值是否已定义
      const isDefined = typeof value !== "undefined"

      // 2.2 如果是数字字段，检查有效性
      let isValueValid = true
      if (isNumber) {
        const numericValue = Number(value)
        isValueValid = !isNaN(numericValue)
      }

      // 3. 赋值到目标枚举键
      attrs[settingKey] =
        isDefined && isValueValid
          ? value!.toString() // 非空断言（因前序检查已确保安全）
          : NULL_VALUE_FOR_SIYUAN_ATTR_REMOVE
    })

    // 类型断言（因 Partial 转完整 Record）
    return attrs as Record<SettingKeys, string>
  }
}

export { AttrUtils }
