import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { tick } from "svelte"
import ShareSetting from "./ShareSetting.svelte"
import locale from "../../i18n/en_US.json"
vi.mock("../../utils/ApiUtils",()=>({ApiUtils:{getSiyuanKernelApi:async()=>({kernelApi:{forwardProxy:mocks.forwardProxy}})}}))
vi.mock("../../index", () => ({ default: class {} }))
const mocks = vi.hoisted(() => ({sync: vi.fn(), read: vi.fn(), forwardProxy:vi.fn()}))
vi.mock("../../service/SettingService", () => ({ SettingService: class {
  syncSetting = mocks.sync
  getSettingByAuthor = mocks.read
} }))
let component: ShareSetting
let config: any
let plugin: any
const mount = (appConfig = {}, connectionMode="self-hosted") => {
  config = { serviceApiConfig: {connectionMode,apiUrl:"https://original.example.com",token:"old-key"}, isCustomCssEnabled:false, appConfig, inited:true }
  plugin = { i18n:locale, getDefaultCfg:()=>config, safeLoad:vi.fn(async()=>structuredClone(config)),
    saveData:vi.fn(async(_name, value)=>{config=structuredClone(value)}),
    shareService:{getVipInfoForConnection:vi.fn(async(_url,token)=>token==='new-key'?{code:0,hostedMode:false,data:{email:'preview@example.invalid',isVip:1}}:{code:403,errorCode:'AUTH_INVALID',hostedMode:true}),getVipInfo:vi.fn(async()=> config.serviceApiConfig.token === "new-key" ? {code:0,hostedMode:false,data:{email:"new@example.invalid",isVip:1,payType:"year",num:365,from:"2026-11-14"}} : {code:403,msg:"invalid key"})} }
  component = new ShareSetting({target:document.body,props:{pluginInstance:plugin,dialog:{destroy:vi.fn()} as any}})
}
const field = (id: string, value: string) => {const input=document.querySelector(id) as HTMLInputElement;input.value=value;input.dispatchEvent(new Event("input",{bubbles:true}))}
const save = () => (document.querySelector('.footer-actions .b3-button--primary') as HTMLButtonElement).click()
beforeEach(()=>{mocks.forwardProxy.mockReset().mockResolvedValue({status:200,headers:{"Access-Control-Allow-Origin":["*"],"Access-Control-Allow-Methods":["POST"],"Access-Control-Allow-Headers":["authorization,content-type"]}});mocks.sync.mockReset().mockResolvedValue({code:0});mocks.read.mockReset().mockResolvedValue({})})
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
  expect(document.body.textContent).toContain(locale.serviceAccess.selfHosted)
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
  path.value='article';path.dispatchEvent(new Event('change',{bubbles:true}))
  field('#share-service-api-key','new-key');await tick();save()
  await vi.waitFor(()=>expect(mocks.sync).toHaveBeenCalledOnce())
  expect(config.appConfig.domain).toBe(domain.value)
  expect(config.appConfig.docPath).toBe('article')
  expect(mocks.sync.mock.calls[0][1]).toMatchObject({domain:domain.value,docPath:'article'})
})

it("defaults the mode selector to hosted before the service address",async()=>{
  mount({},"hosted");await vi.waitFor(()=>expect(document.querySelector('[name="share-connection-mode"]')).not.toBeNull())
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
  mount({},"hosted");await vi.waitFor(()=>expect(document.querySelector('#share-service-api-url')).not.toBeNull())
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

it('masks a long Key as one line and reveals it only on request',async()=>{
  mount();await vi.waitFor(()=>expect(document.querySelector('#share-service-api-key')).not.toBeNull())
  expect(document.querySelector('#share-service-api-key').tagName).toBe('INPUT')
  expect(document.querySelector('#share-service-api-key').getAttribute('type')).toBe('password')
  const show=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===locale.serviceAccess.showKey) as HTMLButtonElement
  show.click();await tick();expect(document.querySelector('#share-service-api-key').getAttribute('type')).toBe('text')
  expect((document.querySelector('#share-service-api-key') as HTMLInputElement).value).toBe('old-key')
})
it('keeps hosted service fixed and offers only the official reading domain plus account domains',async()=>{
  mount({domain:'https://siyuan.wiki',domains:['https://account.example.test']},'hosted')
  await vi.waitFor(()=>expect(document.querySelector('#share-reading-domain')).not.toBeNull())
  const address=document.querySelector('#share-service-api-url') as HTMLInputElement
  expect(address.readOnly).toBe(true);expect(address.value).toBe('https://api.terwergreen.com')
  const domain=document.querySelector('#share-reading-domain') as HTMLSelectElement
  expect(domain.tagName).toBe('SELECT')
  const values=[...domain.options].map(o=>o.value)
  expect(values).toEqual(expect.arrayContaining(['https://siyuan.wiki','https://account.example.test']))
  expect(values).not.toContain('https://siyuannote.space')
})
it('keeps every path selectable and read-only',async()=>{
  mount({docPath:'doc'});await vi.waitFor(()=>expect(document.querySelector('#share-reading-path')).not.toBeNull())
  const select=document.querySelector('#share-reading-path') as HTMLSelectElement
  expect(select.tagName).toBe('SELECT')
  const values=[...select.options].map(o=>o.value)
  expect(values).toEqual(expect.arrayContaining(['s','x','p','a','static','post','link','doc','article']))
})
it('never offers the official reading domain in self-hosted mode',async()=>{
  mount({domain:'http://reader.test'},'self-hosted')
  await vi.waitFor(()=>expect(document.querySelector('#share-reading-domain')).not.toBeNull())
  const domain=document.querySelector('#share-reading-domain') as HTMLInputElement
  expect(domain.tagName).toBe('INPUT')
  expect(domain.value).toBe('http://reader.test')
  expect(document.querySelectorAll('.candidate-toggle')).toHaveLength(0)
  expect(document.querySelectorAll('.candidate-menu')).toHaveLength(0)
})

it('switches independent profiles without forwarding or discarding the other Key',async()=>{
  mount({domain:'http://reader.test',docPath:'doc'});await vi.waitFor(()=>expect(document.querySelector('#share-service-api-key')).not.toBeNull())
  ;(document.querySelector('[name="share-connection-mode"][value="hosted"]') as HTMLInputElement).click();await tick()
  expect((document.querySelector('#share-service-api-url') as HTMLInputElement).readOnly).toBe(true)
  expect((document.querySelector('#share-service-api-key') as HTMLInputElement).value).toBe('')
  ;(document.querySelector('[name="share-connection-mode"][value="self-hosted"]') as HTMLInputElement).click();await tick()
  expect((document.querySelector('#share-service-api-key') as HTMLInputElement).value).toBe('old-key')
  expect((document.querySelector('#share-reading-domain') as HTMLInputElement).value).toBe('http://reader.test')
  expect((document.querySelector('#share-reading-path') as HTMLInputElement).value).toBe('doc')
  expect(plugin.saveData).not.toHaveBeenCalled()
})

it('places account information directly below the connection form and checks beside the API field',async()=>{
  mount();await vi.waitFor(()=>expect(document.querySelector('.connection-settings-card')).not.toBeNull())
  const connection=document.querySelector('.connection-settings-card')
  const account=document.querySelector('.account-access-card')
  expect(account.parentElement).toBe(connection.parentElement)
  expect(account.previousElementSibling).toBe(connection)
  const api=document.querySelector('#share-service-api-url')
  expect(api.parentElement).toBe(document.querySelector('[data-action="verify-connection"]').parentElement)
})

it('uses a three-line wrapping hosted Key editor without exposing stored text while masked',async()=>{
  mount({domain:'https://siyuannote.site'},'hosted');await vi.waitFor(()=>expect(document.querySelector('#share-service-api-key')).not.toBeNull())
  let editor=document.querySelector('#share-service-api-key') as HTMLTextAreaElement
  expect(editor.tagName).toBe('TEXTAREA');expect(editor.rows).toBe(3);expect(editor.wrap).toBe('soft');expect(editor.readOnly).toBe(true)
  expect(editor.value).not.toContain('old-key')
  const value='synthetic-hosted-key-'.repeat(40)
  const paste=new Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(paste,'clipboardData',{value:{getData:()=>value}})
  editor.dispatchEvent(paste);await tick();expect(editor.value).not.toContain(value)
  ;([...document.querySelectorAll('button')].find(e=>e.textContent.trim()===locale.serviceAccess.showKey) as HTMLButtonElement).click();await tick()
  editor=document.querySelector('#share-service-api-key') as HTMLTextAreaElement
  expect(editor.readOnly).toBe(false);expect(editor.value).toBe(value);expect(editor.rows).toBe(3)
  ;([...document.querySelectorAll('button')].find(e=>e.textContent.trim()===locale.serviceAccess.hideKey) as HTMLButtonElement).click();await tick()
  expect((document.querySelector('#share-service-api-key') as HTMLTextAreaElement).value).not.toContain(value)
  expect(plugin.saveData).not.toHaveBeenCalled()
})

it('shows API success while reading is pending and ignores the old reading result after an edit',async()=>{
  let finishReading:(value:any)=>void
  mocks.forwardProxy.mockImplementation((_url,_headers,_body,method)=>method==='GET'?new Promise(resolve=>finishReading=resolve):Promise.resolve({status:200,headers:{'Access-Control-Allow-Origin':['*'],'Access-Control-Allow-Methods':['POST'],'Access-Control-Allow-Headers':['authorization,content-type']}}))
  mount({domain:'https://reader.test'});await vi.waitFor(()=>expect(document.querySelector('#share-service-api-key')).not.toBeNull())
  field('#share-service-api-key','new-key');await tick()
  ;(document.querySelector('[data-action="verify-connection"]') as HTMLButtonElement).click()
  await vi.waitFor(()=>expect(document.querySelector('[data-check="api"]').getAttribute('data-state')).toBe('success'))
  expect(document.querySelector('[data-check="reading"]').getAttribute('data-state')).toBe('pending')
  field('#share-reading-domain','https://new-reader.test');await tick();finishReading({status:200});await tick();await tick()
  expect(document.querySelector('[data-check="api"]').getAttribute('data-state')).toBe('success')
  expect(document.querySelector('[data-check="reading"]').getAttribute('data-state')).toBe('idle')
  expect(document.querySelector('[data-check="browser"]').getAttribute('data-state')).toBe('idle')
})

it('retains server-side homepage and hidden application settings when saving visible fields',async()=>{
  mocks.read.mockResolvedValue({homePageId:'remote-home',themeConfig:{logo:'https://reader.test/logo.png'}})
  mount({domain:'https://reader.test'});plugin.shareService.getVipInfo.mockResolvedValue({code:0,hostedMode:false,data:{email:'instance'}})
  await vi.waitFor(()=>expect(mocks.read).toHaveBeenCalled())
  await tick();field('#share-service-api-key','new-key');await tick();save()
  await vi.waitFor(()=>expect(mocks.sync).toHaveBeenCalled())
  expect(config.appConfig.homePageId).toBe('remote-home')
  expect(config.appConfig.themeConfig.logo).toBe('https://reader.test/logo.png')
})
it('a new hosted profile does not inherit the self-hosted homepage',async()=>{
  mount({homePageId:'self-home',domain:'https://self-reader.test'});await vi.waitFor(()=>expect(document.querySelector('#share-service-api-key')).not.toBeNull())
  ;(document.querySelector('[name="share-connection-mode"][value="hosted"]') as HTMLInputElement).click();await tick()
  ;([...document.querySelectorAll('button')].find(e=>e.textContent.trim()===locale.serviceAccess.showKey) as HTMLButtonElement).click();await tick()
  field('#share-service-api-key','new-key');await tick();save()
  await vi.waitFor(()=>expect(mocks.sync).toHaveBeenCalled())
  expect(config.appConfig.homePageId).toBe('')
  expect(config.connectionProfiles['self-hosted'].appConfig.homePageId).toBe('self-home')
})
it('editing a Key revokes only the API result and retains unchanged reading/browser checks',async()=>{
  mount({domain:'https://reader.test'});await vi.waitFor(()=>expect(document.querySelector('#share-service-api-key')).not.toBeNull())
  field('#share-service-api-key','new-key');await tick();(document.querySelector('[data-action="verify-connection"]') as HTMLButtonElement).click()
  await vi.waitFor(()=>expect(document.querySelector('[data-check="reading"]').getAttribute('data-state')).toBe('success'))
  field('#share-service-api-key','edited-key');await tick()
  expect(document.querySelector('[data-check="api"]').getAttribute('data-state')).toBe('idle')
  expect(document.querySelector('[data-check="reading"]').getAttribute('data-state')).toBe('success')
  expect(document.querySelector('[data-check="browser"]').getAttribute('data-state')).toBe('success')
})

it.each([
  {name:'unactivated',response:{code:403,errorCode:'AUTH_REQUIRED',hostedMode:true,data:null},text:locale.serviceErrors.AUTH_REQUIRED},
  {name:'trial',response:{code:0,hostedMode:true,data:{email:'trial@example.invalid',isVip:1,payType:'trial',num:30,from:'2026-11-14'}},text:locale.serviceAccess.trialPlan},
  {name:'paid',response:{code:0,hostedMode:true,data:{email:'paid@example.invalid',isVip:1,payType:'year',num:365,from:'2026-11-14'}},text:locale.cardType.year},
  {name:'lifetime',response:{code:0,hostedMode:true,data:{email:'lifetime@example.invalid',isVip:1,payType:'day',num:999,from:'2026-11-14'}},text:locale.keyInfo.lifetime},
  {name:'expired',response:{code:403,errorCode:'AUTH_EXPIRED',hostedMode:true,data:null},text:locale.serviceAccess.renew},
  {name:'unknown plan',response:{code:0,hostedMode:true,data:{email:'future@example.invalid',isVip:1,payType:'future-plan',num:45,from:'2026-11-14'}},text:'future-plan'},
])('keeps hosted $name account information and applicable purchase/renewal access',async({response,text})=>{
  mount({domain:'https://siyuannote.site'},'hosted');plugin.shareService.getVipInfo.mockResolvedValue(response)
  await vi.waitFor(()=>expect(document.body.textContent).toContain(text))
  expect(document.querySelector('a[href="https://store.terwer.space/products/share-pro"]')).not.toBeNull()
})

it('keeps hosted activation and trial access visible before verification',async()=>{
  mount();await vi.waitFor(()=>expect(document.querySelector('#share-service-api-key')).not.toBeNull())
  ;(document.querySelector('[name="share-connection-mode"][value="hosted"]') as HTMLInputElement).click();await tick()
  expect(document.querySelector('a[href="https://store.terwer.space/products/share-pro"]')).not.toBeNull()
  expect(document.body.textContent).toContain(locale.bs.regCodeTip)
  expect(plugin.saveData).not.toHaveBeenCalled()
})
