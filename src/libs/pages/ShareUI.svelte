<!--
  -            GNU GENERAL PUBLIC LICENSE
  -               Version 3, 29 June 2007
  -
  -  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
  -  Everyone is permitted to copy and distribute verbatim copies
  -  of this license document, but changing it is not allowed.
  -->

<script lang="ts">
  import { Post } from "zhi-blog-api"
  import { onMount } from "svelte"
  import { ShareProConfig } from "../../models/ShareProConfig"
  import { SHARE_PRO_STORE_NAME } from "../../Constants"
  import ShareProPlugin from "../../index"
  import { useSiyuanApi } from "../../composables/useSiyuanApi"

  export let pluginInstance: ShareProPlugin
  export let docId: string
  let singleDocSetting: any

  let formData = {
    post: Post as any,
    shared: false,
  }

  const handleShare = () => {}

  const initSingleDocSetting = async (cfg: ShareProConfig) => {
    const singleDocSettingKey = "share-pro-setting"
    const { kernelApi } = useSiyuanApi(cfg)
    singleDocSetting = await kernelApi.getSingleBlockAttr(docId, singleDocSettingKey)
    // 初始化
    if (!singleDocSetting) {
      singleDocSetting = {}
      await kernelApi.setSingleBlockAttr(docId, singleDocSettingKey, JSON.stringify({}))
    }
    // 同步配置
    const { docTreeEnable, docTreeLevel, outlineEnable, outlineLevel } = singleDocSetting
    cfg.siyuanConfig.preferenceConfig = {
      ...cfg.siyuanConfig.preferenceConfig,
      docTreeEnable: docTreeEnable ?? cfg.siyuanConfig?.preferenceConfig?.docTreeEnable ?? false,
      docTreeLevel: docTreeLevel ?? cfg.siyuanConfig?.preferenceConfig?.docTreeLevel ?? 3,
      outlineEnable: outlineEnable ?? cfg.siyuanConfig?.preferenceConfig?.outlineEnable ?? false,
      outlineLevel: outlineLevel ?? cfg.siyuanConfig?.preferenceConfig?.outlineLevel ?? 6,
    }
  }

  onMount(async () => {
    // 初始化单篇文档分享设置
    const cfg = await pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
    await initSingleDocSetting(cfg)
    // 初始化文档
    const { blogApi } = useSiyuanApi(cfg)
    formData.post = await blogApi.getPost(docId)
  })
</script>

<div id="share">
  {#if typeof formData.post.title === "undefined"}
    <div class="loading-spinner">
      <div class="spinner" />
    </div>
  {:else}
    <div class="share-header">
      <div class="share-title">{formData.post.title}</div>
    </div>
    <div class="divider" />

    <div class="share-settings">
      <div class="setting-row">
        <span class="setting-label">
          {pluginInstance.i18n.sharePro} - {pluginInstance.i18n.shareProDesc}
        </span>
        <input
          class="b3-switch fn__flex-center"
          type="checkbox"
          bind:checked={formData.shared}
          on:change={handleShare}
        />
      </div>
    </div>
  {/if}
</div>

<style lang="stylus">
  #share
    font-family "Open Sans", "LXGW WenKai", "JetBrains Mono", "-apple-system", "Microsoft YaHei", "Times New Roman",
    "方正北魏楷书_GBK", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans",
    "Droid Sans", "Helvetica Neue", sans-serif
    max-width 600px
    min-width 475px
    margin auto
    padding 8px
    padding-top 10px
    padding-bottom 0
    padding-left 14px
    padding-right 14px

  .share-header
    font-size 14px
    font-weight 600

  .divider
    height 1px
    margin 8px 0

  .loading-spinner
    display flex
    justify-content center
    align-items center
    height 80px

  .spinner
    width 24px
    height 24px
    border 3px solid #ccc
    border-top 3px solid #0073e6
    border-radius 50%
    animation spin 1s linear infinite

  @keyframes spin
    from
      transform rotate(0deg)
    to
      transform rotate(360deg)

  .share-content
    margin-top 14px

  .setting-row
    display flex
    align-items center
    justify-content space-between
    margin-bottom 10px
    gap 8px

  .setting-label
    font-size 14px
    white-space nowrap /* 防止换行，字段宽度自适应 */
    margin-right 8px

  /* 与输入框保持适当间距 */

  .input-group
    display flex
    align-items center
    gap 8px
    flex-grow 1 /* 输入框占据剩余空间 */
    width 100%

  .input-group input,
  .input-group select
    flex-grow 1
    height 28px
    padding 4px 8px
    border 1px solid #cccccc
    border-radius 4px
    font-size 14px
    background-color #f9f9f9
    color #333333
    box-sizing border-box
    min-width 0

  /* 防止 flex 布局导致超出容器 */

  .input-group input:focus,
  .input-group select:focus
    outline none
    border-color #0073e6
    box-shadow 0 0 4px rgba(0, 115, 230, 0.5)

  .share-link-input
    height 28px
    padding 4px 8px
    border 1px solid #cccccc
    border-radius 4px
    font-size 14px
    background-color #f0f0f0 /* 禁用时的背景色 */
    color #aaaaaa /* 禁用时的文字颜色 */
    box-sizing border-box
    cursor not-allowed

  /* 表明是不可交互的 */

  button
    padding 4px 12px
    font-size 14px
    color #ffffff
    border none
    border-radius 4px
    cursor pointer
    background-color #0073e6
    transition all 0.2s ease
    white-space nowrap /* 防止按钮内容换行 */
    flex-shrink 0

  /* 按钮保持固定大小 */

  button:hover
    background-color #005bb5
    transform scale(1.05)

  .info-text
    font-size 12px
    margin-top 8px
    margin-bottom 8px
    color #ff4d4f

  html[data-theme-mode="light"]
    .divider
      background-color #e3e3e3

    .input-group input,
    .input-group select
      border-color #cccccc
      background-color #f9f9f9

    .share-link-input
      border-color #cccccc
      background-color #f0f0f0
      color #aaaaaa

    button
      background-color #0073e6

    button:hover
      background-color #005bb5

    .info-text
      color #ff4d4f

  html[data-theme-mode="dark"]
    .divider
      background-color #333333

    .input-group input
      border-color #444444
      background-color #2c2c2c

    .input-group input:not([readonly])
      color var(--b3-theme-on-background)
      background-color #2c2c2c
      border-color #444444

    .input-group input:not([readonly]):focus
      border-color #0073e6
      background-color #3a3a3a
      box-shadow 0 0 4px rgba(0, 115, 230, 0.5)

    .input-group select
      border-color #444444
      color var(--b3-theme-on-background)
      background-color #2c2c2c

    .input-group select option
      color var(--b3-theme-on-background)
      background-color #444444

      &:hover, &:focus
        background-color #555555
        color #ffffff

    .share-link-input
      border-color #444444
      background-color #3a3a3a
      color #666666

    button
      background-color #0073e6

    button:hover
      background-color #005bb5

    .info-text
      color #ff7875
</style>
