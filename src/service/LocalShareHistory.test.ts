import {beforeEach,describe,it,expect,vi} from "vitest"
const mocks=vi.hoisted(()=>({attrs:{} as any,getBlockAttrs:vi.fn(),setBlockAttrs:vi.fn()}))
vi.mock("../utils/ApiUtils",()=>({ApiUtils:{getSiyuanKernelApi:async()=>({kernelApi:mocks})}}))
import {LocalShareHistory} from "./LocalShareHistory"
import {SettingKeys} from "../utils/SettingKeys"
const A="https://a.example.test",B="https://b.example.test"
let api=A
const plugin={safeLoad:async()=>({serviceApiConfig:{apiUrl:api}})} as any
const item=(scope?:string)=>({docId:"doc",docTitle:"Doc",shareTime:100,shareStatus:"success",docModifiedTime:100,serviceApiUrl:scope}) as any
beforeEach(()=>{api=A;mocks.attrs={};mocks.getBlockAttrs.mockImplementation(async()=>mocks.attrs);mocks.setBlockAttrs.mockReset();mocks.setBlockAttrs.mockImplementation(async(_id,attrs)=>{mocks.attrs={...mocks.attrs,...attrs}})})
describe("local history ownership",()=>{
  it("tags new records with the current API without credentials",async()=>{await new LocalShareHistory(plugin).addHistory(item());expect(JSON.parse(mocks.attrs[SettingKeys.CUSTOM_SHARE_HISTORY]).serviceApiUrl).toBe(A)})
  it("does not reuse another API history",async()=>{mocks.attrs[SettingKeys.CUSTOM_SHARE_HISTORY]=JSON.stringify(item(A));api=B;expect(await new LocalShareHistory(plugin).getHistoryByDocId("doc")).toBeUndefined()})
  it("preserves unscoped legacy data but requires a new confirmation",async()=>{const legacy=JSON.stringify(item());mocks.attrs[SettingKeys.CUSTOM_SHARE_HISTORY]=legacy;expect(await new LocalShareHistory(plugin).getHistoryByDocId("doc")).toBeUndefined();expect(mocks.attrs[SettingKeys.CUSTOM_SHARE_HISTORY]).toBe(legacy)})
  it("ignores a late result from the previous API",async()=>{api=B;await new LocalShareHistory(plugin).addHistory(item(A));expect(mocks.setBlockAttrs).not.toHaveBeenCalled()})
  it("does not delete another API history",async()=>{mocks.attrs[SettingKeys.CUSTOM_SHARE_HISTORY]=JSON.stringify(item(A));api=B;await new LocalShareHistory(plugin).removeHistory("doc");expect(mocks.setBlockAttrs).not.toHaveBeenCalled()})
  it("still removes confirmed current-service history",async()=>{mocks.attrs[SettingKeys.CUSTOM_SHARE_HISTORY]=JSON.stringify(item(A));await new LocalShareHistory(plugin).removeHistory("doc");expect(mocks.setBlockAttrs).toHaveBeenCalledOnce()})
  it("updates cannot move a record to another document or service",async()=>{mocks.attrs[SettingKeys.CUSTOM_SHARE_HISTORY]=JSON.stringify(item(A));await new LocalShareHistory(plugin).updateHistory("doc",{docId:"other",serviceApiUrl:B,docTitle:"Updated"});const saved=JSON.parse(mocks.attrs[SettingKeys.CUSTOM_SHARE_HISTORY]);expect(saved).toMatchObject({docId:"doc",serviceApiUrl:A,docTitle:"Updated"})})
})
