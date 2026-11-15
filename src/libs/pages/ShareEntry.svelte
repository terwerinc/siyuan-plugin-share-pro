<script lang="ts">
  import type ShareProPlugin from "../../index"
  import type { ShareService } from "../../service/ShareService"
  import ServiceAccessBoundary from "../components/ServiceAccessBoundary.svelte"
  import ShareUI from "./ShareUI.svelte"
  export let pluginInstance: ShareProPlugin
  export let shareService: ShareService
  export let docId = ""
</script>

<ServiceAccessBoundary {pluginInstance} let:vipInfo>
  <ShareUI {pluginInstance} {shareService} {docId} {vipInfo} embeddedInServiceAccess />
</ServiceAccessBoundary>
