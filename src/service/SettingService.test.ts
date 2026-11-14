import {beforeEach,describe,expect,it,vi} from "vitest"
const mocks=vi.hoisted(()=>({getSettingByAuthor:vi.fn()}))
vi.mock("../api/share-api",()=>({ShareApi:class {getSettingByAuthor=mocks.getSettingByAuthor}}))
import {SettingService} from "./SettingService"
const plugin={i18n:{serviceErrors:{UNKNOWN_ERROR:"Unknown error"}}} as any
beforeEach(()=>vi.clearAllMocks())
describe("remote setting response boundary",()=>{
  it("rejects a localized service error rather than saving it as configuration",async()=>{
    mocks.getSettingByAuthor.mockResolvedValue({code:403,errorCode:"AUTH_INVALID",msg:"Check the service Key"})
    await expect(new SettingService(plugin).getSettingByAuthor("author")).rejects.toMatchObject({message:"Check the service Key",errorCode:"AUTH_INVALID"})
  })
  it("preserves an unwrapped setting with an unrelated code field",async()=>{
    mocks.getSettingByAuthor.mockResolvedValue({code:123,domain:"http://localhost:4000",docPathPrefix:"x"})
    expect((await new SettingService(plugin).getSettingByAuthor("author")).code).toBe(123)
  })
  it("preserves valid remote config values",async()=>{
    mocks.getSettingByAuthor.mockResolvedValue({domain:"http://localhost:4000",siteTitle:"保留😀"})
    expect((await new SettingService(plugin).getSettingByAuthor("author")).siteTitle).toBe("保留😀")
  })
})
