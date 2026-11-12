/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2022-2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

/**
 * 文档工具类
 */
class PageUtil {
  public static getPageId() {
    // 富文本标题也带 protyle 类；仅定位实际文档编辑器。
    const protyleElement = document.querySelector("div.protyle:not(.fn__none):not(.protyle-lite-fragment)")
    // 在该 div 元素下查找包含 protyle-title 类的 div 元素，并查找 data-node-id 属性
    const protyleTitleElement = protyleElement?.querySelector("div.protyle-title")
    // 如果该元素存在 data-node-id 属性，则获取其值并返回，否则返回空字符串
    return protyleTitleElement?.hasAttribute("data-node-id") ? protyleTitleElement.getAttribute("data-node-id") : ""
  }
}

export default PageUtil
