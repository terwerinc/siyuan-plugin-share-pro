<!--
  -            GNU GENERAL PUBLIC LICENSE
  -               Version 3, 29 June 2007
  -
  -  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
  -  Everyone is permitted to copy and distribute verbatim copies
  -  of this license document, but changing it is not allowed.
  -->

<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from "svelte"

  export let title: string = ""
  export let targetElement: HTMLElement | null = null
  export let offsetX: number = 0
  export let offsetY: number = -30

  let popoverElement: HTMLElement | null = null
  let isVisible: boolean = false

  const dispatch = createEventDispatcher()

  // 显示popover
  const show = () => {
    if (!targetElement || !title) return

    // 如果已经存在popover元素，先移除它
    if (popoverElement) {
      popoverElement.remove()
    }

    // 创建popover元素
    popoverElement = document.createElement('div')
    popoverElement.className = 'siyuan-popover'
    popoverElement.textContent = title
    
    // 设置样式
    popoverElement.style.position = 'absolute'
    popoverElement.style.background = '#333'
    popoverElement.style.color = 'white'
    popoverElement.style.padding = '4px 8px'
    popoverElement.style.borderRadius = '4px'
    popoverElement.style.whiteSpace = 'nowrap'
    popoverElement.style.zIndex = '1001'
    popoverElement.style.fontSize = '12px'
    popoverElement.style.pointerEvents = 'none'
    popoverElement.style.transform = 'translateX(-50%)'
    
    // 定位popover
    const rect = targetElement.getBoundingClientRect()
    popoverElement.style.top = `${rect.top + window.scrollY + offsetY}px`
    popoverElement.style.left = `${rect.left + window.scrollX + rect.width / 2 + offsetX}px`

    // 添加到文档中
    document.body.appendChild(popoverElement)
    isVisible = true
  }

  // 隐藏popover
  const hide = () => {
    if (popoverElement) {
      popoverElement.remove()
      popoverElement = null
      isVisible = false
    }
  }

  // 切换popover显示状态
  const toggle = () => {
    if (isVisible) {
      hide()
    } else {
      show()
    }
  }

  onMount(() => {
    // 组件挂载时如果有目标元素和标题，则显示popover
    if (targetElement && title) {
      show()
    }
  })

  onDestroy(() => {
    // 组件销毁时移除popover
    hide()
  })

  // 暴露方法给外部使用
  export const popoverApi = {
    show,
    hide,
    toggle
  }
</script>

<div class="popover-container">
  <!-- 这里可以放置触发popover的元素内容 -->
  <slot></slot>
</div>

<style>
  .popover-container {
    display: inline-block;
  }
</style>