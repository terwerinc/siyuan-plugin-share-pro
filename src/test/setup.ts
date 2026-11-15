import { vi } from "vitest"
Object.defineProperty(window, "siyuan", { configurable: true, writable: true, value: { config: { lang: "en_US" } } })
HTMLElement.prototype.scrollTo = vi.fn()
