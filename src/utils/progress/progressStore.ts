import { writable } from "svelte/store"
import type { ProgressState } from "./ProgressState"

// 重新导出 ProgressState 类型，方便使用者从统一入口导入
export type { ProgressState } from "./ProgressState"

/**
 * 全局进度状态存储
 * 
 * 关键设计：错误信息直接存储在 ProgressState 中
 * - 每个文档的 ShareUI 组件实例是独立的
 * - 错误信息随组件销毁自动清理
 * - 天然实现文档级别的错误隔离
 */
export const progressStore = writable<ProgressState | null>(null)

/**
 * 更新进度状态的辅助函数
 */
export function updateProgressState(newState: ProgressState | null) {
  progressStore.set(newState)
}
