/**
 * 全局进度状态管理
 */
export interface ProgressState {
  id: string
  operationName: string
  total: number
  completed: number
  percentage: number
  status: "idle" | "processing" | "success" | "error" | "canceled"
  // 发起操作的文档ID - 用于文档级别的错误隔离
  // 这是用户点击"分享"按钮的文档ID，而不是当前正在处理的文档ID
  initiatorDocId: string
  // 当前正在处理的文档ID - 会随着处理进度变化
  currentDocId: string
  currentDocTitle: string
  errors: Array<{ docId: string; error: any }>
  startTime: number
  endTime: number | null
  // 跳过的文档数（增量检测未变更）
  skippedCount: number
  // Resource processing fields
  totalResources: number // 总资源数
  completedResources: number // 已完成资源数
  resourceErrors: Array<{
    // 资源处理错误
    docId: string
    error: any
  }>
  isResourceProcessing: boolean // 是否正在处理资源
  documentsCompleted: boolean // 文档是否已完成
}
