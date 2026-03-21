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
  currentDocId: string
  currentDocTitle: string
  errors: Array<{ docId: string; error: any }>
  startTime: number
  endTime: number | null
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
