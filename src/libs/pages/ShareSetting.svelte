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
  import { isDev } from "../../Constants"
  import ShareProPlugin from "../../index"
  import { Dialog } from "siyuan"
  import Tab from "../components/tab/Tab.svelte"
  import BasicSetting from "../pages/setting/BasicSetting.svelte"
  import { onMount } from "svelte"
  import { KeyInfo } from "../../models/KeyInfo"
  import CustomSetting from "./setting/CustomSetting.svelte"
  import DocSetting from "./setting/DocSetting.svelte"

  const logger = simpleLogger("share-main", "share-pro", isDev)
  export let pluginInstance: ShareProPlugin
  export let dialog: Dialog
  export let vipInfo: {
    code: number
    msg: string
    data: KeyInfo
  }

  let activeTab = 0

  let tabs = []

  const init = async () => {
    const tabData = []

    // 基础设置
    tabData.push({
      label: pluginInstance.i18n.basicSetting,
      content: BasicSetting,
      props: {
        pluginInstance: pluginInstance,
        dialog: dialog,
        vipInfo: vipInfo,
      },
    })
    // 个性设置
    tabData.push({
      label: pluginInstance.i18n.customSetting,
      content: CustomSetting,
      props: {
        pluginInstance: pluginInstance,
        dialog: dialog,
        vipInfo: vipInfo,
      },
    })
    // 文档设置
    tabData.push({
      label: pluginInstance.i18n.docSetting,
      content: DocSetting,
      props: {
        pluginInstance: pluginInstance,
        dialog: dialog,
        vipInfo: vipInfo,
      },
    })

    // 必须这样否则不触发事件
    tabs = tabData
  }

  function handleTabChange(e: CustomEvent<any>) {
    activeTab = e.detail
  }

  onMount(async () => {
    await init()
  })
</script>

<Tab {tabs} {activeTab} on:tabChange={handleTabChange} vertical={true} />
