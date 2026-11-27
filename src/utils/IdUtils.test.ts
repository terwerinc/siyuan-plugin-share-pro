/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2026
 *
 *  Copyright (C) 2026 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import { describe, expect, it } from "vitest"
import { createUniqueDomId } from "./IdUtils"

describe("IdUtils", () => {
  it("creates unique DOM ids without requiring crypto.randomUUID", () => {
    const originalCrypto = globalThis.crypto
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {},
    })

    try {
      const first = createUniqueDomId("share-pro-setting")
      const second = createUniqueDomId("share-pro-setting")

      expect(first).toMatch(/^share-pro-setting-[a-z0-9-]+$/)
      expect(second).toMatch(/^share-pro-setting-[a-z0-9-]+$/)
      expect(first).not.toBe(second)
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: originalCrypto,
      })
    }
  })
})
