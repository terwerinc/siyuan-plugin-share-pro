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

/**
 * 计算字符串中汉字字符的数量
 * @param str 输入字符串
 * @returns 汉字字符数量
 */
const getChineseCharCount = (str: string): number => {
  if (!str) return 0

  let count = 0
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i)
    // 判断是否为汉字字符（常用汉字范围）
    if (charCode >= 0x4e00 && charCode <= 0x9fff) {
      count++
    }
  }
  return count
}

/**
 * 根据汉字字符数量截取字符串
 * @param str 输入字符串
 * @param maxChineseChars 最大汉字字符数
 * @returns 截取后的字符串
 */
const truncateByChineseChar = (str: string, maxChineseChars: number): string => {
  if (!str || maxChineseChars <= 0) return ""

  let chineseCharCount = 0
  let endIndex = 0

  for (let i = 0; i < str.length && chineseCharCount < maxChineseChars; i++) {
    const charCode = str.charCodeAt(i)
    // 如果是汉字字符，计数加一
    if (charCode >= 0x4e00 && charCode <= 0x9fff) {
      chineseCharCount++
    }
    endIndex = i + 1
  }

  // 如果已经达到了最大汉字字符数，但下一个字符不是汉字，
  // 我们也包含它以避免截断英文单词
  if (chineseCharCount === maxChineseChars && endIndex < str.length) {
    const nextCharCode = str.charCodeAt(endIndex)
    if (nextCharCode < 0x4e00 || nextCharCode > 0x9fff) {
      // 包含下一个非汉字字符
      endIndex++
    }
  }

  return str.substring(0, endIndex)
}

export { getChineseCharCount, isEmptyString, safeParse, truncateByChineseChar }
