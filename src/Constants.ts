/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2022-2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

export const DEFAULT_SIYUAN_LANG = window.siyuan.config.lang
export const isDev = typeof process === "undefined" ? false : process.env.DEV_MODE === "true"
export const DEFAULT_SIYUAN_API_URL = window.location.origin
export const DEFAULT_SIYUAN_AUTH_TOKEN = ""
export const DEFAULT_SIYUAN_COOKIE = ""
export const SHARE_PRO_STORE_NAME = "share-pro.json"
export const SHARE_SERVICE_ENDPOINT_DEV = "http://localhost:8086"
export const SHARE_SERVICE_ENDPOINT_PROD = "https://api.terwergreen.com"
export const SHARE_LIST_PAGE_SIZE = 10
export const NULL_VALUE_FOR_SIYUAN_ATTR_REMOVE = null

/**
 * 引用文档分享的最大递归深度
 * 当前为内部配置，暂不对用户开放
 * 设计考量：
 * 1. 防止无限递归导致的性能问题
 * 2. 平衡分享完整性与系统稳定性
 * 3. 参考飞书/钉钉等产品的默认行为，3层足以覆盖大多数场景
 */
export const DEFAULT_SHARE_REFERENCES_MAX_DEPTH = 3
