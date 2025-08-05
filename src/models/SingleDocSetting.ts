/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import { SettingKeys } from "../utils/SettingKeys"

/**
 * 文档级别设置
 *
 * @author terwer
 * @since 1.13.0
 */
class SingleDocSetting {
  /**
   * 是否显示文档树
   *
   * @author terwer
   * @since 1.13.0
   */
  public docTreeEnable?: boolean

  /**
   * 文档树层级
   *
   * @author terwer
   * @since 1.13.0
   */
  public docTreeLevel?: number

  /**
   * 是否显示大纲
   *
   * @author terwer
   * @since 1.13.0
   */
  public outlineEnable?: boolean

  /**
   * 大纲层级
   *
   * @author terwer
   * @since 1.13.0
   */
  public outlineLevel?: number

  /**
   * 分享有效期（秒），0 表示永久有效
   *
   * @author terwer
   * @since 1.13.0
   */
  public expiresTime?: number | string
}

export { SingleDocSetting }
