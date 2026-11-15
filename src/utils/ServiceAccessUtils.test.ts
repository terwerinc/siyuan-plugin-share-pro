import { afterEach, describe, expect, it, vi } from "vitest"
import { loadServiceAccess, normalizeServiceApiUrl, withServiceTimeout } from "./ServiceAccessUtils"
import locale from "../i18n/en_US.json"

const plugin = (request = vi.fn(async () => ({ code: 0, data: { email: "synthetic@example.invalid", isVip: 1 } })), address = "https://service.example.com") => ({
  i18n: locale, safeLoad: vi.fn(async () => ({ serviceApiConfig: { apiUrl: address, token: "synthetic-key" } })),
  shareService: { getVipInfo: request },
}) as any

afterEach(() => vi.useRealTimers())
describe("service access", () => {
  it("normalizes HTTP(S) addresses with path prefixes", () => {
    expect(normalizeServiceApiUrl(" https://service.example.com/prefix/// ")).toBe("https://service.example.com/prefix")
    expect(normalizeServiceApiUrl("http://127.0.0.1:8086/")).toBe("http://127.0.0.1:8086")
  })
  it.each(["", "example.com", "file:///data", "javascript:alert(1)", "https://user:pass@example.com", "https://example.com?q=key", "https://example.com/#fragment"])("rejects invalid address %s", value => {
    expect(() => normalizeServiceApiUrl(value)).toThrow()
  })
  it("does not send a request for invalid configuration", async () => {
    const p = plugin(undefined, "wrong-address")
    expect((await loadServiceAccess(p)).msg).toBe(locale.serviceErrors.CLIENT_INVALID_SERVICE_ADDRESS)
    expect(p.shareService.getVipInfo).not.toHaveBeenCalled()
  })
  it("converts network exceptions to a recoverable inline status", async () => {
    expect((await loadServiceAccess(plugin(vi.fn(async () => { throw new TypeError("fetch failed") })))).code).toBe(-1)
  })
  it.each([401, 403, 500])("preserves failed license status %s without data", async code => {
    const result=await loadServiceAccess(plugin(vi.fn(async () => ({ code, msg: "rejected" }))))
    expect(result).toMatchObject({code,hostedMode:true,legacyMessage:"rejected"})
    expect(result.msg).toBe(locale.serviceErrors[result.errorCode])
    expect(result.msg).not.toBe("rejected")
  })
  it.each([undefined, { code: 0 }, { code: 0, data: {} }, { code: "0", data: {email: "x"} }])("rejects malformed success response %j", async response => {
    expect((await loadServiceAccess(plugin(vi.fn(async () => response)))).code).not.toBe(0)
  })
  it("loads current persisted key and abort signal", async () => {
    const p = plugin()
    expect((await loadServiceAccess(p)).data.isVip).toBe(1)
    expect(p.shareService.getVipInfo).toHaveBeenCalledWith("synthetic-key", expect.any(AbortSignal))
  })
  it("bounds stalled requests and aborts the underlying fetch", async () => {
    vi.useFakeTimers()
    let signal: AbortSignal
    const result = withServiceTimeout(s => { signal = s; return new Promise(() => {}) }, 100)
    const assertion = expect(result).rejects.toThrow("timed out")
    await vi.advanceTimersByTimeAsync(100)
    await assertion
    expect(signal.aborted).toBe(true)
  })
})
