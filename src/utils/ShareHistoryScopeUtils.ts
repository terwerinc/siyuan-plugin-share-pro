import {normalizeServiceApiUrl} from "./ServiceAccessUtils"
import type {ShareHistoryItem} from "../types"

export const normalizeHistoryService = (apiUrl?: string): string | undefined => {
  try { return normalizeServiceApiUrl(apiUrl ?? "") } catch { return undefined }
}
export const historyMatchesService = (history: Partial<ShareHistoryItem> | undefined, apiUrl?: string): boolean => {
  const expected=normalizeHistoryService(apiUrl)
  return !!expected && normalizeHistoryService(history?.serviceApiUrl)===expected
}
export const canSkipUnchangedShare = (history: ShareHistoryItem | undefined, apiUrl: string, modifiedTime: number): boolean =>
  historyMatchesService(history,apiUrl) && history?.shareStatus==="success" && Number.isFinite(history.docModifiedTime) && modifiedTime<=history.docModifiedTime
