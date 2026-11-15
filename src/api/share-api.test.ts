import {afterEach,describe,it,expect,vi} from "vitest"
vi.mock("siyuan",()=>({showMessage:vi.fn()}))
import {ShareApi} from "./share-api"
const plugin={safeLoad:async()=>({serviceApiConfig:{apiUrl:"https://a.example.test/",token:""}}),i18n:{serviceErrors:{}}} as any
afterEach(()=>vi.unstubAllGlobals())
describe("request endpoint provenance",()=>{
  it("attaches actual request context without changing serialized response shape",async()=>{vi.stubGlobal("fetch",async()=>new Response(JSON.stringify({code:0,data:{email:"test@example.invalid"}})));const response=await new ShareApi(plugin).getVipInfoForConnection("https://b.example.test/","new-key");expect((response as any)._serviceApiUrl).toBe("https://b.example.test");expect(JSON.stringify(response)).not.toContain("_serviceApiUrl")})
  it("does not add transport context to raw settings",async()=>{vi.stubGlobal("fetch",async()=>new Response(JSON.stringify({domain:"https://reader.example.test"})));const response=await new ShareApi(plugin).getSettingByAuthor("author");expect((response as any)._serviceApiUrl).toBeUndefined()})
  it("retains endpoint ownership on network errors",async()=>{vi.stubGlobal("fetch",async()=>{throw new Error("network")});await expect(new ShareApi(plugin).getVipInfo("")).rejects.toMatchObject({_serviceApiUrl:"https://a.example.test"})})
})
