/* Copyright (C) 2026 Terwer, Inc. GPL-3.0. */
import type ShareProPlugin from "../index"
import type { ServiceResponse } from "../api/share-api"
import { normalizeServiceResponse } from "./ServiceResponseUtils"
import type { ConnectionMode } from "./ServiceResponseUtils"
export const SETTINGS_SAVED_EVENT = "share-pro:settings-saved"
export interface ServiceConnection { apiUrl: string; token: string; connectionMode?: ConnectionMode }
export const normalizeServiceApiUrl = (value: string): string => {
  const url = new URL(value.trim())
  if (!["http:","https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error("Invalid service address")
  return url.href.replace(/\/+$/,"")
}
export const withServiceTimeout = async <T>(request:(signal:AbortSignal)=>Promise<T>,timeoutMs=8000):Promise<T> => {
  const controller=new AbortController()
  let timer:ReturnType<typeof setTimeout>
  const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{const error=new Error("Service request timed out");error.name="ServiceTimeoutError";controller.abort();reject(error)},timeoutMs)})
  try {return await Promise.race([request(controller.signal),timeout])} finally {clearTimeout(timer)}
}
const failure=(plugin:ShareProPlugin,errorCode:string):ServiceResponse=>({code:-1,errorCode,hostedMode:true,data:null,msg:plugin.i18n.serviceErrors?.[errorCode] || plugin.i18n.serviceAccess.unavailable})
const query = async (plugin:ShareProPlugin,connection:ServiceConnection,timeoutMs:number,preview:boolean):Promise<ServiceResponse> => {
  let apiUrl:string
  try {apiUrl=normalizeServiceApiUrl(connection.apiUrl)} catch {return failure(plugin,"CLIENT_INVALID_SERVICE_ADDRESS")}
  try {
    const raw=await withServiceTimeout(signal=>preview
      ? plugin.shareService.getVipInfoForConnection(apiUrl,connection.token.trim(),signal)
      : plugin.shareService.getVipInfo(connection.token ?? "",signal),timeoutMs)
    const result=normalizeServiceResponse(raw,plugin.i18n.serviceErrors,"/api/license/vipInfo")
    if (!result || typeof result.code!=="number" || (result.code===0 && (!result.data || typeof result.data.email!=="string"))) return failure(plugin,"CLIENT_INVALID_RESPONSE")
    return result
  } catch(error) {
    return failure(plugin,["ServiceTimeoutError","AbortError"].includes(error?.name) ? "CLIENT_TIMEOUT" : "CLIENT_NETWORK_ERROR")
  }
}
export const loadServiceAccess=async(plugin:ShareProPlugin,timeoutMs=8000):Promise<ServiceResponse>=>{
  try {const cfg=await plugin.safeLoad<any>("share-pro.json");return await query(plugin,{apiUrl:cfg?.serviceApiConfig?.apiUrl ?? "",token:cfg?.serviceApiConfig?.token ?? ""},timeoutMs,false)}
  catch {return failure(plugin,"CLIENT_NETWORK_ERROR")}
}
export const checkServiceConnection=async(plugin:ShareProPlugin,connection:ServiceConnection,timeoutMs=8000)=>{
  const response=await query(plugin,connection,timeoutMs,true)
  const reachable=!response.errorCode?.startsWith("CLIENT_")
  const modeMatches=reachable && response.hostedMode===(connection.connectionMode!=="self-hosted")
  return {response,reachable,modeMatches,errorCode:reachable&&!modeMatches?"CLIENT_MODE_MISMATCH":response.errorCode}
}
