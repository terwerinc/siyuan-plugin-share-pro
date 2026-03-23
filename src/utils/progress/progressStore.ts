import { writable } from "svelte/store"
import type { ProgressState } from "./ProgressState"

/**
 * 全局进度状态存储
 */
export const progressStore = writable<ProgressState | null>(null)

/**
 * 错误状态存储 - 用于在进度弹窗关闭后保留错误信息
 * 大厂设计：错误信息需要持久化，方便用户随时查看
 */
export interface ErrorState {
  hasError: boolean
  errors: Array<{ docId: string; error: any }>
  resourceErrors: Array<{ docId: string; error: any }>
  timestamp: number
  operationName: string
}

export const errorStore = writable<ErrorState>({
  hasError: false,
  errors: [],
  resourceErrors: [],
  timestamp: 0,
  operationName: "",
})

/**
 * 更新进度状态的辅助函数
 */
export function updateProgressState(newState: ProgressState | null) {
  progressStore.set(newState)
}
