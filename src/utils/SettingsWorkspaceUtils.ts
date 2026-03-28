/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2026 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import {
  DEFAULT_SIYUAN_API_URL,
  DEFAULT_SIYUAN_AUTH_TOKEN,
  DEFAULT_SIYUAN_COOKIE,
  DEFAULT_SIYUAN_LANG,
  isDev,
  SHARE_SERVICE_ENDPOINT_DEV,
  SHARE_SERVICE_ENDPOINT_PROD,
} from "../Constants"
import { AppConfig } from "../models/AppConfig"
import { ShareProConfig } from "../models/ShareProConfig"
import { DefaultAppConfig, versionMap } from "./ShareConfigUtils"
import { normalizeShareProConfigForViewerContract } from "./ViewerContractUtils"

type SettingsWorkspaceSectionId = "general" | "display" | "share" | "incremental"

interface SettingsWorkspaceDraft {
  serviceApiToken: string
  newUIEnabled: boolean
  customCssEnabled: boolean
  fixTitle: boolean

  theme: string
  domains: string[]
  domain: string
  docPaths: string[]
  docPath: string

  siteTitle: string
  siteSlogan: string
  siteDescription: string
  header: string
  footer: string
  shareTemplate: string

  shareSubdocuments: boolean
  shareReferences: boolean
  aiAssistantEnabled: boolean
  postMetaEnabled: boolean
  docTreeEnabled: boolean
  docTreeLevel: number
  outlineEnabled: boolean
  outlineLevel: number
  passwordEnabled: boolean
  showPassword: boolean

  incrementalShareEnabled: boolean
}

interface PersistSettingsWorkspaceParams {
  finalConfig: ShareProConfig
  saveLocal: (config: ShareProConfig) => Promise<void>
  syncRemote: (appConfig: AppConfig) => Promise<void>
}

interface PersistSettingsWorkspaceResult {
  syncedRemote: boolean
  syncError?: unknown
}

const DEFAULT_DOMAIN = isDev ? "http://localhost:4000" : "https://siyuannote.site"
const DEFAULT_DOMAINS = isDev ? ["http://localhost:4000"] : ["https://siyuannote.site", "https://siyuannote.space"]
const DEFAULT_DOC_PATH = "x"
const DEFAULT_DOC_PATHS = ["x", "s", "p", "a", "static", "post", "link", "doc", "article"]
const DEFAULT_THEME = "Zhihu"

const DARK_THEME_VALUES = new Set([
  "midlight",
  "Zhihu",
  "Savor",
  "Tsundoku",
  "pink-room",
  "trends-in-siyuan",
])

const cloneArray = <T>(value?: T[] | null, fallback: T[] = []): T[] => {
  return Array.isArray(value) ? [...value] : [...fallback]
}

const mergeAppConfigWithDefaults = (appConfig?: Partial<AppConfig> | null): AppConfig => {
  return {
    ...DefaultAppConfig,
    domains: cloneArray(appConfig?.domains, DEFAULT_DOMAINS),
    domain: appConfig?.domain ?? DEFAULT_DOMAIN,
    docPaths: cloneArray((appConfig as any)?.docPaths, DEFAULT_DOC_PATHS),
    docPath: appConfig?.docPath ?? DEFAULT_DOC_PATH,
    theme: {
      ...DefaultAppConfig.theme,
      ...(appConfig?.theme ?? {}),
    },
    incrementalShareConfig: {
      ...DefaultAppConfig.incrementalShareConfig,
      ...(appConfig?.incrementalShareConfig ?? {}),
      notebookBlacklist: cloneArray(appConfig?.incrementalShareConfig?.notebookBlacklist, []),
    },
    ...(appConfig ?? {}),
  } as AppConfig
}

const createNormalizedWorkspaceConfig = (config?: ShareProConfig | null): ShareProConfig => {
  const latestServiceApiUrl = isDev ? SHARE_SERVICE_ENDPOINT_DEV : SHARE_SERVICE_ENDPOINT_PROD
  const mergedPreferenceConfig = {
    fixTitle: false,
    ...(config?.siyuanConfig?.preferenceConfig ?? {}),
  }

  const mergedConfig = {
    siyuanConfig: {
      apiUrl: DEFAULT_SIYUAN_API_URL,
      token: DEFAULT_SIYUAN_AUTH_TOKEN,
      cookie: DEFAULT_SIYUAN_COOKIE,
      ...(config?.siyuanConfig ?? {}),
      preferenceConfig: mergedPreferenceConfig,
    },
    serviceApiConfig: {
      apiUrl: latestServiceApiUrl,
      token: "",
      ...(config?.serviceApiConfig ?? {}),
    },
    appConfig: mergeAppConfigWithDefaults(config?.appConfig),
    isCustomCssEnabled: config?.isCustomCssEnabled ?? true,
    isNewUIEnabled: config?.isNewUIEnabled !== false,
    inited: config?.inited ?? false,
  } as ShareProConfig

  return normalizeShareProConfigForViewerContract(mergedConfig)
}

const mergeRemoteAppConfig = (
  localAppConfig?: Partial<AppConfig> | null,
  remoteAppConfig?: Partial<AppConfig> | null
): AppConfig => {
  const localMerged = mergeAppConfigWithDefaults(localAppConfig)

  if (!remoteAppConfig) {
    return localMerged
  }

  return mergeAppConfigWithDefaults({
    ...localMerged,
    ...remoteAppConfig,
    theme: {
      ...localMerged.theme,
      ...(remoteAppConfig.theme ?? {}),
    },
    incrementalShareConfig: {
      ...localMerged.incrementalShareConfig,
      ...(remoteAppConfig.incrementalShareConfig ?? {}),
      notebookBlacklist: cloneArray(
        remoteAppConfig.incrementalShareConfig?.notebookBlacklist,
        localMerged.incrementalShareConfig?.notebookBlacklist ?? []
      ),
    },
  })
}

const createSettingsWorkspaceDraft = (
  localConfig?: ShareProConfig | null,
  remoteAppConfig?: Partial<AppConfig> | null
): SettingsWorkspaceDraft => {
  const normalizedConfig = createNormalizedWorkspaceConfig(localConfig)
  const mergedAppConfig = mergeRemoteAppConfig(normalizedConfig.appConfig, remoteAppConfig)

  return {
    serviceApiToken: normalizedConfig.serviceApiConfig?.token ?? "",
    newUIEnabled: normalizedConfig.isNewUIEnabled !== false,
    customCssEnabled: normalizedConfig.isCustomCssEnabled ?? true,
    fixTitle: normalizedConfig.siyuanConfig?.preferenceConfig?.fixTitle ?? false,

    theme: mergedAppConfig.theme?.lightTheme ?? DEFAULT_THEME,
    domains: cloneArray(mergedAppConfig.domains, DEFAULT_DOMAINS),
    domain: mergedAppConfig.domain ?? DEFAULT_DOMAIN,
    docPaths: cloneArray((mergedAppConfig as any).docPaths, DEFAULT_DOC_PATHS),
    docPath: mergedAppConfig.docPath ?? DEFAULT_DOC_PATH,

    siteTitle: mergedAppConfig.siteTitle ?? "",
    siteSlogan: mergedAppConfig.siteSlogan ?? "",
    siteDescription: mergedAppConfig.siteDescription ?? "",
    header: mergedAppConfig.header ?? "",
    footer: mergedAppConfig.footer ?? "",
    shareTemplate: mergedAppConfig.shareTemplate ?? DefaultAppConfig.shareTemplate ?? "[url]",

    shareSubdocuments: mergedAppConfig.shareSubdocuments ?? false,
    shareReferences: mergedAppConfig.shareReferences ?? false,
    aiAssistantEnabled: mergedAppConfig.aiAssistantEnabled ?? true,
    postMetaEnabled: mergedAppConfig.postMetaEnabled ?? true,
    docTreeEnabled: mergedAppConfig.docTreeEnabled ?? true,
    docTreeLevel: mergedAppConfig.docTreeLevel ?? 3,
    outlineEnabled: mergedAppConfig.outlineEnabled ?? true,
    outlineLevel: mergedAppConfig.outlineLevel ?? 6,
    passwordEnabled: mergedAppConfig.passwordEnabled ?? false,
    showPassword: mergedAppConfig.showPassword ?? false,

    incrementalShareEnabled: mergedAppConfig.incrementalShareConfig?.enabled ?? true,
  }
}

const resolveDarkTheme = (theme: string): string => {
  return DARK_THEME_VALUES.has(theme) ? theme : "midlight"
}

const applySettingsWorkspaceDraft = (
  sourceConfig: ShareProConfig,
  draft: SettingsWorkspaceDraft,
  customCss: any[] = []
): ShareProConfig => {
  const normalizedConfig = createNormalizedWorkspaceConfig(sourceConfig)

  normalizedConfig.serviceApiConfig.token = draft.serviceApiToken
  normalizedConfig.isNewUIEnabled = draft.newUIEnabled
  normalizedConfig.isCustomCssEnabled = draft.customCssEnabled
  normalizedConfig.siyuanConfig.preferenceConfig.fixTitle = draft.fixTitle

  normalizedConfig.appConfig = mergeAppConfigWithDefaults({
    ...normalizedConfig.appConfig,
    lang: DEFAULT_SIYUAN_LANG,
    domains: cloneArray(draft.domains, DEFAULT_DOMAINS),
    domain: draft.domain,
    docPaths: cloneArray(draft.docPaths, DEFAULT_DOC_PATHS),
    docPath: draft.docPath,
    theme: {
      mode: "light",
      lightTheme: draft.theme,
      darkTheme: resolveDarkTheme(draft.theme),
      themeVersion: versionMap[draft.theme] || "unknown",
    },
    customCss,
    siteTitle: draft.siteTitle,
    siteSlogan: draft.siteSlogan,
    siteDescription: draft.siteDescription,
    header: draft.header,
    footer: draft.footer,
    shareTemplate: draft.shareTemplate,
    shareSubdocuments: draft.shareSubdocuments,
    shareReferences: draft.shareReferences,
    aiAssistantEnabled: draft.aiAssistantEnabled,
    postMetaEnabled: draft.postMetaEnabled,
    docTreeEnabled: draft.docTreeEnabled,
    docTreeLevel: draft.docTreeLevel,
    outlineEnabled: draft.outlineEnabled,
    outlineLevel: draft.outlineLevel,
    passwordEnabled: draft.passwordEnabled,
    showPassword: draft.showPassword,
    incrementalShareConfig: {
      ...(normalizedConfig.appConfig.incrementalShareConfig ?? {}),
      enabled: draft.incrementalShareEnabled,
    },
  })

  return normalizeShareProConfigForViewerContract(normalizedConfig)
}

const persistSettingsWorkspace = async ({
  finalConfig,
  saveLocal,
  syncRemote,
}: PersistSettingsWorkspaceParams): Promise<PersistSettingsWorkspaceResult> => {
  await saveLocal(finalConfig)

  try {
    await syncRemote(finalConfig.appConfig)
    return {
      syncedRemote: true,
    }
  } catch (syncError) {
    return {
      syncedRemote: false,
      syncError,
    }
  }
}

export {
  DEFAULT_DOMAIN,
  DEFAULT_DOMAINS,
  DEFAULT_DOC_PATH,
  DEFAULT_DOC_PATHS,
  DEFAULT_THEME,
  createNormalizedWorkspaceConfig,
  createSettingsWorkspaceDraft,
  applySettingsWorkspaceDraft,
  mergeRemoteAppConfig,
  persistSettingsWorkspace,
  type SettingsWorkspaceDraft,
  type SettingsWorkspaceSectionId,
}
