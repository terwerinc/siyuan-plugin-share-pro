<!--
  -            GNU GENERAL PUBLIC LICENSE
  -               Version 3, 29 June 2007
  -
  -  Copyright (C) 2024-2025 Terwer, Inc. <https://terwer.space/>
  -  Everyone is permitted to copy and distribute verbatim copies
  -  of this license document, but changing it is not allowed.
  -->

<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte"
  import { Dialog, showMessage } from "siyuan"
  import { simpleLogger } from "zhi-lib-base"
  import { isDev, SHARE_SERVICE_ENDPOINT_PROD, SHARE_PRO_STORE_NAME } from "../../Constants"
  import type ShareProPlugin from "../../index"
  import { checkReaderApiCompatibility, checkReadingConnection, checkServiceConnection, loadServiceAccess, normalizeServiceApiUrl, withServiceTimeout, SETTINGS_SAVED_EVENT } from "../../utils/ServiceAccessUtils"
  import type { ServiceResponse } from "../../api/share-api"
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
    mergeRemoteAppConfig,
    type SettingsWorkspaceDraft,
    type SettingsWorkspaceSectionId,
  } from "../../utils/SettingsWorkspaceUtils"

  const logger = simpleLogger("share-settings-workspace", "share-pro", isDev)
  export let pluginInstance: ShareProPlugin
  export let dialog: Dialog
  export let vipInfo: ServiceResponse = { code: -2, msg: "", data: null, hostedMode: true }

  const settingService = new SettingService(pluginInstance)
  const themes = getSupportedThemes(pluginInstance)
  const domainApplyUrl = "https://github.com/terwerinc/siyuan-plugin-share-pro/issues/114"

  let activeSection: SettingsWorkspaceSectionId = "general"
  let isLoading = true
  let isSaving = false
  let workspaceRevision = 0
  let saveErrorMessage = ""
  let workspaceMainEl: HTMLElement
  let localConfig = createNormalizedWorkspaceConfig(pluginInstance.getDefaultCfg())
  let draft: SettingsWorkspaceDraft = createSettingsWorkspaceDraft(localConfig)
  let initialSnapshot = JSON.stringify(draft)
  const connectionSnapshot=()=>JSON.stringify([draft.connectionMode,draft.serviceApiUrl,draft.serviceApiToken,draft.domain,draft.docPath])
  let observedConnection=JSON.stringify([draft.connectionMode,draft.serviceApiUrl,draft.serviceApiToken])
  let showKey=false
  const pasteHostedKey=(event: ClipboardEvent)=>{
    if(isSaving)return
    const value=event.clipboardData?.getData("text")
    if(value===undefined)return
    event.preventDefault()
    draft.serviceApiToken=value.trim()
  }
  let verificationOk=false
  let readingMessage=""
  let readingOk=false
  let selectedMode=draft.connectionMode
  const switchMode=(nextMode: "hosted" | "self-hosted" = draft.connectionMode)=>{
    localConfig.connectionProfiles ??= {}
    localConfig.connectionProfiles[selectedMode]=structuredClone({serviceApiConfig:{connectionMode:selectedMode,apiUrl:draft.serviceApiUrl,token:draft.serviceApiToken},appConfig:{...localConfig.appConfig,domain:draft.domain,docPath:draft.docPath},draft:{...draft,connectionMode:selectedMode}})
    const saved=localConfig.connectionProfiles[nextMode]
    const fresh=pluginInstance.getDefaultCfg()
    const mode=nextMode
    const appConfig=saved?.appConfig ?? {...fresh.appConfig,homePageId:"",siteUrl:"",domain:mode==="hosted"?DEFAULT_DOMAINS[0]:"",docPath:"s"}
    localConfig={...localConfig,appConfig:structuredClone(appConfig)}
    draft=createSettingsWorkspaceDraft({...fresh,connectionProfiles:localConfig.connectionProfiles,serviceApiConfig:saved?.serviceApiConfig ?? {connectionMode:mode,apiUrl:mode==="hosted"?SHARE_SERVICE_ENDPOINT_PROD:"",token:""},appConfig})
    if(saved?.draft)draft=structuredClone(saved.draft) as SettingsWorkspaceDraft
    draft.connectionMode=mode
    if(mode==="hosted")draft.serviceApiUrl=SHARE_SERVICE_ENDPOINT_PROD
    showKey=false
    selectedMode=mode
    draft.requiresModeConfirmation=false
  }
  let isVerifying=false
  let verificationMessage=""
  let compatibilityMessage=""
  let compatibilityOk=false
  let apiCheckState="idle"
  let readingCheckState="idle"
  let compatibilityCheckState="idle"
  let verificationRound=0
  let detectedMode:boolean | undefined
  const apiSnapshot=()=>JSON.stringify([draft.connectionMode,draft.serviceApiUrl,draft.serviceApiToken])
  const readingSnapshot=()=>JSON.stringify([draft.domain,draft.docPath])
  const browserSnapshot=()=>JSON.stringify([draft.connectionMode,draft.serviceApiUrl,draft.domain])
  let observedReading=readingSnapshot()
  let observedBrowser=browserSnapshot()

  $: currentConnection=JSON.stringify([draft.connectionMode,draft.serviceApiUrl,draft.serviceApiToken])
  $: if(currentConnection!==observedConnection){
    observedConnection=currentConnection
    workspaceRevision++
    verificationMessage=""
    apiCheckState="idle"
    detectedMode=undefined
    isVerifying=false
    vipInfo={code:-3,msg:"",data:null,hostedMode:draft.connectionMode==="hosted"}
  }
  $: currentReading=JSON.stringify([draft.domain,draft.docPath])
  $: if(currentReading!==observedReading){
    observedReading=currentReading
    readingMessage=""
    readingCheckState="idle"
    isVerifying=false
  }
  $: currentBrowser=JSON.stringify([draft.connectionMode,draft.serviceApiUrl,draft.domain])
  $: if(currentBrowser!==observedBrowser){
    observedBrowser=currentBrowser
    compatibilityMessage=""
    compatibilityCheckState="idle"
  }
  const verifyConnection=async()=>{
    const round=++verificationRound
    const api=apiSnapshot(),reading=readingSnapshot(),browser=browserSnapshot()
    const connection={apiUrl:draft.serviceApiUrl,token:draft.serviceApiToken,connectionMode:draft.connectionMode}
    const address=draft.domain
    isVerifying=true
    apiCheckState=readingCheckState=compatibilityCheckState="pending"
    verificationMessage=readingMessage=compatibilityMessage=pluginInstance.i18n.serviceAccess.verifying
    const apiRequest=checkServiceConnection(pluginInstance,connection).then(checked=>{
      if(round!==verificationRound || api!==apiSnapshot())return
      vipInfo=checked.response
      detectedMode=checked.reachable?checked.response.hostedMode:undefined
      verificationOk=checked.reachable && checked.modeMatches && checked.response.code===0
      apiCheckState=verificationOk?"success":"error"
      verificationMessage=!checked.reachable || !checked.modeMatches
        ? pluginInstance.i18n.serviceErrors[checked.errorCode] || pluginInstance.i18n.serviceErrors.UNKNOWN_ERROR
        : checked.response.code===0?pluginInstance.i18n.serviceAccess.verified:pluginInstance.i18n.serviceAccess.reachableKeyRejected
    })
    const readingRequest=checkReadingConnection(pluginInstance,address).then(result=>{
      if(round!==verificationRound || reading!==readingSnapshot())return
      readingOk=result.ok
      readingCheckState=result.ok?"success":result.pending?"idle":"error"
      readingMessage=result.ok?pluginInstance.i18n.serviceAccess.readingVerified:result.pending?pluginInstance.i18n.serviceAccess.readingPending:pluginInstance.i18n.serviceErrors[result.errorCode] || pluginInstance.i18n.serviceAccess.unavailable
    })
    const browserRequest=checkReaderApiCompatibility(pluginInstance,connection.connectionMode==="hosted"?SHARE_SERVICE_ENDPOINT_PROD:connection.apiUrl,address).then(result=>{
      if(round!==verificationRound || browser!==browserSnapshot())return
      compatibilityOk=result.ok
      compatibilityCheckState=result.ok?"success":"error"
      compatibilityMessage=result.ok?pluginInstance.i18n.serviceAccess.browserVerified:pluginInstance.i18n.serviceErrors[result.errorCode] || pluginInstance.i18n.serviceAccess.unavailable
    })
    try{await Promise.all([apiRequest,readingRequest,browserRequest])}
    finally{if(round===verificationRound)isVerifying=false}
  }
  const useDetectedMode=()=>{
    draft.connectionMode=detectedMode===false?"self-hosted":"hosted"
    switchMode()
  }


  const sections: Array<{ id: SettingsWorkspaceSectionId; label: string }> = [
    { id: "general", label: pluginInstance.i18n.settingsWorkspace.general },
    { id: "display", label: pluginInstance.i18n.settingsWorkspace.display },
    { id: "share", label: pluginInstance.i18n.settingsWorkspace.share },
    { id: "incremental", label: pluginInstance.i18n.settingsWorkspace.incremental },
  ]

  // Hosted keeps the fixed official entry; self-hosted never inherits it.
  $: domainOptions = [...new Set([draft.domain, ...(draft.connectionMode==="hosted"?DEFAULT_DOMAINS:[]), ...(draft.connectionMode==="hosted"?draft.domains:draft.domains.filter(item=>!DEFAULT_DOMAINS.includes(item)))])].filter(Boolean)
  $: selfHostedAddresses=[localConfig.connectionProfiles?.["self-hosted"]?.appConfig?.domain,draft.connectionMode==="self-hosted"?draft.domain:undefined].filter(Boolean)
  $: authorizedDomainOptions=draft.connectionMode==="hosted"
    ? [...new Set([...DEFAULT_DOMAINS,...draft.domains])].filter(item=>!selfHostedAddresses.includes(item))
    : [...new Set([...draft.domains,...(draft.domain?[draft.domain]:[])])].filter(item=>!DEFAULT_DOMAINS.includes(item))
  $: readingNeedsConfirmation=draft.connectionMode==="hosted" && !authorizedDomainOptions.includes(draft.domain)
  $: docPathOptions = [...new Set([draft.docPath, ...DEFAULT_DOC_PATHS, ...draft.docPaths])].filter(Boolean)
  $: isDirty = !isLoading && JSON.stringify(draft) !== initialSnapshot
  $: accountSummary =
    vipInfo.code !== 0 || !vipInfo.data
      ? []
      : vipInfo.hostedMode === false ? [
          {label:pluginInstance.i18n.settingsWorkspace.accountStatus,value:pluginInstance.i18n.serviceAccess.selfHosted},
          {label:pluginInstance.i18n.serviceAccess.instanceIdentity,value:vipInfo.data.email},
        ] : [
          {
            label: pluginInstance.i18n.settingsWorkspace.accountStatus,
            value: vipInfo.data.payType==="trial" || vipInfo.data.isTrial===true ? pluginInstance.i18n.serviceAccess.trialPlan : vipInfo.data.isVip ? "VIP" : pluginInstance.i18n.keyInfo.freeUser,
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
            value: vipInfo.data.num >= 999 ? pluginInstance.i18n.keyInfo.lifetime : `${vipInfo.data.num} ${pluginInstance.i18n.cardType.day}`,
          },
          {
            label: pluginInstance.i18n.settingsWorkspace.accountSince,
            value: vipInfo.data.from,
          },
        ]
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
    const revision = ++workspaceRevision
    isLoading = true

    try {
      localConfig = createNormalizedWorkspaceConfig(await pluginInstance.safeLoad(SHARE_PRO_STORE_NAME))

      draft = createSettingsWorkspaceDraft(localConfig)
      observedConnection=JSON.stringify([draft.connectionMode,draft.serviceApiUrl,draft.serviceApiToken])
      initialSnapshot = JSON.stringify(draft)
      isLoading = false
      const account = await loadServiceAccess(pluginInstance)
      if (revision !== workspaceRevision) return
      vipInfo = account
      if (vipInfo.code === 0) {
        try {
          const remoteAppConfig = await withServiceTimeout(signal => settingService.getSettingByAuthor(vipInfo.data.email, signal))
          if (revision === workspaceRevision && !isSaving && JSON.stringify(draft) === initialSnapshot) {
            localConfig={...localConfig,appConfig:mergeRemoteAppConfig(localConfig.appConfig,remoteAppConfig)}
            draft = createSettingsWorkspaceDraft(localConfig)
            initialSnapshot = JSON.stringify(draft)
          }
        } catch (error) {
          logger.warn("load remote settings failed, fallback to local config", error)
        }
      }
    } finally {
      isLoading = false
    }
  }

  const handleSave = async () => {
    if (isSaving) {
      return
    }

    isSaving = true
    ++workspaceRevision
    ++verificationRound

    try {
      try {
        draft.serviceApiUrl = normalizeServiceApiUrl(draft.serviceApiUrl)
      } catch {
        saveErrorMessage = pluginInstance.i18n.serviceAccess.invalidAddress
        return
      }
      try {draft.domain=normalizeServiceApiUrl(draft.domain)} catch {saveErrorMessage=pluginInstance.i18n.serviceAccess.invalidReadingAddress;return}
      if(!/^[A-Za-z0-9_-]+$/.test(draft.docPath)){saveErrorMessage=pluginInstance.i18n.serviceAccess.invalidPath;return}
      draft.serviceApiToken = draft.serviceApiToken.trim()
      observedConnection=JSON.stringify([draft.connectionMode,draft.serviceApiUrl,draft.serviceApiToken])
      const customCss = draft.customCssEnabled ? await fetchCustomCss() : ([] as any[])
      const finalConfig = applySettingsWorkspaceDraft(localConfig, draft, customCss)
      const savedSnapshot = JSON.stringify(draft)
      saveErrorMessage = ""

      const result = await persistSettingsWorkspace({
        finalConfig,
        saveLocal: async (config) => {
          await pluginInstance.saveData(SHARE_PRO_STORE_NAME, config)
          localConfig = config
          initialSnapshot = savedSnapshot
          vipInfo = { code: -2, msg: "", data: null }
          vipInfo = await loadServiceAccess(pluginInstance)
          detectedMode=vipInfo.errorCode?.startsWith("CLIENT_")?undefined:vipInfo.hostedMode
          verificationOk=vipInfo.code===0 && vipInfo.hostedMode===(draft.connectionMode==="hosted")
          apiCheckState=verificationOk?"success":"error"
          verificationMessage=vipInfo.code===0 && !verificationOk?pluginInstance.i18n.serviceErrors.CLIENT_MODE_MISMATCH:verificationOk?pluginInstance.i18n.serviceAccess.verified:vipInfo.msg
          window.dispatchEvent(new CustomEvent(SETTINGS_SAVED_EVENT))
        },
        syncRemote: async (appConfig) => {
          const response = await withServiceTimeout(signal => settingService.syncSetting(finalConfig.serviceApiConfig.token, appConfig, signal))
          if (response?.code !== 0) {
            throw new Error(response?.msg || pluginInstance.i18n.settingsWorkspace.syncFailed)
          }
        },
      })

      localConfig = finalConfig
      initialSnapshot = savedSnapshot

      if (result.syncedRemote) {
        const savedConnection=connectionSnapshot()
        readingCheckState=compatibilityCheckState="pending"
        const [reader,browser]=await Promise.all([checkReadingConnection(pluginInstance,draft.domain),checkReaderApiCompatibility(pluginInstance,finalConfig.serviceApiConfig.apiUrl,draft.domain)])
        if(savedConnection===connectionSnapshot()){
          readingOk=reader.ok
          readingCheckState=reader.ok?"success":reader.pending?"idle":"error"
          readingMessage=reader.ok?pluginInstance.i18n.serviceAccess.readingVerified:reader.pending?pluginInstance.i18n.serviceAccess.readingPending:pluginInstance.i18n.serviceErrors[reader.errorCode] || pluginInstance.i18n.serviceAccess.unavailable
          compatibilityOk=browser.ok
          compatibilityCheckState=browser.ok?"success":"error"
          compatibilityMessage=browser.ok?pluginInstance.i18n.serviceAccess.browserVerified:pluginInstance.i18n.serviceErrors[browser.errorCode] || pluginInstance.i18n.serviceAccess.unavailable
        }
      } else {
        saveErrorMessage = pluginInstance.i18n.settingsWorkspace.syncFailed
      }
    } catch (error) {
      logger.error("save settings workspace error", error)
      saveErrorMessage = pluginInstance.i18n.settingsWorkspace.saveFailed
    } finally {
      isSaving = false
    }
  }

  const handleCancel = () => {
    dialog.destroy()
  }

  onDestroy(() => { ++workspaceRevision; ++verificationRound })

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

  <section class="workspace-main">
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

    <div class="workspace-scroll" bind:this={workspaceMainEl} tabindex="0">
      {#if isLoading}
        <div class="workspace-loading">{pluginInstance.i18n.incrementalShare.loading}</div>
      {:else if activeSection === "general"}
        <div class="workspace-section general-section">
          <div class="section-card connection-settings-card">
            {#if draft.requiresModeConfirmation}<div class="status-panel" role="status">{pluginInstance.i18n.serviceAccess.confirmLegacy} <button class="b3-button b3-button--text" on:click|stopPropagation={()=>draft.requiresModeConfirmation=false}>{pluginInstance.i18n.serviceAccess.confirmMode}</button></div>{/if}
            <fieldset class="connection-mode" disabled={isSaving}>
              <legend>{pluginInstance.i18n.serviceAccess.mode}</legend>
              <label><input type="radio" name="share-connection-mode" value="hosted" bind:group={draft.connectionMode} on:change={()=>switchMode("hosted")} /> {pluginInstance.i18n.serviceAccess.hosted}</label>
              <label><input type="radio" name="share-connection-mode" value="self-hosted" bind:group={draft.connectionMode} on:change={()=>switchMode("self-hosted")} /> {pluginInstance.i18n.serviceAccess.selfHosted}</label>
            </fieldset>
            <div class="key-label-row"><label class="subsection-title" for="share-service-api-key">{pluginInstance.i18n.serviceAccess.key}</label>{#if draft.connectionMode==="hosted"}<span id="share-service-key-help" class="key-help">{pluginInstance.i18n.serviceAccess.hostedKeyHelp}</span>{/if}</div>
            <div class="key-field">
              {#if draft.connectionMode === "hosted"}
                <div class="hosted-key-editor">
                  {#if showKey}
                    <textarea id="share-service-api-key" class="b3-text-field hosted-key-input" rows="3" wrap="soft" bind:value={draft.serviceApiToken} disabled={isSaving} autocomplete="off" spellcheck="false" aria-describedby="share-service-key-help" placeholder={pluginInstance.i18n.serviceAccess.hostedKeyPlaceholder} />
                  {:else}
                    <textarea id="share-service-api-key" class="b3-text-field hosted-key-input" rows="3" wrap="soft" readonly value={draft.serviceApiToken ? "•".repeat(Math.min(draft.serviceApiToken.length, 240)) : ""} disabled={isSaving} autocomplete="off" spellcheck="false" on:paste={pasteHostedKey} aria-describedby="share-service-key-help" placeholder={pluginInstance.i18n.serviceAccess.hostedKeyPlaceholder} />
                  {/if}
                </div>
              {:else if showKey}
                <input type="text" id="share-service-api-key" class="b3-text-field fn__block reg-code-input" bind:value={draft.serviceApiToken} disabled={isSaving} autocomplete="off" spellcheck="false" placeholder={pluginInstance.i18n.serviceAccess.keyPlaceholder} />
              {:else}
                <input type="password" id="share-service-api-key" class="b3-text-field fn__block reg-code-input" bind:value={draft.serviceApiToken} disabled={isSaving} autocomplete="off" spellcheck="false" placeholder={pluginInstance.i18n.serviceAccess.keyPlaceholder} />
              {/if}
              <button class="b3-button b3-button--text" type="button" aria-pressed={showKey} on:click|stopPropagation={()=>showKey=!showKey}>{showKey?pluginInstance.i18n.serviceAccess.hideKey:pluginInstance.i18n.serviceAccess.showKey}</button>
            </div>
            <div class="inline-divider" />
            <label class="subsection-title" for="share-service-api-url">{pluginInstance.i18n.serviceAccess.address}</label>
            <div class="section-tip">{pluginInstance.i18n.serviceAccess.addressHelp}</div>
            <div class="api-field"><input id="share-service-api-url" class="b3-text-field fn__block" type="url"
              bind:value={draft.serviceApiUrl} readonly={draft.connectionMode==="hosted"} disabled={isSaving} placeholder="https://api.example.com" />
              <button type="button" class="b3-button b3-button--outline" data-action="verify-connection" disabled={isSaving || isVerifying} on:click|stopPropagation={verifyConnection}>
                {isVerifying ? pluginInstance.i18n.serviceAccess.verifying : pluginInstance.i18n.serviceAccess.verify}
              </button>
            </div>
            <div class="connection-verification">

              {#if detectedMode!==undefined && detectedMode!==(draft.connectionMode!=="self-hosted")}
                <button type="button" class="b3-button b3-button--text" on:click|stopPropagation={useDetectedMode}>{pluginInstance.i18n.serviceAccess.useDetectedMode}</button>
              {/if}
            </div>
            <div class="inline-divider" />
            <div class="setting-row">
              <div class="setting-copy">
                <label class="setting-label" for="share-reading-domain">{pluginInstance.i18n.cs.domain}</label>
                <div class="setting-tip">{pluginInstance.i18n.serviceAccess.readingAddressHelp} {#if draft.connectionMode==="hosted"}<a class="setting-link" href={domainApplyUrl} target="_blank" rel="noopener noreferrer">{pluginInstance.i18n.cs.domainApply}</a>{/if}</div>
              </div>
              <div class="reading-control">{#if draft.connectionMode==="hosted"}<select id="share-reading-domain" class="b3-select control-select" bind:value={draft.domain}>{#each domainOptions as item}<option value={item} disabled={!authorizedDomainOptions.includes(item)}>{item}</option>{/each}</select>{:else}<input id="share-reading-domain" class="b3-text-field control-select" type="url" list="share-reading-domain-options" bind:value={draft.domain} /><datalist id="share-reading-domain-options">{#each domainOptions as item}<option value={item} />{/each}</datalist>{/if}</div>
            </div>

            {#if readingNeedsConfirmation}<p class="check-error" role="status">{pluginInstance.i18n.serviceAccess.confirmReading}</p>{/if}
            <div class="setting-row">
              <div class="setting-copy">
                <label class="setting-label" for="share-reading-path">{pluginInstance.i18n.cs.docPath}</label>
                <div class="setting-tip"><span title={pluginInstance.i18n.cs.docPathTip}>{draft.domain}/{draft.docPath}/…</span></div>
              </div>
              <div class="reading-control"><input id="share-reading-path" class="b3-text-field control-select" list="share-reading-path-options" bind:value={draft.docPath} /><datalist id="share-reading-path-options">{#each docPathOptions as item}<option value={item} />{/each}</datalist></div>
            </div>
            <div class="connection-checks" aria-live="polite">
              <p class:check-success={apiCheckState==="success"} class:check-error={apiCheckState==="error"} data-check="api" data-state={apiCheckState} role="status">{apiCheckState==="success"?"✓":apiCheckState==="error"?"✕":apiCheckState==="pending"?"…":"○"} API · {verificationMessage || pluginInstance.i18n.serviceAccess.notChecked}</p>
              <p class:check-success={readingCheckState==="success"} class:check-error={readingCheckState==="error"} data-check="reading" data-state={readingCheckState} role="status">{readingCheckState==="success"?"✓":readingCheckState==="error"?"✕":readingCheckState==="pending"?"…":"○"} {pluginInstance.i18n.serviceAccess.readingAddressLabel} · {readingMessage || pluginInstance.i18n.serviceAccess.notChecked}</p>
              <p class:check-success={compatibilityCheckState==="success"} class:check-error={compatibilityCheckState==="error"} data-check="browser" data-state={compatibilityCheckState} role="status">{compatibilityCheckState==="success"?"✓":compatibilityCheckState==="error"?"✕":compatibilityCheckState==="pending"?"…":"○"} {pluginInstance.i18n.serviceAccess.browserLabel} · {compatibilityMessage || pluginInstance.i18n.serviceAccess.notChecked}</p>
            </div>
          </div>

          <div class="section-card account-access-card">
            <div class="section-title">{draft.connectionMode==="self-hosted"?pluginInstance.i18n.serviceAccess.instanceAccess:pluginInstance.i18n.settingsWorkspace.account}</div>
            {#if vipInfo.code === -3}
              <div class="status-panel" role="status">{pluginInstance.i18n.serviceAccess.needsVerification}</div>
            {:else if vipInfo.code === -2}
              <div class="status-panel" role="status">{pluginInstance.i18n.serviceAccess.checking}</div>
            {:else if vipInfo.code !== 0 || !vipInfo.data}
              <div class="status-panel status-error" role="alert">
                {vipInfo.msg}
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
            {#if draft.connectionMode==="hosted" && vipInfo.hostedMode!==false}
              <div class="section-tip compact-reg-tip">
                <a class="fn__code" href="https://store.terwer.space/products/share-pro">{vipInfo.errorCode==="AUTH_EXPIRED"?pluginInstance.i18n.serviceAccess.renew:pluginInstance.i18n.bs.regCodeClick}</a>
                <span>{pluginInstance.i18n.bs.regCodeTip}</span>
              </div>
            {/if}
          </div>

        </div>
      {:else if activeSection === "display"}
        <div class="workspace-section">
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
  .connection-mode { border: 0; margin: 0 0 16px; padding: 0; }
  .connection-mode label { display: inline-flex; align-items: center; gap: 4px; margin-right: 20px; }
  .connection-mode legend { margin-bottom: 8px; }
  .connection-verification { margin: 10px 0; }
  .connection-verification p { white-space: normal; overflow-wrap: anywhere; }

  .settings-workspace {
    display: flex;
    min-height: min(86vh, 860px);
    max-height: min(86vh, 860px);
    background: var(--b3-theme-background);
    border-radius: 10px;
    overflow: hidden;
  }

  .workspace-sidebar {
    width: 180px;
    min-width: 180px;
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
    overflow: hidden;
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
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 14px 18px 18px;
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
    flex-shrink:0;
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
      min-height: min(88vh, 900px);
      max-height: min(88vh, 900px);
    }

    .workspace-sidebar {
      display: none;
    }

    .workspace-nav-mobile {
      display: flex;
    }

    .workspace-scroll {
      padding: 10px 12px;
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
  .key-field, .reading-control { display:flex; gap:6px; align-items:center; min-width:0; }
  .key-field input { min-width:0; flex:1; height:30px; }

  .check-success { color:var(--b3-card-success-color, #238636); margin:4px 0; }
  .check-error { color:var(--b3-theme-error); margin:4px 0; }
  .connection-settings-card { padding:12px 14px; }
  .connection-settings-card .inline-divider { margin:8px 0; }
  .connection-settings-card .setting-row { padding:8px 0; gap:8px; }
  .connection-settings-card .section-tip { font-size:12px; line-height:1.4; }
  .connection-settings-card .setting-tip { max-width:350px; font-size:12px; }
  .connection-settings-card .connection-mode { margin:4px 0 8px; }
  .general-section .account-access-card { padding:10px 14px; }
  .general-section .status-panel { padding:8px; }
  .general-section .section-title { margin-bottom:6px; }
  .general-section .compact-status-grid { display:flex; flex-wrap:wrap; gap:6px 16px; }
  .general-section .status-item { min-width:100px; }
  .reg-code-input { min-height:30px; resize:none; }
  .general-section { display:flex; flex-direction:column; gap:10px; }
  .api-field { display:flex; align-items:center; gap:8px; margin-top:6px; }
  .api-field input { min-width:0; flex:1; }
.api-field input[readonly] { background:var(--b3-theme-surface); color:var(--b3-theme-on-surface-light); cursor:default; }
  .api-field button { flex-shrink:0; white-space:nowrap; }
  .connection-verification { margin:4px 0; }
  .connection-verification:empty { display:none; }
  .connection-mode legend { font-weight:600; margin-bottom:4px; }
  .general-section .compact-status-grid { display:flex; flex-wrap:wrap; gap:6px 14px; }
  .general-section .compact-reg-tip { display:flex; flex-wrap:wrap; gap:4px 8px; margin-top:6px; font-size:12px; line-height:1.4; }
  .general-section .reading-control { flex:0 1 340px; }
  .general-section .reading-control .control-select { width:100%; min-width:0; }
  .general-section .setting-tip { font-size:12px; line-height:1.4; overflow-wrap:anywhere; }
  .general-section .setting-row { align-items:center; }
  .general-section .subsection-title { margin-bottom:4px; }
  @media screen and (max-height:780px) and (min-width:721px) {
    .workspace-scroll { padding:8px 12px; }
    .connection-settings-card .hosted-key-input {min-height:54px;height:54px;padding:4px 8px;font-size:12px;line-height:1.2;}
    .workspace-nav-mobile { padding:4px 12px 0; gap:4px; }
    .workspace-nav-chip { padding:5px 10px; }
    .connection-settings-card { padding:8px 12px; }
    .connection-settings-card .connection-mode { margin:0 0 5px; }
    .connection-settings-card .inline-divider { margin:5px 0; }
    .connection-settings-card .setting-row { padding:5px 0; }
    .connection-settings-card .setting-label { margin-bottom:2px; font-size:14px; }
    .connection-settings-card .section-tip { margin-bottom:4px; font-size:11px; }
    .general-section .account-access-card { padding:7px 12px; }
    .general-section .status-panel { padding:5px 8px; }
    .general-section .section-title { margin-bottom:3px; }
    .general-section { gap:7px; }
    .workspace-footer { padding:8px 14px; }
  }

  .hosted-key-editor { flex:1; min-width:0; }
  .hosted-key-input { display:block; width:100%; min-height:64px; height:64px; resize:vertical; max-height:100px; font-family:var(--b3-font-family-code); font-size:12px; line-height:1.4; white-space:pre-wrap; overflow-wrap:anywhere; word-break:break-all; }
  .key-help { margin-top:3px; font-size:11px; line-height:1.3; color:var(--b3-theme-on-surface); }
  .connection-checks {display:flex;flex-wrap:wrap;gap:3px 16px;margin-top:5px;color:var(--b3-theme-on-surface);font-size:12px;line-height:1.4;}
  .connection-checks p {margin:2px 0;min-width:0;overflow-wrap:anywhere;}
  .key-label-row {display:flex;align-items:baseline;flex-wrap:wrap;gap:3px 10px;}
  .key-label-row .key-help {margin-top:0;}
  .connection-mode legend {float:left;margin:0 16px 0 0;}
  .general-section .status-item {flex:0 0 auto;min-width:0;max-width:100%;}
  .general-section .status-item:nth-child(2) {flex:1 1 180px;}
  .general-section .compact-reg-tip {margin-bottom:0;}
  @media screen and (min-width:721px) and (max-width:960px) and (max-height:780px) {
    .settings-workspace {min-height:calc(100vh - 56px);max-height:calc(100vh - 56px);}
  }
</style>
