import { afterEach, expect, it, vi } from "vitest"
import { tick } from "svelte"
import Boundary from "./ServiceAccessBoundary.svelte"
import { SETTINGS_SAVED_EVENT } from "../../utils/ServiceAccessUtils"
import locale from "../../i18n/en_US.json"
let component: Boundary
const mount = (request: any) => {
  const plugin = { i18n: locale, openSetting: vi.fn(), safeLoad: vi.fn(async () => ({ serviceApiConfig: { apiUrl: "https://synthetic.example.com", token: "synthetic" } })), shareService: { getVipInfo: request } }
  component = new Boundary({ target: document.body, props: { pluginInstance: plugin as any } })
  return plugin
}
afterEach(() => { component?.$destroy(); document.body.innerHTML = "" })

it("shows clickable settings while license request is still pending", async () => {
  const p = mount(vi.fn(() => new Promise(() => {})))
  expect(document.querySelector('[data-action="open-share-settings"]')).not.toBeNull()
  ;(document.querySelector('[data-action="open-share-settings"]') as HTMLButtonElement).click()
  expect(p.openSetting).toHaveBeenCalledOnce()
  expect(document.querySelector('[role="status"]')).not.toBeNull()
})
it("keeps settings and a persistent error/retry action after network failure", async () => {
  mount(vi.fn(async () => { throw Error("offline") }))
  await vi.waitFor(() => expect(document.querySelector('[role="alert"]')).not.toBeNull())
  expect(document.body.textContent).toContain(locale.serviceAccess.help)
  expect(document.body.textContent).toContain(locale.serviceAccess.retry)
  expect(document.querySelector('[data-action="open-share-settings"]')).not.toBeNull()
})
it("refreshes an open panel after saved credentials recover access", async () => {
  const request = vi.fn().mockResolvedValueOnce({ code: 403, msg: "bad key" }).mockResolvedValue({code: 0, data: {email: "synthetic@example.invalid", isVip: 1}})
  mount(request)
  await vi.waitFor(() => expect(document.querySelector('[role="alert"]')).not.toBeNull())
  window.dispatchEvent(new CustomEvent(SETTINGS_SAVED_EVENT))
  await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2))
  await vi.waitFor(() => expect(document.querySelector('.service-access-body')?.getAttribute('aria-busy')).toBe("false"))
  expect(document.querySelector('[role="alert"]')).toBeNull()
  expect(request).toHaveBeenCalledTimes(2)
})
it("ignores late results from a previous configuration", async () => {
  let resolveOld: (value: any) => void
  const request = vi.fn().mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve })).mockResolvedValue({code:0, data:{email:"new@example.invalid"}})
  mount(request)
  await vi.waitFor(() => expect(request).toHaveBeenCalledOnce())
  window.dispatchEvent(new CustomEvent(SETTINGS_SAVED_EVENT))
  await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2))
  await tick()
  resolveOld({code:403,msg:"old key"})
  await tick(); await tick()
  expect(document.body.textContent).not.toContain("old key")
})

it("retries without bubbling into the host menu close handler, while outside clicks still bubble", async () => {
  const request=vi.fn().mockResolvedValue({code:403,msg:'invalid key'})
  mount(request)
  await vi.waitFor(()=>expect(document.querySelector('[role="alert"]')).not.toBeNull())
  const hostCloseHandler=vi.fn()
  document.addEventListener('click',hostCloseHandler)
  try {
    const retry=[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===locale.serviceAccess.retry) as HTMLButtonElement
    retry.click()
    expect(hostCloseHandler).not.toHaveBeenCalled()
    await vi.waitFor(()=>expect(request).toHaveBeenCalledTimes(2))
    await vi.waitFor(()=>expect(document.querySelector('[role="alert"]')).not.toBeNull())
    expect(document.querySelector('.service-access')?.isConnected).toBe(true)
    document.body.dispatchEvent(new MouseEvent('click',{bubbles:true}))
    expect(hostCloseHandler).toHaveBeenCalledOnce()
  } finally {
    document.removeEventListener('click',hostCloseHandler)
  }
})
