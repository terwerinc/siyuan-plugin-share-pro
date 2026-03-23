/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */


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

  /**
   * 是否分享子文档
   *
   * @author terwer
   * @since 1.16.0
   */
  public shareSubdocuments?: boolean

  /**
   * 子文档分享数量限制，-1表示无限制，最大999
   *
   * @author terwer
   * @since 1.16.0
   */
  public maxSubdocuments?: number

  /**
   * 是否分享引用文档
   *
   * @author terwer
   * @since 1.16.0
   */
  public shareReferences?: boolean

  /**
   * 用户手动选择的子文档ID列表
   * 当用户在ShareUI中自定义选择子文档时使用，优先级高于自动获取
   *
   * @author terwer
   * @since 1.16.0
   */
  public selectedSubdocIds?: string[]
}

export { SingleDocSetting }
