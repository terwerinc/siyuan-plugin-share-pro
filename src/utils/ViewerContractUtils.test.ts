/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2026 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import { describe, expect, it } from "vitest"
import {
  applyViewerPostContract,
  normalizeAppConfigForViewerContract,
  normalizeShareProConfigForViewerContract,
} from "./ViewerContractUtils"

describe("ViewerContractUtils", () => {
  it("defaults missing app config toggles to true", () => {
    const normalized = normalizeAppConfigForViewerContract({})

    expect(normalized.aiAssistantEnabled).toBe(true)
    expect(normalized.postMetaEnabled).toBe(true)
  })

  it("preserves explicit false values", () => {
    const normalized = normalizeAppConfigForViewerContract({
      aiAssistantEnabled: false,
      postMetaEnabled: false,
    })

    expect(normalized.aiAssistantEnabled).toBe(false)
    expect(normalized.postMetaEnabled).toBe(false)
  })

  it("normalizes share-pro config for legacy data", () => {
    const normalized = normalizeShareProConfigForViewerContract({
      inited: true,
    } as any)

    expect(normalized.appConfig.aiAssistantEnabled).toBe(true)
    expect(normalized.appConfig.postMetaEnabled).toBe(true)
  })

  it("freezes global ai assistant value onto new share payloads", () => {
    const publishedPost = applyViewerPostContract(
      {
        title: "demo",
      },
      undefined,
      undefined,
      {
        aiAssistantEnabled: false,
      }
    )

    expect(Object.prototype.hasOwnProperty.call(publishedPost, "aiAssistantEnabled")).toBe(true)
    expect(publishedPost.aiAssistantEnabled).toBe(false)
  })

  it("prefers document-level ai override when available", () => {
    const publishedPost = applyViewerPostContract(
      {
        title: "demo",
      },
      {
        aiAssistantEnabled: false,
      },
      {
        aiAssistantEnabled: true,
      },
      {
        aiAssistantEnabled: true,
      }
    )

    expect(publishedPost.aiAssistantEnabled).toBe(false)
  })
})
