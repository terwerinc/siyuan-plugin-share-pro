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

  // == 增量分享相关 ==
  
  /**
   * 增量分享启用状态
   */
  INCREMENTAL_SHARE_ENABLED = "incremental-share-enabled",
  
  /**
   * 上次增量分享时间戳
   */
  INCREMENTAL_SHARE_LAST_TIME = "incremental-share-last-time",
  
  /**
   * 增量分享历史记录
   */
  INCREMENTAL_SHARE_HISTORY = "incremental-share-history",
  
  /**
   * 笔记本黑名单（逗号分隔的笔记本ID）
   */
  INCREMENTAL_SHARE_NOTEBOOK_BLACKLIST = "incremental-share-notebook-blacklist",
  
  /**
   * 文档黑名单（逗号分隔的文档ID）
   */
  INCREMENTAL_SHARE_DOC_BLACKLIST = "incremental-share-doc-blacklist",
}

export { SettingKeys }
