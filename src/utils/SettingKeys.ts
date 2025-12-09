/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

/**
 * 公共文档分享属性，完全兼容免费版，但是有新增
 */
enum SettingKeys {
  // == 内部维护 ==
  /**
   * 分享状态，专业版不需要
   */
  // CUSTOM_PUBLISH_STATUS = "custom-publish-status",

  /**
   * 分享时间
   */
  CUSTOM_PUBLISH_TIME = "custom-publish-time",

  // == 业务维护 ==

  /**
   * 是否开启文档树
   */
  CUSTOM_DOC_TREE_ENABLE = "custom-doc-tree-enable",

  /**
   * 文档树深度
   */
  CUSTOM_DOC_TREE_LEVEL = "custom-doc-tree-level",

  /**
   * 是否开启文档大纲
   */
  CUSTOM_OUTLINE_ENABLE = "custom-outline-enable",

  /**
   * 文档大纲深度
   */
  CUSTOM_OUTLINE_LEVEL = "custom-outline-level",

  /**
   * 过期时间
   */
  CUSTOM_EXPIRES = "custom-expires",
}

export { SettingKeys }
