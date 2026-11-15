import {describe,it,expect} from "vitest"
import {canSkipUnchangedShare,historyMatchesService} from "./ShareHistoryScopeUtils"
const item={docId:"doc",docTitle:"Doc",shareTime:100,shareStatus:"success",docModifiedTime:100,serviceApiUrl:"https://service-a.example.test/"} as any
describe("service-bound incremental history",()=>{
  it("matches normalized API addresses",()=>expect(historyMatchesService(item,"https://service-a.example.test")).toBe(true))
  it("never infers a service for historical unscoped records",()=>expect(historyMatchesService({...item,serviceApiUrl:undefined},item.serviceApiUrl)).toBe(false))
  it("does not skip when the API changes",()=>expect(canSkipUnchangedShare(item,"https://service-b.example.test",50)).toBe(false))
  it("does not skip failed shares",()=>expect(canSkipUnchangedShare({...item,shareStatus:"failed"},item.serviceApiUrl,50)).toBe(false))
  it("does not skip pending shares",()=>expect(canSkipUnchangedShare({...item,shareStatus:"pending"},item.serviceApiUrl,50)).toBe(false))
  it("does not skip modified content",()=>expect(canSkipUnchangedShare(item,item.serviceApiUrl,101)).toBe(false))
  it("allows a valid same-service unchanged success",()=>expect(canSkipUnchangedShare(item,item.serviceApiUrl,100)).toBe(true))
  it("rejects invalid or missing addresses",()=>expect(historyMatchesService(item,undefined)).toBe(false))
})
