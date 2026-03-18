<script lang="ts">
  import { onMount, onDestroy } from "svelte"

  // Props
  export let title: string = "确认操作"
  export let message: string = ""
  export let confirmText: string = "确认"
  export let cancelText: string = "取消"
  export let show: boolean = false
  export let onConfirm: () => void = () => {}
  export let onCancel: () => void = () => {}

  // Local state
  let isVisible = false
  let isAnimating = false

  // Handle show prop changes
  $: if (show) {
    isVisible = true
    isAnimating = true
    // Prevent body scroll
    document.body.style.overflow = "hidden"
  }

  // Handle close
  function handleClose() {
    isAnimating = false
    setTimeout(() => {
      isVisible = false
      document.body.style.overflow = ""
      onCancel()
    }, 300)
  }

  // Handle confirm
  function handleConfirm() {
    isAnimating = false
    setTimeout(() => {
      isVisible = false
      document.body.style.overflow = ""
      onConfirm()
    }, 300)
  }

  // Close on escape key
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      handleClose()
    }
  }

  // Close on outside click
  function handleOutsideClick(e: MouseEvent) {
    const target = e.target as HTMLElement
    if (target.classList.contains("share-pro-confirm-overlay")) {
      handleClose()
    }
  }

  onMount(() => {
    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("click", handleOutsideClick)
  })

  onDestroy(() => {
    document.removeEventListener("keydown", handleKeyDown)
    document.removeEventListener("click", handleOutsideClick)
    document.body.style.overflow = ""
  })
</script>

{#if isVisible}
  <div class="share-pro-confirm-overlay" style="opacity: {isAnimating ? 1 : 0}; transition: opacity 0.3s ease;">
    <div class="share-pro-confirm-modal" style="transform: translateY({isAnimating ? '0' : '-20px'}); opacity: {isAnimating ? 1 : 0}; transition: transform 0.3s ease, opacity 0.3s ease;">
      <div class="share-pro-confirm-header">
        <h3 class="share-pro-confirm-title">{title}</h3>
        <button
          class="share-pro-confirm-close"
          on:click={handleClose}
          aria-label="关闭"
        >
          ×
        </button>
      </div>

      <div class="share-pro-confirm-body">
        <p class="share-pro-confirm-message">{message}</p>
      </div>

      <div class="share-pro-confirm-footer">
        <button
          class="share-pro-confirm-cancel"
          on:click={handleClose}
        >
          {cancelText}
        </button>
        <button
          class="share-pro-confirm-confirm"
          on:click={handleConfirm}
        >
          {confirmText}
        </button>
      </div>
    </div>
  </div>
{/if}

<style lang="stylus">
.share-pro-confirm-overlay
  position fixed
  top 0
  left 0
  right 0
  bottom 0
  background-color rgba(0, 0, 0, 0.6)
  display flex
  align-items center
  justify-content center
  z-index 9999
  backdrop-filter blur(8px)

.share-pro-confirm-modal
  background-color var(--b3-theme-background)
  border-radius 12px
  box-shadow 0 8px 32px rgba(0, 0, 0, 0.3)
  border 1px solid var(--b3-theme-surface-light)
  min-width 400px
  max-width 90vw
  padding 24px
  font-family "Open Sans", "LXGW WenKai", "JetBrains Mono", "-apple-system", "Microsoft YaHei", "Times New Roman", "方正北魏楷书_GBK", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif

.share-pro-confirm-header
  display flex
  justify-content space-between
  align-items center
  margin-bottom 16px
  padding-bottom 12px
  border-bottom 1px solid var(--b3-theme-surface-light)

.share-pro-confirm-title
  font-size 18px
  font-weight 600
  color var(--b3-theme-on-surface)
  margin 0

.share-pro-confirm-close
  background none
  border none
  font-size 24px
  color var(--b3-theme-on-surface)
  cursor pointer
  width 32px
  height 32px
  display flex
  align-items center
  justify-content center
  border-radius 50%
  transition all 0.2s ease
  &:hover
    background-color var(--b3-theme-surface-light)
    color var(--b3-theme-primary)

.share-pro-confirm-body
  margin-bottom 24px

.share-pro-confirm-message
  font-size 14px
  line-height 1.6
  color var(--b3-theme-on-surface)
  margin 0
  white-space pre-line

.share-pro-confirm-footer
  display flex
  gap 12px
  justify-content flex-end

.share-pro-confirm-cancel
  padding 8px 16px
  font-size 14px
  color var(--b3-theme-on-surface)
  background-color transparent
  border 1px solid var(--b3-theme-surface-light)
  border-radius 6px
  cursor pointer
  transition all 0.2s ease
  &:hover
    background-color var(--b3-theme-surface-light)
  &:active
    transform translateY(1px)

.share-pro-confirm-confirm
  padding 8px 16px
  font-size 14px
  color white
  background-color var(--b3-theme-primary)
  border none
  border-radius 6px
  cursor pointer
  transition all 0.2s ease
  &:hover
    background-color var(--b3-theme-primary-hover)
    box-shadow 0 2px 8px rgba(24, 144, 255, 0.3)
  &:active
    transform translateY(1px)

// Mobile responsive
@media (max-width: 768px)
  .share-pro-confirm-modal
    min-width auto
    margin 16px
    padding 20px

// Dark mode support (should work automatically with var(--b3-theme-*) variables)
html[data-theme-mode="dark"]
  .share-pro-confirm-overlay
    background-color rgba(0, 0, 0, 0.7)
  .share-pro-confirm-close:hover
    background-color rgba(255, 255, 255, 0.1)
</style>