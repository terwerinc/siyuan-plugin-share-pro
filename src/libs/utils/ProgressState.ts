/**
 * 全局进度状态管理
 */
export interface ProgressState {
  id: string
  operationName: string
  total: number
  completed: number
  percentage: number
  status: 'idle' | 'processing' | 'success' | 'error' | 'canceled'
  currentDocId: string
  currentDocTitle: string
  errors: Array<{ docId: string; error: any }>
  startTime: number
  endTime: number | null
}