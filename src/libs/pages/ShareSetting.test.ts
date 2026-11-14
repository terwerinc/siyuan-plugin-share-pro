import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { tick } from "svelte"
import ShareSetting from "./ShareSetting.svelte"
import locale from "../../i18n/en_US.json"
vi.mock("../../index", () => ({ default: class {} }))
const mocks = vi.hoisted(() => ({sync: vi.fn(), read: vi.fn()}))
vi.mock("../../service/SettingService", () => ({ SettingService: class {
  syncSetting = mocks.sync
  getSettingByAuthor = mocks.read
} }))
let component: ShareSetting
let config: any
let plugin: any
const mount = (appConfig = {}) => {
  config = { serviceApiConfig: {apiUrl:"https://original.example.com",token:"old-key"}, isCustomCssEnabled:false, appConfig, inited:true }
  plugin = { i18n:locale, getDefaultCfg:()=>config, safeLoad:vi.fn(async()=>structuredClone(config)),
    saveData:vi.fn(async(_name, value)=>{config=structuredClone(value)}),
    shareService:{getVipInfoForConnection:vi.fn(async(_url,token)=>token==='new-key'?{code:0,hostedMode:true,data:{email:'preview@example.invalid',isVip:1}}:{code:403,errorCode:'AUTH_INVALID',hostedMode:true}),getVipInfo:vi.fn(async()=> config.serviceApiConfig.token === "new-key" ? {code:0,data:{email:"new@example.invalid",isVip:1,payType:"year",num:365,from:"2026-11-14"}} : {code:403,msg:"invalid key"})} }
  component = new ShareSetting({target:document.body,props:{pluginInstance:plugin,dialog:{destroy:vi.fn()} as any}})
}
const field = (id: string, value: string) => {const input=document.querySelector(id) as HTMLInputElement;input.value=value;input.dispatchEvent(new Event("input",{bubbles:true}))}
const save = () => (document.querySelector('.footer-actions .b3-button--primary') as HTMLButtonElement).click()
beforeEach(()=>{mocks.sync.mockReset().mockResolvedValue({code:0});mocks.read.mockReset().mockResolvedValue({})})
afterEach(()=>{component?.$destroy();document.body.innerHTML=""})

it("renders service address and key even when license lookup fails",async()=>{
  mount()
  await vi.waitFor(()=>expect(document.querySelector('#share-service-api-url')).not.toBeNull())
  expect((document.querySelector('#share-service-api-url') as HTMLInputElement).value).toBe(config.serviceApiConfig.apiUrl)
  await vi.waitFor(()=>expect(document.body.textContent).toContain(locale.serviceErrors.AUTH_INVALID))
  expect(document.querySelector('#share-service-api-key')).not.toBeNull()
})
it("saves new address/key locally then refreshes VIP in the same dialog",async()=>{
  mount();await vi.waitFor(()=>expect(document.querySelector('#share-service-api-key')).not.toBeNull())
  field('#share-service-api-url','https://updated.example.com/prefix/')
  field('#share-service-api-key','new-key');await tick();save()
  await vi.waitFor(()=>expect(document.body.textContent).toContain("new@example.invalid"))
  expect(document.body.textContent).toContain("VIP")
  expect(config.serviceApiConfig.apiUrl).toBe('https://updated.example.com/prefix')
  expect(plugin.shareService.getVipInfo).toHaveBeenLastCalledWith('new-key',expect.any(AbortSignal))
  expect(mocks.sync).toHaveBeenCalledWith('new-key',expect.any(Object),expect.any(AbortSignal))
})
it("reports HTTP-style nonzero sync responses inline and retains saved credentials",async()=>{
  mocks.sync.mockResolvedValue({code:403,msg:'rejected'})
  mount();await vi.waitFor(()=>expect(document.querySelector('#share-service-api-key')).not.toBeNull())
  field('#share-service-api-key','new-key');await tick();save()
  await vi.waitFor(()=>expect(document.querySelector('.footer-state-error')?.textContent).toContain(locale.settingsWorkspace.syncFailed))
  expect(config.serviceApiConfig.token).toBe('new-key')
  expect(document.body.textContent).toContain('new@example.invalid')
})
it("rejects invalid addresses without overwriting saved configuration",async()=>{
  mount();await vi.waitFor(()=>expect(document.querySelector('#share-service-api-url')).not.toBeNull())
  field('#share-service-api-url','file:///private');await tick();save()
  await vi.waitFor(()=>expect(document.querySelector('.footer-state-error')?.textContent).toContain(locale.serviceAccess.invalidAddress))
  expect(plugin.saveData).not.toHaveBeenCalled()
})

it("ignores the old account response when saving while initial lookup is pending",async()=>{
  mount()
  let resolveOld: (value: any) => void
  plugin.shareService.getVipInfo.mockImplementationOnce(()=>new Promise(resolve=>{resolveOld=resolve}))
  await vi.waitFor(()=>expect(plugin.shareService.getVipInfo).toHaveBeenCalledOnce())
  field('#share-service-api-key','new-key');await tick();save()
  await vi.waitFor(()=>expect(document.body.textContent).toContain('new@example.invalid'))
  resolveOld({code:403,msg:'old rejected key'})
  await tick();await tick()
  expect(document.body.textContent).toContain('new@example.invalid')
  expect(document.body.textContent).not.toContain('old rejected key')
})
it("keeps an edited draft when delayed remote settings arrive",async()=>{
  let resolveRemote: (value:any)=>void
  mocks.read.mockImplementation(()=>new Promise(resolve=>{resolveRemote=resolve}))
  mount()
  plugin.shareService.getVipInfo.mockResolvedValue({code:0,data:{email:'synthetic@example.invalid',isVip:1}})
  await vi.waitFor(()=>expect(mocks.read).toHaveBeenCalledOnce())
  field('#share-service-api-url','https://draft.example.com')
  await tick()
  resolveRemote({domain:'https://remote.example.com'})
  await tick();await tick()
  expect((document.querySelector('#share-service-api-url') as HTMLInputElement).value).toBe('https://draft.example.com')
  expect(plugin.saveData).not.toHaveBeenCalled()
})

it("puts Key, service API, reading domain and Path in order in the first General card",async()=>{
  mount()
  await vi.waitFor(()=>expect(document.querySelector('#share-reading-path')).not.toBeNull())
  const fields=[...document.querySelectorAll('.connection-settings-card input[id],.connection-settings-card textarea[id],.connection-settings-card select[id]')].map(e=>e.id)
  expect(fields).toEqual(['share-service-api-key','share-service-api-url','share-reading-domain','share-reading-path'])
  expect(document.querySelector('.general-section > .section-card')?.classList.contains('connection-settings-card')).toBe(true)
  expect(document.querySelectorAll('#share-reading-domain')).toHaveLength(1)
  expect(document.querySelectorAll('#share-reading-path')).toHaveLength(1)
})
it("keeps previously saved custom domain and Path visible without changing tabs",async()=>{
  mount({domain:'http://notes.example.test:4000',domains:['https://suggested.example.test'],docPath:'custom-prefix',docPaths:['x']})
  await vi.waitFor(()=>expect(document.querySelector('#share-reading-path')).not.toBeNull())
  expect((document.querySelector('#share-reading-domain') as HTMLSelectElement).value).toBe('http://notes.example.test:4000')
  expect((document.querySelector('#share-reading-path') as HTMLSelectElement).value).toBe('custom-prefix')
})
it("keeps address controls in General and persists their selected values together",async()=>{
  mount()
  await vi.waitFor(()=>expect(document.querySelector('#share-reading-path')).not.toBeNull())
  const display=[...document.querySelectorAll('.workspace-nav-item')].find(e=>e.textContent.trim()===locale.settingsWorkspace.display) as HTMLButtonElement
  display.click();await tick()
  expect(document.querySelector('#share-reading-domain')).toBeNull()
  expect(document.querySelector('#share-reading-path')).toBeNull()
  const general=[...document.querySelectorAll('.workspace-nav-item')].find(e=>e.textContent.trim()===locale.settingsWorkspace.general) as HTMLButtonElement
  general.click();await tick()
  const domain=document.querySelector('#share-reading-domain') as HTMLSelectElement
  const path=document.querySelector('#share-reading-path') as HTMLSelectElement
  field('#share-reading-domain','http://reader.example.test:4000')
  field('#share-reading-path','article')
  field('#share-service-api-key','new-key');await tick();save()
  await vi.waitFor(()=>expect(mocks.sync).toHaveBeenCalledOnce())
  expect(config.appConfig.domain).toBe(domain.value)
  expect(config.appConfig.docPath).toBe('article')
  expect(mocks.sync.mock.calls[0][1]).toMatchObject({domain:domain.value,docPath:'article'})
})

it("defaults the mode selector to hosted before the service address",async()=>{
  mount();await vi.waitFor(()=>expect(document.querySelector('[name="share-connection-mode"]')).not.toBeNull())
  expect((document.querySelector('[name="share-connection-mode"][value="hosted"]') as HTMLInputElement).checked).toBe(true)
  const radio=document.querySelector('[name="share-connection-mode"]') as HTMLElement
  expect(radio.compareDocumentPosition(document.querySelector('#share-service-api-url')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})
it("verifies draft service credentials without persisting them",async()=>{
  mount();await vi.waitFor(()=>expect(document.querySelector('#share-service-api-url')).not.toBeNull())
  field('#share-service-api-url','https://draft.example.test/prefix/');field('#share-service-api-key','new-key');await tick()
  ;(document.querySelector('[data-action="verify-connection"]') as HTMLButtonElement).click()
  await vi.waitFor(()=>expect(document.body.textContent).toContain(locale.serviceAccess.verified))
  expect(plugin.shareService.getVipInfoForConnection).toHaveBeenCalledWith('https://draft.example.test/prefix','new-key',expect.any(AbortSignal))
  expect(plugin.saveData).not.toHaveBeenCalled();expect(config.serviceApiConfig.apiUrl).toBe('https://original.example.com')
})
it("shows instance identity and hides purchase instructions for declared non-hosted services",async()=>{
  mount();plugin.shareService.getVipInfo.mockResolvedValue({code:0,hostedMode:false,data:{email:'instance-id',isVip:1,payType:'self-hosted'}})
  await vi.waitFor(()=>expect(document.body.textContent).toContain('instance-id'))
  expect(document.body.textContent).toContain(locale.serviceAccess.instanceIdentity)
  expect([...document.querySelectorAll('a')].some(a=>a.href.includes('store.terwer.space'))).toBe(false)
  expect(document.body.textContent).not.toContain(locale.settingsWorkspace.accountExpires)
})
it("detects a mode mismatch and offers an explicit radio correction",async()=>{
  mount();await vi.waitFor(()=>expect(document.querySelector('#share-service-api-url')).not.toBeNull())
  plugin.shareService.getVipInfoForConnection.mockResolvedValue({code:0,hostedMode:false,data:{email:'instance'}})
  ;(document.querySelector('[data-action="verify-connection"]') as HTMLButtonElement).click()
  await vi.waitFor(()=>expect(document.body.textContent).toContain(locale.serviceErrors.CLIENT_MODE_MISMATCH))
  const use=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===locale.serviceAccess.useDetectedMode) as HTMLButtonElement
  use.click();await tick()
  expect((document.querySelector('[name="share-connection-mode"][value="self-hosted"]') as HTMLInputElement).checked).toBe(true)
  expect(plugin.saveData).not.toHaveBeenCalled()
})
it("invalidates connection verification when the address changes",async()=>{
  mount();await vi.waitFor(()=>expect(document.querySelector('#share-service-api-url')).not.toBeNull())
  field('#share-service-api-key','new-key');await tick()
  ;(document.querySelector('[data-action="verify-connection"]') as HTMLButtonElement).click()
  await vi.waitFor(()=>expect(document.body.textContent).toContain(locale.serviceAccess.verified))
  field('#share-service-api-url','https://another.example.test');await tick()
  expect(document.body.textContent).not.toContain(locale.serviceAccess.verified)
  expect(document.body.textContent).toContain(locale.serviceAccess.needsVerification)
})
