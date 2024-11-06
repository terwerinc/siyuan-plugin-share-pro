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
  import { isDev } from "../Constants"
  import ShareProPlugin from "../index"
  import { Dialog } from "siyuan"
  import Tab from "./components/tab/Tab.svelte"
  import MyCustomComponent from "./MyCustomComponent.svelte"

  const logger = simpleLogger("share-main", "share-pro", isDev)
  export let pluginInstance: ShareProPlugin
  export let dialog: Dialog

  let activeTab = 0

  const tabs = [
    { label: "Tab 1", content: MyCustomComponent },
    { label: "Tab 2", content: "This is the content for Tab 2" },
    { label: "Tab 3", content: "This is the content for Tab 3" },
  ]

  function handleTabChange(e: CustomEvent<any>) {
    activeTab = e.detail
  }
</script>

<Tab {tabs} {activeTab} on:tabChange={handleTabChange} vertical={true} />
<div style="height: 20px;"></div>
<Tab {tabs} {activeTab} on:tabChange={handleTabChange} vertical={false} />