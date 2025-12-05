/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

import type { DocDTO } from "../types/service-dto"
import type { ShareHistoryItem } from "../types/share-history"

/**
 * 将服务端 DocDTO 转换为客户端 ShareHistoryItem
 */
export function docDTOToHistoryItem(doc: DocDTO): ShareHistoryItem {
  // 解析时间戳
  const createdTime = new Date(doc.createdAt).getTime()
  const updatedTime = new Date(doc.data.dateUpdated).getTime()

  return {
    docId: doc.docId,
    docTitle: doc.data.title,
    shareTime: updatedTime || createdTime,
    shareStatus:
      doc.status === "COMPLETED"
        ? "success"
        : doc.status === "FAILED"
        ? "failed"
        : "pending",
    shareUrl: undefined, // 服务端返回数据中没有 shareUrl，需要单独获取
    errorMessage: undefined, // 服务端返回数据中没有 errorMessage
    docModifiedTime: updatedTime, // 使用 dateUpdated 作为文档修改时间
  }
}
