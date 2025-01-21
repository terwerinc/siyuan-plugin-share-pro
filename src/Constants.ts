/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2022-2024 Terwer, Inc. <https://terwer.space/>
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
// export const SHARE_SERVICE_ENDPOINT_DEV = "https://api.terwergreen.com"
export const SHARE_SERVICE_ENDPOINT_PROD = "https://api.terwergreen.com"
export const SHARE_LIST_PAGE_SIZE = 10
