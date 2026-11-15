<script lang="ts">
  import { onMount } from "svelte"
  import type ShareProPlugin from "../../index"
  import { loadServiceAccess, SETTINGS_SAVED_EVENT } from "../../utils/ServiceAccessUtils"

  export let pluginInstance: ShareProPlugin
  let loading = true
  let vipInfo = { code: -1, msg: "", data: null }
  let revision = 0

  const refresh = async () => {
    const current = ++revision
    loading = true
    const result = await loadServiceAccess(pluginInstance)
    if (current === revision) {
      vipInfo = result
      loading = false
    }
  }

  onMount(() => {
    void refresh()
    window.addEventListener(SETTINGS_SAVED_EVENT, refresh)
    return () => {
      revision++
      window.removeEventListener(SETTINGS_SAVED_EVENT, refresh)
    }
  })
</script>

<section class="service-access">
  <header class="service-access-toolbar">
    <span>{pluginInstance.i18n.sharePro}</span>
    <button type="button" class="b3-button b3-button--outline" data-action="open-share-settings"
      on:click={() => pluginInstance.openSetting()}>{pluginInstance.i18n.shareSetting}</button>
  </header>
  <div class="service-access-body" aria-busy={loading}>
  {#if loading}
    <div class="service-access-status" role="status">{pluginInstance.i18n.serviceAccess.checking}</div>
  {:else if vipInfo.code !== 0}
    <div class="service-access-status" role="alert">
      <strong>{pluginInstance.i18n.serviceAccess.title}</strong>
      <p>{vipInfo.msg}</p>
      <p>{pluginInstance.i18n.serviceAccess.help}</p>
      <div class="service-access-actions">
        <button type="button" class="b3-button" on:click={() => pluginInstance.openSetting()}>{pluginInstance.i18n.shareSetting}</button>
        <button type="button" class="b3-button b3-button--outline" data-action="retry-service" on:click|stopPropagation={refresh}>{pluginInstance.i18n.serviceAccess.retry}</button>
      </div>
    </div>
  {:else}
    <slot {vipInfo} />
  {/if}
  </div>
</section>

<style>
  .service-access { width: min(540px, 90vw); max-height: 85vh; overflow: auto; }
  .service-access-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 16px; border-bottom: 1px solid var(--b3-border-color); }
  .service-access-status { padding: 20px 16px; white-space: normal; overflow-wrap: anywhere; }
  .service-access-status p { margin: 12px 0; }
  .service-access-actions { display: flex; gap: 10px; }
</style>
