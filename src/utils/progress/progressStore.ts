import { writable } from "svelte/store"
import type { ProgressState } from "./ProgressState"

/**
 * 全局进度状态存储
 */
export const progressStore = writable<ProgressState | null>(null)

/**
 * 更新进度状态的辅助函数
 */
export function updateProgressState(newState: ProgressState | null) {
  progressStore.set(newState)
}
