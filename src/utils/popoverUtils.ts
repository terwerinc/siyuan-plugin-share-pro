/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2022-2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

/**
 * popover 工具类
 * 提供创建和管理 popover 的方法
 */
class PopoverManager {
  private static instance: PopoverManager
  private popoverElement: HTMLElement | null = null
  private popoverTimeout: any = null

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): PopoverManager {
    if (!PopoverManager.instance) {
      PopoverManager.instance = new PopoverManager()
    }
    return PopoverManager.instance
  }

  /**
   * 显示 popover
   * @param event 鼠标事件
   * @param title 要显示的标题
   * @param offsetX X轴偏移量，默认为0
   * @param offsetY Y轴偏移量，默认为-30（在元素上方）
   */
  public showPopover(event: MouseEvent, title: string, offsetX = 0, offsetY = -30): void {
    // 清除之前的定时器
    if (this.popoverTimeout) {
      clearTimeout(this.popoverTimeout)
      this.popoverTimeout = null
    }

    // 如果已经存在popover元素，先移除它
    if (this.popoverElement) {
      this.popoverElement.remove()
      this.popoverElement = null
    }

    // 创建popover元素
    this.popoverElement = document.createElement("div")
    this.popoverElement.className = "siyuan-utils-popover"
    this.popoverElement.textContent = title

    // 设置样式
    this.popoverElement.style.position = "absolute"
    this.popoverElement.style.background = "#333"
    this.popoverElement.style.color = "white"
    this.popoverElement.style.padding = "4px 8px"
    this.popoverElement.style.borderRadius = "4px"
    this.popoverElement.style.whiteSpace = "nowrap"
    this.popoverElement.style.zIndex = "1001"
    this.popoverElement.style.fontSize = "12px"
    this.popoverElement.style.pointerEvents = "none"
    this.popoverElement.style.transform = "translateX(-50%)"
    this.popoverElement.style.left = "50%"
    this.popoverElement.style.opacity = "0"
    this.popoverElement.style.transition = "opacity 0.1s ease-in-out"

    // 定位popover
    const rect = (event.target as HTMLElement).getBoundingClientRect()
    this.popoverElement.style.top = `${rect.top + window.scrollY + offsetY}px`
    this.popoverElement.style.left = `${rect.left + window.scrollX + rect.width / 2 + offsetX}px`

    // 添加到文档中
    document.body.appendChild(this.popoverElement)

    // 立即显示popover（添加一个小延迟以确保元素已添加到DOM中）
    setTimeout(() => {
      if (this.popoverElement) {
        this.popoverElement.style.opacity = "1"
      }
    }, 10)
  }

  /**
   * 隐藏 popover
   * @param delay 延迟隐藏的时间（毫秒），默认为0ms（立即隐藏）
   */
  public hidePopover(delay = 0): void {
    if (this.popoverTimeout) {
      clearTimeout(this.popoverTimeout)
    }

    this.popoverTimeout = setTimeout(() => {
      if (this.popoverElement) {
        // 添加淡出效果
        this.popoverElement.style.opacity = "0"
        // 等待淡出动画完成后移除元素
        setTimeout(() => {
          if (this.popoverElement) {
            this.popoverElement.remove()
            this.popoverElement = null
          }
        }, 100)
      }
      this.popoverTimeout = null
    }, delay)
  }
}

// 创建单例实例
const popoverManager = PopoverManager.getInstance()

/**
 * 显示 popover
 * @param event 鼠标事件
 * @param title 要显示的标题
 * @param offsetX X轴偏移量，默认为0
 * @param offsetY Y轴偏移量，默认为-30（在元素上方）
 */
const showPopover = (event: MouseEvent, title: string, offsetX = 0, offsetY = -30): void => {
  popoverManager.showPopover(event, title, offsetX, offsetY)
}

/**
 * 隐藏 popover
 * @param delay 延迟隐藏的时间（毫秒），默认为0ms（立即隐藏）
 */
const hidePopover = (delay = 0): void => {
  popoverManager.hidePopover(delay)
}

export { hidePopover, showPopover }
