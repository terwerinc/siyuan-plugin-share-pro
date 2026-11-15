/* Copyright (C) 2026 Terwer, Inc. GPL-3.0. */
import { ApiUtils } from "./ApiUtils"
import { SHARE_SERVICE_ENDPOINT_PROD } from "../Constants"
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
  try {apiUrl=normalizeServiceApiUrl(connection.connectionMode === "hosted" ? SHARE_SERVICE_ENDPOINT_PROD : connection.apiUrl)} catch {return failure(plugin,"CLIENT_INVALID_SERVICE_ADDRESS")}
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

/** Reading reachability is a separate kernel request with no service/SiYuan credentials forwarded. */
export const checkReadingConnection = async (plugin:ShareProPlugin, address:string, timeoutMs=8000) => {
  let url:string
  try { url=normalizeServiceApiUrl(address) } catch { return {ok:false,errorCode:"CLIENT_INVALID_READING_ADDRESS"} }
  try {
    const {kernelApi}=await ApiUtils.getSiyuanKernelApi(plugin)
    const result=await withServiceTimeout(()=>kernelApi.forwardProxy(url, [], undefined, "GET", undefined, undefined, "text", timeoutMs),timeoutMs)
    const status=Number(result?.status)
    const headers=result?.headers || {}
    const errorHeader=Object.keys(headers).find(key=>key.toLowerCase()==="x-error-code")
    const value=headers[errorHeader]
    const code=Array.isArray(value)?value[0]:value
    const settled=status>=200 && status<400
    if (settled) return {ok:true,errorCode:""}
    // A reachable reader that has no synchronized settings is not a failure: saving publishes them.
    if (code==="CONFIGURATION_REQUIRED") return {ok:false,pending:true,errorCode:"CLIENT_CONFIGURATION_PENDING"}
    return {ok:false,errorCode:code==="CONFIGURATION_CONFLICT"?code:"CLIENT_READING_UNREACHABLE"}
  } catch(error) {return {ok:false,errorCode:error?.name==="ServiceTimeoutError"?"CLIENT_TIMEOUT":"CLIENT_READING_UNREACHABLE"}}
}

/** Checks the reader origin's CORS permission without forwarding credentials. */
export const checkReaderApiCompatibility=async(plugin:ShareProPlugin,apiAddress:string,readingAddress:string,timeoutMs=8000)=>{
  let api:string,reader:URL
  try{api=normalizeServiceApiUrl(apiAddress);reader=new URL(normalizeServiceApiUrl(readingAddress))}catch{return {ok:false,errorCode:"CLIENT_INVALID_SERVICE_ADDRESS"}}
  if(reader.protocol==='https:' && new URL(api).protocol==='http:')return {ok:false,errorCode:"CLIENT_MIXED_CONTENT"}
  if(new URL(api).origin===reader.origin)return {ok:true,errorCode:""}
  try{
    const {kernelApi}=await ApiUtils.getSiyuanKernelApi(plugin)
    const response=await withServiceTimeout(()=>kernelApi.forwardProxy(api+'/api/license/vipInfo',[{Origin:reader.origin},{'Access-Control-Request-Method':'POST'},{'Access-Control-Request-Headers':'content-type,authorization'}],undefined,'OPTIONS',undefined,undefined,'text',timeoutMs),timeoutMs)
    const headers=response?.headers || {}
    const header=(key:string)=>{const name=Object.keys(headers).find(k=>k.toLowerCase()===key);const value=headers[name];return Array.isArray(value)?value.join(','):String(value || '')}
    const allowedOrigin=header('access-control-allow-origin')
    const allowedMethods=header('access-control-allow-methods').toLowerCase()
    const allowedHeaders=header('access-control-allow-headers').toLowerCase()
    const ok=Number(response?.status)>=200 && Number(response?.status)<400 && [reader.origin,'*'].includes(allowedOrigin) && (allowedMethods.includes('post')||allowedMethods==='*') && (allowedHeaders==='*'||['authorization','content-type'].every(h=>allowedHeaders.includes(h)))
    return {ok,errorCode:ok?'':'CLIENT_CORS_ERROR'}
  }catch{return {ok:false,errorCode:'CLIENT_CORS_ERROR'}}
}
