/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2022-2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

/**
 * 安全解析字符串
 *
 * @param str
 * @author terwer
 * @version 1.13.0
 */
const safeParse = <T>(str: string) => {
  try {
    return JSON.parse(str)
  } catch (e) {
    return {} as T
  }
}

const isEmptyString = (str: string) => {
  return str === undefined || str === null || str === "" || str.trim().length === 0
}

export { safeParse, isEmptyString }
