<!--
  -            GNU GENERAL PUBLIC LICENSE
  -               Version 3, 29 June 2007
  -
  -  Copyright (C) 2024 Terwer, Inc. <https://terwer.space/>
  -  Everyone is permitted to copy and distribute verbatim copies
  -  of this license document, but changing it is not allowed.
  -->
<script lang="ts">
  import ShareProPlugin from "../index"
  import { KeyInfo } from "../models/KeyInfo"
  import { onMount } from "svelte"
  import { ShareService } from "../service/ShareService"
  import GenericTablePager from "./components/generic-table-pager/GenericTablePager.svelte"
  import { simpleLogger } from "zhi-lib-base"
  import { isDev } from "../Constants"

  const logger = simpleLogger("share-manage", "share-pro", isDev)
  export let pluginInstance: ShareProPlugin
  export let keyInfo: KeyInfo
  const shareService = new ShareService(pluginInstance)
  let docs = []

  function handleDelete(event) {
    const id = event.detail.id // position in myObjectArray
    const body = event.detail.body // object to delete
    console.log(JSON.stringify(event.detail.body))
    myObjectArray.slice(id, 1)
  }

  function handleUpdate(event) {
    const id = event.detail.id // position in table
    const body = event.detail.body
    console.log(JSON.stringify(body))
    myObjectArray[id] = body
  }

  function handleCreate(event) {
    console.log(JSON.stringify(event.detail)) // empty object is passed by now
    myObjectArray.push({ id: -1, name: "new Element", sthg: "2345", why: "1234" })
    const copy = myObjectArray
    myObjectArray = []
    myObjectArray = copy
  }

  function handleDetails(event) {
    const id = event.detail.id // position in table
    const body = event.detail.body
    console.log(JSON.stringify(body))
  }

  function handleSort(e) {
    console.log(e)
  }

  let myObjectArray = [
    { id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because" },
    { id: 1, name: "A_NAME_12", sthg: "A_STHG_1", why: "because" },
    { id: 1, name: "A_NAME_13", sthg: "A_STHG_1", why: "because" },
    { id: 1, name: "A_NAME_14", sthg: "A_STHG_1", why: "because" },
    { id: 1, name: "A_NAME_15", sthg: "A_STHG_1", why: "because" },
    { id: 1, name: "A_NAME_16", sthg: "A_STHG_1", why: "because" },
    { id: 1, name: "A_NAME_17", sthg: "A_STHG_1", why: "because" },
    { id: 1, name: "A_NAME_18", sthg: "A_STHG_1", why: "because" },
    { id: 1, name: "A_NAME_19", sthg: "A_STHG_1", why: "because" },
    { id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because" },
    { id: 1, name: "A_NAME_12345", sthg: "A_STHG_1", why: "because" },
    { id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because" },
    { id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because" },
    { id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because" },
    { id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because" },
    { id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because" },
    { id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because" },
    { id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because" },
    { id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because" },
    { id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because" },
    { id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because" },
    { id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because" },
    { id: 2, name: "A_NAME_2", sthg: "A_STHG_2", why: "I can" },
  ]

  onMount(async () => {
    const resp = await shareService.listDoc(0)
    docs = resp.data
    logger.info(`loaded docs for ${keyInfo.email}`, docs)
  })
</script>

<div>
  <GenericTablePager
    on:delete={handleDelete}
    on:update={handleUpdate}
    on:create={handleCreate}
    on:details={handleDetails}
    on:sort={handleSort}
    table_config={{
      name: "Awesome:",
      options: ["CREATE", "EDIT", "DELETE", "DETAILS"],
      columns_setting: [
        { name: "id", show: false, edit: true, size: "200px" },
        { name: "name", show: true, edit: true, size: "200px" },
        { name: "why", show: true, edit: true, size: "200px" },
        { name: "sthg", show: true, edit: false, size: "200px" },
      ],
      details_text: "detail", // replace the standard icon with an text-link
    }}
    pager_data={myObjectArray}
    pager_config={{
      name: "crud-table-pager",
      lines: 5,
      steps: [1, 2, 5, 10, 20, 50],
      width: "600px",
    }}
  />
</div>
