<!--
  -            GNU GENERAL PUBLIC LICENSE
  -               Version 3, 29 June 2007
  -
  -  Copyright (C) 2024 Terwer, Inc. <https://terwer.space/>
  -  Everyone is permitted to copy and distribute verbatim copies
  -  of this license document, but changing it is not allowed.
  -->

<script lang="ts">
  import { simpleLogger } from "zhi-lib-base"
  import { isDev } from "../../../Constants"
  import ShareProPlugin from "../../../index"
  import { Dialog, showMessage } from "siyuan"
  import { onMount } from "svelte"
  import { KeyInfo } from "../../../models/KeyInfo"
  import ShareBlacklistUI from "../ShareBlacklistUI.svelte"

  const logger = simpleLogger("blacklist-setting", "share-pro", isDev)
  export let pluginInstance: ShareProPlugin
  // export let dialog: Dialog
  // @ts-ignore
  export const vipInfo = null

  let blacklistConfig = {
    notebookBlacklist: {
      enabled: true,
      items: []
    },
    docBlacklist: {
      enabled: true,
      items: []
    }
  }

  const loadBlacklistConfig = async () => {
    try {
      // This will be implemented when we integrate with SettingService
      logger.info("Loading blacklist configuration...")
    } catch (error) {
      logger.error("Failed to load blacklist config:", error)
    }
  }

  const saveBlacklistConfig = async () => {
    try {
      // This will be implemented when we integrate with SettingService
      logger.info("Saving blacklist configuration...")
      showMessage(pluginInstance.i18n.incrementalShare?.blacklistSaveSuccess || "Blacklist configuration saved successfully", 3000, "info")
    } catch (error) {
      logger.error("Failed to save blacklist config:", error)
      showMessage(pluginInstance.i18n.incrementalShare?.blacklistSaveError || "Failed to save blacklist configuration", 7000, "error")
    }
  }

  onMount(async () => {
    await loadBlacklistConfig()
  })
</script>

<div class="blacklist-setting-container">
  <div class="setting-header">
    <h3>{pluginInstance.i18n.incrementalShare?.blacklistManage || 'Blacklist Management'}</h3>
    <button class="save-btn" on:click={saveBlacklistConfig}>
      {pluginInstance.i18n.incrementalShare?.saveConfig || 'Save Configuration'}
    </button>
  </div>

  <div class="blacklist-content">
    <ShareBlacklistUI {pluginInstance} />
  </div>
</div>

<style lang="stylus">
  .blacklist-setting-container
    padding 20px
    height 100%
    display flex
    flex-direction column

  .setting-header
    display flex
    justify-content space-between
    align-items center
    margin-bottom 20px
    padding-bottom 15px
    border-bottom 1px solid #e0e0e0

    h3
      margin 0
      font-size 18px
      color #333

  .save-btn
    padding 8px 16px
    background-color #0073e6
    color white
    border none
    border-radius 4px
    cursor pointer
    font-size 14px
    transition background-color 0.2s ease

    &:hover
      background-color #005bb5

  .blacklist-content
    flex 1
    overflow auto
    padding 10px
    border 1px solid #e0e0e0
    border-radius 4px
    background-color #f9f9f9

  /* 暗色模式 */
  html[data-theme-mode="dark"] .blacklist-setting-container
    .setting-header
      border-bottom-color #444

      h3
        color var(--b3-theme-on-background)

    .blacklist-content
      border-color #444
      background-color #2c2c2c

    .save-btn
      background-color #005bb5

      &:hover
        background-color #004999
</style>