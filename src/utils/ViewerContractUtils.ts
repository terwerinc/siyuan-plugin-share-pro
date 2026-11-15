/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2026 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import { SHARE_SERVICE_ENDPOINT_PROD } from "../Constants"
import { AppConfig } from "../models/AppConfig"
import { ShareProConfig } from "../models/ShareProConfig"

const DEFAULT_AI_ASSISTANT_ENABLED = true
const DEFAULT_POST_META_ENABLED = true

type ViewerContractAppConfig = Partial<AppConfig> & {
  aiAssistantEnabled: boolean
  postMetaEnabled: boolean
}

const normalizeAppConfigForViewerContract = (appConfig?: Partial<AppConfig> | null): ViewerContractAppConfig => {
  const publicConfig=JSON.parse(JSON.stringify(appConfig ?? {}))
  const strip=(item:any)=>{if(!item||typeof item!=="object")return;for(const key of Object.keys(item)){if(/token|secret|credential|authorization|siyuanConfig|serviceApiConfig|connectionProfiles|authCode|registrationKey/i.test(key)||["hostedMode","errorCode"].includes(key)||(/password/i.test(key)&&!["passwordEnabled","showPassword"].includes(key)))delete item[key];else strip(item[key])}}
  strip(publicConfig)
  return {
    ...publicConfig,
    aiAssistantEnabled: appConfig?.aiAssistantEnabled ?? DEFAULT_AI_ASSISTANT_ENABLED,
    postMetaEnabled: appConfig?.postMetaEnabled ?? DEFAULT_POST_META_ENABLED,
  }
}

const normalizeShareProConfigForViewerContract = (config?: ShareProConfig | null): ShareProConfig => {
  const normalizedConfig = { ...(config ?? {}) } as ShareProConfig
  if(normalizedConfig.serviceApiConfig?.connectionMode === "hosted") normalizedConfig.serviceApiConfig={...normalizedConfig.serviceApiConfig,apiUrl:SHARE_SERVICE_ENDPOINT_PROD}
  normalizedConfig.appConfig = normalizeAppConfigForViewerContract(normalizedConfig.appConfig)
  return normalizedConfig
}

const resolveAiAssistantEnabled = (
  docSettings?: {
    aiAssistantEnabled?: unknown
  } | null,
  sourcePost?: {
    aiAssistantEnabled?: unknown
  } | null,
  appConfig?: Partial<AppConfig> | null
): boolean => {
  if (typeof docSettings?.aiAssistantEnabled === "boolean") {
    return docSettings.aiAssistantEnabled
  }

  if (typeof sourcePost?.aiAssistantEnabled === "boolean") {
    return sourcePost.aiAssistantEnabled
  }

  return normalizeAppConfigForViewerContract(appConfig).aiAssistantEnabled
}

const applyViewerPostContract = <T extends Record<string, any>>(
  targetPost: T,
  docSettings?: {
    aiAssistantEnabled?: unknown
  } | null,
  sourcePost?: {
    aiAssistantEnabled?: unknown
  } | null,
  appConfig?: Partial<AppConfig> | null
): T & { aiAssistantEnabled: boolean } => {
  targetPost.aiAssistantEnabled = resolveAiAssistantEnabled(docSettings, sourcePost, appConfig)
  return targetPost as T & { aiAssistantEnabled: boolean }
}

export {
  DEFAULT_AI_ASSISTANT_ENABLED,
  DEFAULT_POST_META_ENABLED,
  normalizeAppConfigForViewerContract,
  normalizeShareProConfigForViewerContract,
  resolveAiAssistantEnabled,
  applyViewerPostContract,
}
