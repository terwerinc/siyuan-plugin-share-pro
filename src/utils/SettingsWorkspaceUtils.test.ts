/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2026 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import type { ShareProConfig } from "../models/ShareProConfig"

let createSettingsWorkspaceDraft: typeof import("./SettingsWorkspaceUtils").createSettingsWorkspaceDraft
let applySettingsWorkspaceDraft: typeof import("./SettingsWorkspaceUtils").applySettingsWorkspaceDraft
let persistSettingsWorkspace: typeof import("./SettingsWorkspaceUtils").persistSettingsWorkspace

beforeAll(async () => {
  vi.stubGlobal("window", {
    siyuan: {
      config: {
        lang: "zh_CN",
      },
    },
    location: {
      origin: "http://127.0.0.1:6806",
    },
  })

  const module = await import("./SettingsWorkspaceUtils")
  createSettingsWorkspaceDraft = module.createSettingsWorkspaceDraft
  applySettingsWorkspaceDraft = module.applySettingsWorkspaceDraft
  persistSettingsWorkspace = module.persistSettingsWorkspace
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe("SettingsWorkspaceUtils", () => {
  it("merges remote appConfig into draft while preserving local-only settings", () => {
    const draft = createSettingsWorkspaceDraft(
      {
        serviceApiConfig: {
          token: "local-token",
        },
        isNewUIEnabled: false,
        isCustomCssEnabled: false,
        siyuanConfig: {
          apiUrl: "http://127.0.0.1:6806",
          token: "",
          cookie: "",
          preferenceConfig: {
            fixTitle: true,
          },
        },
        appConfig: {
          domain: "https://local.example.com",
          docTreeEnabled: false,
        },
        inited: true,
      } as ShareProConfig,
      {
        domain: "https://remote.example.com",
        aiAssistantEnabled: false,
      }
    )

    expect(draft.serviceApiToken).toBe("local-token")
    expect(draft.newUIEnabled).toBe(false)
    expect(draft.customCssEnabled).toBe(false)
    expect(draft.fixTitle).toBe(true)
    expect(draft.domain).toBe("https://remote.example.com")
    expect(draft.docTreeEnabled).toBe(false)
    expect(draft.aiAssistantEnabled).toBe(false)
  })

  it("applies draft fields back to full config", () => {
    const finalConfig = applySettingsWorkspaceDraft(
      {
        serviceApiConfig: {
          apiUrl: "https://service.example.com",
          token: "",
        },
        siyuanConfig: {
          apiUrl: "http://127.0.0.1:6806",
          token: "",
          cookie: "",
          preferenceConfig: {
            fixTitle: false,
          },
        },
        appConfig: {},
        inited: true,
      } as ShareProConfig,
      {
        serviceApiToken: "new-token",
        newUIEnabled: true,
        customCssEnabled: true,
        fixTitle: true,
        theme: "daylight",
        domains: ["https://one.example.com"],
        domain: "https://one.example.com",
        docPaths: ["x", "article"],
        docPath: "article",
        siteTitle: "Demo",
        siteSlogan: "Slogan",
        siteDescription: "Desc",
        header: "<header />",
        footer: "<footer />",
        shareTemplate: "[url]",
        shareSubdocuments: true,
        shareReferences: true,
        aiAssistantEnabled: false,
        postMetaEnabled: false,
        docTreeEnabled: true,
        docTreeLevel: 4,
        outlineEnabled: true,
        outlineLevel: 5,
        passwordEnabled: true,
        showPassword: true,
        incrementalShareEnabled: false,
      },
      [{ name: "test", content: ".demo{}" }] as any
    )

    expect(finalConfig.serviceApiConfig.token).toBe("new-token")
    expect(finalConfig.isNewUIEnabled).toBe(true)
    expect(finalConfig.isCustomCssEnabled).toBe(true)
    expect(finalConfig.siyuanConfig.preferenceConfig.fixTitle).toBe(true)
    expect(finalConfig.appConfig.domain).toBe("https://one.example.com")
    expect((finalConfig.appConfig as any).docPaths).toEqual(["x", "article"])
    expect(finalConfig.appConfig.theme.lightTheme).toBe("daylight")
    expect(finalConfig.appConfig.theme.darkTheme).toBe("midlight")
    expect(finalConfig.appConfig.aiAssistantEnabled).toBe(false)
    expect(finalConfig.appConfig.postMetaEnabled).toBe(false)
    expect(finalConfig.appConfig.incrementalShareConfig.enabled).toBe(false)
    expect(finalConfig.appConfig.customCss).toEqual([{ name: "test", content: ".demo{}" }])
  })

  it("persists local config before remote sync", async () => {
    const calls: string[] = []

    const result = await persistSettingsWorkspace({
      finalConfig: {
        appConfig: {
          aiAssistantEnabled: true,
        },
      } as ShareProConfig,
      saveLocal: async () => {
        calls.push("local")
      },
      syncRemote: async () => {
        calls.push("remote")
      },
    })

    expect(calls).toEqual(["local", "remote"])
    expect(result.syncedRemote).toBe(true)
  })

  it("keeps local save semantics when remote sync fails", async () => {
    const saveLocal = vi.fn(async () => {})
    const syncRemote = vi.fn(async () => {
      throw new Error("sync failed")
    })

    const result = await persistSettingsWorkspace({
      finalConfig: {
        appConfig: {
          aiAssistantEnabled: true,
        },
      } as ShareProConfig,
      saveLocal,
      syncRemote,
    })

    expect(saveLocal).toHaveBeenCalledOnce()
    expect(syncRemote).toHaveBeenCalledOnce()
    expect(result.syncedRemote).toBe(false)
    expect(result.syncError).toBeInstanceOf(Error)
  })
})
