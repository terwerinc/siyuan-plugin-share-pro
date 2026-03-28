<!--
  -            GNU GENERAL PUBLIC LICENSE
  -               Version 3, 29 June 2007
  -
  -  Copyright (C) 2024-2025 Terwer, Inc. <https://terwer.space/>
  -  Everyone is permitted to copy and distribute verbatim copies
  -  of this license document, but changing it is not allowed.
  -->

<script lang="ts">
  import { onMount, tick } from "svelte"
  import { Dialog, showMessage } from "siyuan"
  import { simpleLogger } from "zhi-lib-base"
  import { isDev, SHARE_PRO_STORE_NAME } from "../../Constants"
  import ShareProPlugin from "../../index"
  import { KeyInfo } from "../../models/KeyInfo"
  import BlacklistSetting from "./setting/BlacklistSetting.svelte"
  import { ApiUtils } from "../../utils/ApiUtils"
  import { getRegisterInfo } from "../../utils/LicenseUtils"
  import { getSupportedThemes } from "../../utils/ShareConfigUtils"
  import { SettingService } from "../../service/SettingService"
  import {
    DEFAULT_DOC_PATHS,
    DEFAULT_DOMAINS,
    applySettingsWorkspaceDraft,
    createNormalizedWorkspaceConfig,
    createSettingsWorkspaceDraft,
    persistSettingsWorkspace,
    type SettingsWorkspaceDraft,
    type SettingsWorkspaceSectionId,
  } from "../../utils/SettingsWorkspaceUtils"

  const logger = simpleLogger("share-settings-workspace", "share-pro", isDev)
  export let pluginInstance: ShareProPlugin
  export let dialog: Dialog
  export let vipInfo: {
    code: number
    msg: string
    data: KeyInfo
  }

  const settingService = new SettingService(pluginInstance)
  const themes = getSupportedThemes(pluginInstance)
  const domainApplyUrl = "https://github.com/terwerinc/siyuan-plugin-share-pro/issues/114"

  let activeSection: SettingsWorkspaceSectionId = "general"
  let isLoading = true
  let isSaving = false
  let saveErrorMessage = ""
  let workspaceMainEl: HTMLElement
  let localConfig = createNormalizedWorkspaceConfig(pluginInstance.getDefaultCfg())
  let draft: SettingsWorkspaceDraft = createSettingsWorkspaceDraft(localConfig)
  let initialSnapshot = JSON.stringify(draft)

  const sections: Array<{ id: SettingsWorkspaceSectionId; label: string }> = [
    { id: "general", label: pluginInstance.i18n.settingsWorkspace.general },
    { id: "display", label: pluginInstance.i18n.settingsWorkspace.display },
    { id: "share", label: pluginInstance.i18n.settingsWorkspace.share },
    { id: "incremental", label: pluginInstance.i18n.settingsWorkspace.incremental },
  ]

  $: domainOptions = draft.domains.length > 0 ? draft.domains : DEFAULT_DOMAINS
  $: docPathOptions = draft.docPaths.length > 0 ? draft.docPaths : DEFAULT_DOC_PATHS
  $: isDirty = !isLoading && JSON.stringify(draft) !== initialSnapshot
  $: accountSummary =
    vipInfo.code === 1 || vipInfo.code === 403
      ? []
      : [
          {
            label: pluginInstance.i18n.settingsWorkspace.accountStatus,
            value: vipInfo.data.isVip ? "VIP" : pluginInstance.i18n.keyInfo.freeUser,
          },
          {
            label: pluginInstance.i18n.settingsWorkspace.accountEmail,
            value: vipInfo.data.email,
          },
          {
            label: pluginInstance.i18n.settingsWorkspace.accountType,
            value: getRegisterInfo(pluginInstance, vipInfo.data.payType),
          },
          {
            label: pluginInstance.i18n.settingsWorkspace.accountExpires,
            value: vipInfo.data.num >= 999 ? pluginInstance.i18n.keyInfo.lifetime : String(vipInfo.data.num),
          },
          {
            label: pluginInstance.i18n.settingsWorkspace.accountSince,
            value: vipInfo.data.from,
          },
        ]
  $: if (saveErrorMessage && isDirty) {
    saveErrorMessage = ""
  }
  $: footerState = (() => {
    if (isSaving) {
      return {
        type: "saving",
        text: pluginInstance.i18n.settingsWorkspace.saving,
      }
    }

    if (saveErrorMessage) {
      return {
        type: "error",
        text: saveErrorMessage,
      }
    }

    if (isDirty) {
      return {
        type: "warning",
        text: pluginInstance.i18n.settingsWorkspace.unsavedChanges,
      }
    }

    return null
  })()

  const resetScrollPosition = async () => {
    await tick()
    workspaceMainEl?.scrollTo({ top: 0 })
  }

  const activateScrollViewport = async () => {
    await tick()
    if (!workspaceMainEl) {
      return
    }

    workspaceMainEl.focus({ preventScroll: true })
    if (workspaceMainEl.scrollHeight > workspaceMainEl.clientHeight) {
      workspaceMainEl.scrollTop = 1
      workspaceMainEl.scrollTop = 0
    }
  }

  const selectSection = async (sectionId: SettingsWorkspaceSectionId) => {
    activeSection = sectionId
    await resetScrollPosition()
    await activateScrollViewport()
  }

  const handleWorkspaceWheel = (event: WheelEvent) => {
    if (!workspaceMainEl) {
      return
    }

    const target = event.target as HTMLElement | null
    if (target?.closest("textarea, input, select, .search-dropdown, .blacklist-table")) {
      return
    }

    if (workspaceMainEl.scrollHeight <= workspaceMainEl.clientHeight) {
      return
    }

    event.preventDefault()
    workspaceMainEl.scrollTop += event.deltaY
  }

  const fetchCustomCss = async () => {
    let cssArray = []

    try {
      const { kernelApi } = await ApiUtils.getSiyuanKernelApi(pluginInstance)
      const customCss = await kernelApi.siyuanRequest("/api/snippet/getSnippet", { type: "css", enabled: 2 })
      if (customCss?.snippets?.length > 0) {
        cssArray = customCss.snippets.filter((item) => item.enabled)
      }
    } catch (error) {
      logger.error("get custom css error", error)
    }

    return cssArray as any
  }

  const loadWorkspace = async () => {
    isLoading = true

    try {
      localConfig = createNormalizedWorkspaceConfig(await pluginInstance.safeLoad(SHARE_PRO_STORE_NAME))

      let remoteAppConfig
      try {
        remoteAppConfig = await settingService.getSettingByAuthor(vipInfo.data.email)
      } catch (error) {
        logger.warn("load remote settings failed, fallback to local config", error)
      }

      draft = createSettingsWorkspaceDraft(localConfig, remoteAppConfig)
      initialSnapshot = JSON.stringify(draft)
    } finally {
      isLoading = false
    }
  }

  const handleSave = async () => {
    if (isSaving) {
      return
    }

    isSaving = true

    try {
      const customCss = draft.customCssEnabled ? await fetchCustomCss() : ([] as any[])
      const finalConfig = applySettingsWorkspaceDraft(localConfig, draft, customCss)
      saveErrorMessage = ""

      const result = await persistSettingsWorkspace({
        finalConfig,
        saveLocal: async (config) => {
          await pluginInstance.saveData(SHARE_PRO_STORE_NAME, config)
        },
        syncRemote: async (appConfig) => {
          const response = await settingService.syncSetting(finalConfig.serviceApiConfig.token, appConfig)
          if (response?.code === 1) {
            throw response.msg
          }
        },
      })

      localConfig = finalConfig
      initialSnapshot = JSON.stringify(draft)

      if (result.syncedRemote) {
        showMessage(`${pluginInstance.i18n.settingConfigSaveAndSyncSuccess}`, 2000, "info")
      } else {
        saveErrorMessage = pluginInstance.i18n.settingsWorkspace.syncFailed
        showMessage(`${pluginInstance.i18n.settingConfigSaveFail},${result.syncError}`, 7000, "error")
      }
    } catch (error) {
      logger.error("save settings workspace error", error)
      saveErrorMessage = pluginInstance.i18n.settingsWorkspace.saveFailed
      showMessage(`${pluginInstance.i18n.settingConfigSaveFail},${error}`, 7000, "error")
    } finally {
      isSaving = false
    }
  }

  const handleCancel = () => {
    dialog.destroy()
  }

  onMount(async () => {
    await loadWorkspace()
    await resetScrollPosition()
    await activateScrollViewport()
  })
</script>

<div class="settings-workspace">
  <aside class="workspace-sidebar">
    <div class="workspace-brand">
      <div class="brand-title">{pluginInstance.i18n.settingsWorkspace.title}</div>
    </div>

    <div class="workspace-nav">
      {#each sections as section}
        <button
          class="workspace-nav-item"
          class:active={activeSection === section.id}
          on:click={() => selectSection(section.id)}
        >
          {section.label}
        </button>
      {/each}
    </div>
  </aside>

  <section class="workspace-main" bind:this={workspaceMainEl} tabindex="0" on:wheel={handleWorkspaceWheel}>
    <div class="workspace-nav-mobile">
      {#each sections as section}
        <button
          class="workspace-nav-chip"
          class:active={activeSection === section.id}
          on:click={() => selectSection(section.id)}
        >
          {section.label}
        </button>
      {/each}
    </div>

    <div class="workspace-scroll">
      {#if isLoading}
        <div class="workspace-loading">{pluginInstance.i18n.incrementalShare.loading}</div>
      {:else if activeSection === "general"}
        <div class="workspace-section general-section">
          <div class="section-card account-access-card">
            <div class="section-title">{pluginInstance.i18n.settingsWorkspace.account}</div>
            {#if vipInfo.code === 1 || vipInfo.code === 403}
              <div class="status-panel status-error">
                {pluginInstance.i18n.keyInfo.notValid}！ {vipInfo.msg}
              </div>
            {:else}
              <div class="status-panel status-success status-grid compact-status-grid">
                {#each accountSummary as item}
                  <div class="status-item">
                    <div class="status-label">{item.label}</div>
                    <div class="status-value">{item.value}</div>
                  </div>
                {/each}
              </div>
            {/if}

            <div class="inline-divider" />

            <div class="subsection-title">{pluginInstance.i18n.bs.regCode}</div>
            <div class="section-tip compact-reg-tip">
              <a class="fn__code" href="https://store.terwer.space/products/share-pro">{pluginInstance.i18n.bs.regCodeClick}</a>
              <span>{pluginInstance.i18n.bs.regCodeTip}</span>
            </div>
            <textarea
              class="b3-text-field fn__block reg-code-input"
              bind:value={draft.serviceApiToken}
              rows="2"
              placeholder={pluginInstance.i18n.bs.regCodePlaceholder}
            />
          </div>

          <div class="section-card">
            <div class="section-title">{pluginInstance.i18n.settingsWorkspace.behavior}</div>

            <div class="setting-row">
              <div class="setting-copy">
                <div class="setting-label">
                  {pluginInstance.i18n.bs.newUI}
                  <sup>1.9.0+</sup>
                </div>
                <div class="setting-tip">{pluginInstance.i18n.bs.newUITip}</div>
                <a class="setting-link" href={pluginInstance.i18n.bs.newUITipLink} target="_blank">
                  {pluginInstance.i18n.bs.newUIHelp}
                </a>
              </div>
              <input class="b3-switch fn__flex-center" id="newUI" type="checkbox" bind:checked={draft.newUIEnabled} />
            </div>
          </div>
        </div>
      {:else if activeSection === "display"}
        <div class="workspace-section">
          <div class="section-card">
            <div class="section-title">{pluginInstance.i18n.settingsWorkspace.appearance}</div>

            <div class="setting-row">
              <div class="setting-copy">
                <div class="setting-label">{pluginInstance.i18n.cs.theme}</div>
                <div class="setting-tip">{pluginInstance.i18n.cs.themeTip}</div>
              </div>
              <select class="b3-select control-select" bind:value={draft.theme}>
                {#each themes.light as item}
                  <option value={item.value}>{item.label}</option>
                {/each}
              </select>
            </div>

            <div class="setting-row">
              <div class="setting-copy">
                <div class="setting-label">{pluginInstance.i18n.cs.customCss}</div>
                <div class="setting-tip">{pluginInstance.i18n.cs.customCssTip}</div>
              </div>
              <input class="b3-switch fn__flex-center" type="checkbox" bind:checked={draft.customCssEnabled} />
            </div>

            <div class="setting-row">
              <div class="setting-copy">
                <div class="setting-label">{pluginInstance.i18n.cs.fixTitle}</div>
                <div class="setting-tip">{pluginInstance.i18n.cs.fixTitleTip}</div>
              </div>
              <input class="b3-switch fn__flex-center" type="checkbox" bind:checked={draft.fixTitle} />
            </div>
          </div>

          <div class="section-card">
            <div class="section-title">{pluginInstance.i18n.settingsWorkspace.addressing}</div>

            <div class="setting-row">
              <div class="setting-copy">
                <div class="setting-label">{pluginInstance.i18n.cs.domain}</div>
                <div class="setting-tip">
                  {pluginInstance.i18n.cs.domainTip}
                  <a href={domainApplyUrl} target="_blank">{pluginInstance.i18n.cs.domainClick}</a>
                  {pluginInstance.i18n.cs.domainApply}
                </div>
              </div>
              <select class="b3-select control-select" bind:value={draft.domain}>
                {#each domainOptions as item}
                  <option value={item}>{item}</option>
                {/each}
              </select>
            </div>

            <div class="setting-row">
              <div class="setting-copy">
                <div class="setting-label">{pluginInstance.i18n.cs.docPath}</div>
                <div class="setting-tip">{pluginInstance.i18n.cs.docPathTip}</div>
              </div>
              <select class="b3-select control-select" bind:value={draft.docPath}>
                {#each docPathOptions as item}
                  <option value={item}>{item}</option>
                {/each}
              </select>
            </div>
          </div>

          <div class="section-card">
            <div class="section-title">{pluginInstance.i18n.seoSetting}</div>

            <div class="field-grid">
              <label>{pluginInstance.i18n.seo.siteTitle}</label>
              <input
                class="b3-text-field fn__block"
                bind:value={draft.siteTitle}
                placeholder={pluginInstance.i18n.seo.siteTitlePlaceholder}
              />

              <label>{pluginInstance.i18n.seo.siteSlogan}</label>
              <input
                class="b3-text-field fn__block"
                bind:value={draft.siteSlogan}
                placeholder={pluginInstance.i18n.seo.siteSloganPlaceholder}
              />

              <label>{pluginInstance.i18n.seo.siteDescription}</label>
              <textarea
                class="b3-text-field fn__block"
                rows="3"
                bind:value={draft.siteDescription}
                placeholder={pluginInstance.i18n.seo.siteDescriptionPlaceholder}
              />

              <label>{pluginInstance.i18n.seo.customHeader}</label>
              <div class="field-tip">{pluginInstance.i18n.seo.customHeaderTip}</div>
              <textarea class="b3-text-field fn__block" rows="2" bind:value={draft.header} />

              <label>{pluginInstance.i18n.seo.customFooter}</label>
              <div class="field-tip">{pluginInstance.i18n.seo.customFooterTip}</div>
              <textarea class="b3-text-field fn__block" rows="2" bind:value={draft.footer} />

              <label>{pluginInstance.i18n.seo.shareTemplate}</label>
              <div class="field-tip">{pluginInstance.i18n.seo.shareTemplateTip}</div>
              <textarea
                class="b3-text-field fn__block"
                rows="2"
                bind:value={draft.shareTemplate}
                placeholder={pluginInstance.i18n.seo.shareTemplatePlaceholder}
              />
            </div>
          </div>
        </div>
      {:else if activeSection === "share"}
        <div class="workspace-section">
          <div class="section-card">
            <div class="section-title">{pluginInstance.i18n.settingsWorkspace.shareScope}</div>

            <div class="setting-row">
              <div class="setting-copy">
                <div class="setting-label">{pluginInstance.i18n.cs.shareSubdocuments}</div>
                <div class="setting-tip">{pluginInstance.i18n.cs.shareSubdocumentsTip}</div>
              </div>
              <input class="b3-switch fn__flex-center" type="checkbox" bind:checked={draft.shareSubdocuments} />
            </div>

            <div class="setting-row">
              <div class="setting-copy">
                <div class="setting-label">{pluginInstance.i18n.cs.shareReferences}</div>
                <div class="setting-tip">{pluginInstance.i18n.cs.shareReferencesTip}</div>
              </div>
              <input class="b3-switch fn__flex-center" type="checkbox" bind:checked={draft.shareReferences} />
            </div>
          </div>

          <div class="section-card">
            <div class="section-title">{pluginInstance.i18n.settingsWorkspace.readerExperience}</div>

            <div class="setting-row">
              <div class="setting-copy">
                <div class="setting-label">{pluginInstance.i18n.cs.aiAssistant}</div>
                <div class="setting-tip">{pluginInstance.i18n.cs.aiAssistantTip}</div>
              </div>
              <input class="b3-switch fn__flex-center" type="checkbox" bind:checked={draft.aiAssistantEnabled} />
            </div>

            <div class="setting-row">
              <div class="setting-copy">
                <div class="setting-label">{pluginInstance.i18n.cs.postMeta}</div>
                <div class="setting-tip">{pluginInstance.i18n.cs.postMetaTip}</div>
              </div>
              <input class="b3-switch fn__flex-center" type="checkbox" bind:checked={draft.postMetaEnabled} />
            </div>

            <div class="setting-row stack">
              <div class="setting-row-main">
                <div class="setting-copy">
                  <div class="setting-label">{pluginInstance.i18n.cs.docTree}</div>
                  <div class="setting-tip">{pluginInstance.i18n.cs.docTreeTip}</div>
                </div>
                <input class="b3-switch fn__flex-center" type="checkbox" bind:checked={draft.docTreeEnabled} />
              </div>
              {#if draft.docTreeEnabled}
                <div class="dependent-controls">
                  <span>{pluginInstance.i18n.cs.docTreeDepth}</span>
                  <select class="b3-select inline-select" bind:value={draft.docTreeLevel}>
                    {#each [1, 2, 3, 4, 5, 6] as level}
                      <option value={level}>{level}</option>
                    {/each}
                  </select>
                </div>
              {/if}
            </div>

            <div class="setting-row stack">
              <div class="setting-row-main">
                <div class="setting-copy">
                  <div class="setting-label">{pluginInstance.i18n.cs.outline}</div>
                  <div class="setting-tip">{pluginInstance.i18n.cs.outlineTip}</div>
                </div>
                <input class="b3-switch fn__flex-center" type="checkbox" bind:checked={draft.outlineEnabled} />
              </div>
              {#if draft.outlineEnabled}
                <div class="dependent-controls">
                  <span>{pluginInstance.i18n.cs.outlineDepth}</span>
                  <select class="b3-select inline-select" bind:value={draft.outlineLevel}>
                    {#each [1, 2, 3, 4, 5, 6] as level}
                      <option value={level}>h{level}</option>
                    {/each}
                  </select>
                </div>
              {/if}
            </div>
          </div>

          <div class="section-card">
            <div class="section-title">{pluginInstance.i18n.settingsWorkspace.accessControl}</div>

            <div class="setting-row">
              <div class="setting-copy">
                <div class="setting-label">{pluginInstance.i18n.cs.passwordEnabled}</div>
                <div class="setting-tip">{pluginInstance.i18n.cs.passwordEnabledTip}</div>
              </div>
              <input class="b3-switch fn__flex-center" type="checkbox" bind:checked={draft.passwordEnabled} />
            </div>

            <div class="setting-row">
              <div class="setting-copy">
                <div class="setting-label">{pluginInstance.i18n.cs.showPassword}</div>
                <div class="setting-tip">{pluginInstance.i18n.cs.showPasswordTip}</div>
              </div>
              <input
                class="b3-switch fn__flex-center"
                type="checkbox"
                bind:checked={draft.showPassword}
                disabled={!draft.passwordEnabled}
              />
            </div>
          </div>
        </div>
      {:else if activeSection === "incremental"}
        <div class="workspace-section">
          <div class="section-card">
            <div class="section-title">{pluginInstance.i18n.incrementalShare.title}</div>

            <div class="setting-row">
              <div class="setting-copy">
                <div class="setting-label">{pluginInstance.i18n.incrementalShare.enabled}</div>
                <div class="setting-tip">{pluginInstance.i18n.incrementalShare.enabledTip}</div>
              </div>
              <input class="b3-switch fn__flex-center" type="checkbox" bind:checked={draft.incrementalShareEnabled} />
            </div>
          </div>

          <div class="section-card blacklist-card">
            <div class="section-title">{pluginInstance.i18n.incrementalShare.blacklist.title}</div>
            <div class="section-tip">{pluginInstance.i18n.settingsWorkspace.immediateActionTip}</div>
            <BlacklistSetting {pluginInstance} {dialog} />
          </div>
        </div>
      {/if}
    </div>

    <div class="workspace-footer">
      {#if footerState}
        <div class={`footer-state footer-state-${footerState.type}`}>
          {footerState.text}
        </div>
      {/if}
      <div class="footer-actions">
        <button class="b3-button b3-button--cancel" on:click={handleCancel} disabled={isSaving}>
          {pluginInstance.i18n.cancel}
        </button>
        <button class="b3-button b3-button--primary" on:click={handleSave} disabled={isSaving}>
          {isSaving ? pluginInstance.i18n.settingsWorkspace.saving : pluginInstance.i18n.save}
        </button>
      </div>
    </div>
  </section>
</div>

<style>
  .settings-workspace {
    display: flex;
    min-height: min(78vh, 860px);
    max-height: min(78vh, 860px);
    background: var(--b3-theme-background);
    border-radius: 10px;
    overflow: hidden;
  }

  .workspace-sidebar {
    width: 210px;
    min-width: 210px;
    border-right: 1px solid var(--b3-border-color);
    background: var(--b3-theme-surface);
    display: flex;
    flex-direction: column;
  }

  .workspace-brand {
    padding: 16px 18px;
    border-bottom: 1px solid var(--b3-border-color);
  }

  .brand-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
  }

  .workspace-nav {
    padding: 12px 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .workspace-nav-item,
  .workspace-nav-chip {
    border: none;
    background: transparent;
    color: var(--b3-theme-on-surface);
    cursor: pointer;
    border-radius: 10px;
    transition:
      background-color 0.2s ease,
      color 0.2s ease;
  }

  .workspace-nav-item {
    text-align: left;
    padding: 10px 14px;
    font-size: 15px;
    font-weight: 500;
  }

  .workspace-nav-chip {
    padding: 9px 14px;
    font-size: 14px;
    white-space: nowrap;
    border: 1px solid var(--b3-border-color);
    background: var(--b3-theme-surface);
  }

  .workspace-nav-item.active,
  .workspace-nav-item:hover,
  .workspace-nav-chip.active,
  .workspace-nav-chip:hover {
    background: var(--b3-list-hover);
    color: var(--b3-theme-on-background);
  }

  .workspace-main {
    flex: 1;
    min-height: 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    background: var(--b3-theme-background);
    overflow: auto;
    overscroll-behavior: contain;
    outline: none;
  }

  .workspace-nav-mobile {
    display: none;
    gap: 10px;
    padding: 14px 16px 0;
    overflow-x: auto;
    border-bottom: 1px solid var(--b3-border-color);
  }

  .workspace-scroll {
    flex: none;
    min-height: auto;
    overflow: visible;
    padding: 24px 28px 120px;
    box-sizing: border-box;
  }

  .workspace-section {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .general-section {
    gap: 12px;
  }

  .account-access-card {
    padding: 14px 16px;
  }

  .section-card {
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 14px;
    padding: 16px;
    box-sizing: border-box;
  }

  .section-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
    margin-bottom: 10px;
  }

  .section-tip,
  .field-tip {
    font-size: 12px;
    line-height: 1.6;
    color: var(--b3-theme-on-surface);
    margin-bottom: 10px;
  }

  .status-panel {
    border-radius: 10px;
    padding: 10px 12px;
  }

  .status-success {
    background: rgba(46, 160, 67, 0.08);
  }

  .status-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px 20px;
  }

  .compact-status-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px 14px;
  }

  .status-error {
    background: rgba(230, 81, 81, 0.08);
    color: #b42318;
  }

  .status-item {
    min-width: 0;
    padding: 0;
  }

  .status-label {
    font-size: 11px;
    color: var(--b3-theme-on-surface);
    margin-bottom: 2px;
  }

  .status-value {
    font-size: 12px;
    font-weight: 600;
    color: #18794e;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  .inline-divider {
    height: 1px;
    background: var(--b3-border-color);
    margin: 10px 0 10px;
  }

  .subsection-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
    margin-bottom: 8px;
  }

  .setting-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    padding: 12px 0;
    border-top: 1px solid var(--b3-border-color);
  }

  .setting-row:first-of-type {
    border-top: none;
    padding-top: 2px;
  }

  .setting-row.stack {
    flex-direction: column;
    gap: 12px;
  }

  .setting-row-main {
    width: 100%;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
  }

  .setting-copy {
    flex: 1;
    min-width: 0;
  }

  .setting-label {
    font-size: 15px;
    font-weight: 500;
    color: var(--b3-theme-on-background);
    margin-bottom: 6px;
  }

  .setting-tip {
    font-size: 13px;
    line-height: 1.65;
    color: var(--b3-theme-on-surface);
  }

  .setting-link {
    display: inline-block;
    margin-top: 6px;
    font-size: 12px;
    color: var(--b3-theme-primary);
    text-decoration: none;
  }

  .section-tip a {
    display: inline-block;
    margin-top: 0;
    word-break: break-all;
  }

  .compact-reg-tip {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 8px;
  }

  .compact-reg-tip span {
    font-size: 12px;
    color: var(--b3-theme-on-surface);
  }

  .control-select,
  .inline-select {
    min-width: 180px;
  }

  .dependent-controls {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-left: 4px;
    color: var(--b3-theme-on-background);
  }

  .field-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
  }

  .field-grid label {
    font-size: 14px;
    font-weight: 500;
    color: var(--b3-theme-on-background);
    margin-top: 8px;
  }

  .reg-code-input {
    min-height: 64px;
    font-family: var(--b3-font-family-code);
    font-size: 12px;
    line-height: 1.4;
  }

  .workspace-footer {
    position: sticky;
    bottom: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 16px;
    padding: 14px 20px;
    border-top: 1px solid var(--b3-border-color);
    background: color-mix(in srgb, var(--b3-theme-background) 92%, transparent);
    backdrop-filter: blur(10px);
  }

  .footer-state {
    font-size: 13px;
    padding: 6px 10px;
    border-radius: 999px;
    margin-right: auto;
  }

  .footer-state-warning {
    color: #9a6700;
    background: rgba(255, 191, 0, 0.12);
  }

  .footer-state-error {
    color: #b42318;
    background: rgba(230, 81, 81, 0.12);
  }

  .footer-state-saving {
    color: var(--b3-theme-primary);
    background: color-mix(in srgb, var(--b3-theme-primary) 14%, transparent);
  }

  .footer-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-left: auto;
  }

  .workspace-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 240px;
    color: var(--b3-theme-on-surface);
  }

  .blacklist-card :global(.form-item) {
    padding-left: 0;
    padding-right: 0;
  }

  @media screen and (max-width: 960px) {
    .settings-workspace {
      flex-direction: column;
      min-height: min(82vh, 900px);
      max-height: min(82vh, 900px);
    }

    .workspace-sidebar {
      display: none;
    }

    .workspace-nav-mobile {
      display: flex;
    }

    .workspace-scroll {
      padding: 18px 16px 120px;
    }

    .status-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media screen and (max-width: 720px) {
    .setting-row,
    .setting-row-main,
    .workspace-footer {
      flex-direction: column;
      align-items: stretch;
    }

    .footer-actions {
      justify-content: flex-end;
    }

    .control-select,
    .inline-select {
      width: 100%;
      min-width: 0;
    }

    .dependent-controls {
      flex-direction: column;
      align-items: stretch;
      padding-left: 0;
    }
  }
</style>
