/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

/**
 * 文档变更检测 Web Worker
 * 在独立线程中执行变更检测，避免阻塞主线程
 */

// 使用插件专属的消息类型前缀，避免与其他插件冲突
const MSG_PREFIX = "share-pro:change-detection:"

interface DetectionRequest {
  type: "share-pro:change-detection:detect"
  allDocuments: Array<{
    docId: string
    docTitle: string
    modifiedTime: number
  }>
  shareHistory: Array<{
    docId: string
    shareTime: number
    docModifiedTime: number
  }>
  blacklistedDocIds: string[]
}

interface DetectionResponse {
  type: "share-pro:change-detection:result"
  result: {
    newDocuments: any[]
    updatedDocuments: any[]
    unchangedDocuments: any[]
    blacklistedCount: number
  }
}

interface DetectionError {
  type: "share-pro:change-detection:error"
  error: string
}

// Worker 消息处理
self.addEventListener("message", (event: MessageEvent<DetectionRequest>) => {
  const { type, allDocuments, shareHistory, blacklistedDocIds } = event.data

  // 只处理本插件的消息
  if (type === `${MSG_PREFIX}detect`) {
    try {
      const result = detectChanges(allDocuments, shareHistory, blacklistedDocIds)

      const response: DetectionResponse = {
        type: `${MSG_PREFIX}result`,
        result,
      }

      self.postMessage(response)
    } catch (error: any) {
      const errorResponse: DetectionError = {
        type: `${MSG_PREFIX}error`,
        error: error?.message || String(error),
      }

      self.postMessage(errorResponse)
    }
  }
})

/**
 * 执行变更检测
 */
function detectChanges(
  allDocuments: Array<{
    docId: string
    docTitle: string
    modifiedTime: number
  }>,
  shareHistory: Array<{
    docId: string
    shareTime: number
    docModifiedTime: number
  }>,
  blacklistedDocIds: string[]
): {
  newDocuments: any[]
  updatedDocuments: any[]
  unchangedDocuments: any[]
  blacklistedCount: number
} {
  const result = {
    newDocuments: [] as any[],
    updatedDocuments: [] as any[],
    unchangedDocuments: [] as any[],
    blacklistedCount: 0,
  }

  // 创建黑名单集合以提高查询效率（O(1)）
  const blacklistedSet = new Set(blacklistedDocIds)

  // 创建分享历史映射
  const historyMap = new Map<string, any>()
  for (const item of shareHistory) {
    historyMap.set(item.docId, item)
  }

  // 遍历所有文档进行分类
  for (const doc of allDocuments) {
    // 黑名单过滤
    if (blacklistedSet.has(doc.docId)) {
      result.blacklistedCount++
      continue
    }

    const history = historyMap.get(doc.docId)

    if (!history) {
      // 新增文档
      result.newDocuments.push({
        docId: doc.docId,
        docTitle: doc.docTitle,
        shareTime: 0,
        shareStatus: "pending",
        docModifiedTime: doc.modifiedTime,
      })
    } else if (doc.modifiedTime > history.docModifiedTime) {
      // 已更新文档
      result.updatedDocuments.push({
        ...history,
        docTitle: doc.docTitle,
        shareStatus: "pending",
        docModifiedTime: doc.modifiedTime,
      })
    } else {
      // 未变更文档
      result.unchangedDocuments.push(history)
    }
  }

  return result
}

export {}
