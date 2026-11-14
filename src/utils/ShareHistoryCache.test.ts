import {describe,it,expect} from "vitest"
import {ShareHistoryCache} from "./ShareHistoryCache"
const item={docId:"doc",docTitle:"Doc",shareTime:100,shareStatus:"success",docModifiedTime:100,serviceApiUrl:"https://a.example.test"} as any
describe("history cache service boundary",()=>{
  it("returns entries only for their service",()=>{const cache=new ShareHistoryCache();cache.set("doc",item);expect(cache.get("doc",item.serviceApiUrl)).toEqual(item);expect(cache.get("doc","https://b.example.test")).toBeUndefined()})
  it("does not expose records without an active service",()=>{const cache=new ShareHistoryCache();cache.set("doc",item);expect(cache.get("doc")).toBeUndefined()})
  it("invalidates a document normally",()=>{const cache=new ShareHistoryCache();cache.set("doc",item);cache.invalidate("doc");expect(cache.get("doc",item.serviceApiUrl)).toBeUndefined()})
})
