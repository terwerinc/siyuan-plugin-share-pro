import { showMessage } from "siyuan"
import { ILogger, simpleLogger } from "zhi-lib-base"
import { isDev } from "../../Constants"

/**
 * 操作类型枚举
 */
export type OperationType =
  | "single" // 单个文档分享
  | "batch" // 批量文档分享
  | "incremental" // 增量分享
  | "resource" // 资源处理（图片、附件等）
  | "dataView" // 数据库媒体处理

/**
 * 操作上下文管理器 - 用于统一管理分享操作的上下文和消息显示
 *
 * 解决以下问题：
 * 1. 单个文档分享 vs 批量操作的消息策略不同
 * 2. 文档处理 vs 资源处理的消息分离
 * 3. 避免重复和混乱的消息提示
 */
export class OperationContext {
  private logger: ILogger
  private static currentContext: OperationContext | null = null

  private operationId: string
  private operationType: OperationType
  private totalItems: number
  private completedItems: number = 0
  private hasErrors: boolean = false
  private hasWarnings: boolean = false
  private startTime: number
  private pluginInstance: any

  constructor(pluginInstance: any, operationType: OperationType, totalItems: number = 1, operationId?: string) {
    this.pluginInstance = pluginInstance
    this.operationType = operationType
    this.totalItems = totalItems
    this.operationId = operationId || `op_${Date.now()}`
    this.startTime = Date.now()
    this.logger = simpleLogger("operation-context", "share-pro", isDev)

    // 设置为当前上下文
    OperationContext.currentContext = this
    this.logger.debug(`Started operation context: ${this.operationId}`, {
      type: operationType,
      total: totalItems,
    })
  }

  /**
   * 开始操作 - 显示开始消息（仅批量操作）
   */
  public start(): void {
    if (this.isBatchOperation()) {
      const message = this.getI18nMessage("msgBatchStart", [this.totalItems.toString()])
      showMessage(message, 3000, "info")
    }
  }

  /**
   * 更新进度 - 记录完成项数
   */
  public updateProgress(completed: number): void {
    this.completedItems = completed
  }

  /**
   * 记录成功 - 只在批量操作完成时显示消息
   */
  public recordSuccess(): void {
    if (this.isSingleOperation()) {
      // 单个操作立即显示成功消息
      const message = this.getI18nMessage("msgShareSuccess")
      showMessage(message, 3000, "info")
    } else if (this.isCompleted()) {
      // 批量操作完成时显示汇总消息
      this.showCompletionMessage()
    }
  }

  /**
   * 记录错误 - 立即显示错误消息
   */
  public recordError(error: string | Error): void {
    this.hasErrors = true

    // 错误消息总是立即显示
    let errorMessage = error instanceof Error ? error.message : error
    if (this.isBatchOperation()) {
      errorMessage = this.getI18nMessage("msgBatchPartialSuccess", [
        this.completedItems.toString(),
        this.totalItems.toString(),
        (this.totalItems - this.completedItems).toString(),
      ])
    }

    showMessage(errorMessage, 7000, "error")
  }

  /**
   * 记录警告 - 在操作完成时显示
   */
  public recordWarning(warning: string): void {
    this.hasWarnings = true
    // 警告消息暂不立即显示，等到操作完成时再决定
  }

  /**
   * 完成操作 - 清理上下文
   */
  public complete(): void {
    if (!this.hasErrors && !this.hasWarnings && this.isBatchOperation() && this.isCompleted()) {
      // 批量操作完全成功
      const message = this.getI18nMessage("msgBatchSuccess", [this.totalItems.toString()])
      showMessage(message, 5000, "info")
    }

    // 清理上下文
    OperationContext.currentContext = null
    this.logger.debug(`Completed operation context: ${this.operationId}`)
  }

  /**
   * 获取当前上下文（如果存在）
   */
  public static getCurrentContext(): OperationContext | null {
    return OperationContext.currentContext
  }

  /**
   * 检查是否为单个操作
   */
  private isSingleOperation(): boolean {
    return (
      this.totalItems === 1 &&
      (this.operationType === "single" || this.operationType === "resource" || this.operationType === "dataView")
    )
  }

  /**
   * 检查是否为批量操作
   */
  private isBatchOperation(): boolean {
    return this.totalItems > 1 || this.operationType === "batch" || this.operationType === "incremental"
  }

  /**
   * 检查是否已完成
   */
  private isCompleted(): boolean {
    return this.completedItems >= this.totalItems
  }

  /**
   * 显示完成消息
   */
  private showCompletionMessage(): void {
    if (this.hasErrors) {
      const message = this.getI18nMessage("msgBatchPartialSuccess", [
        this.completedItems.toString(),
        this.totalItems.toString(),
        (this.totalItems - this.completedItems).toString(),
      ])
      showMessage(message, 7000, "error")
    } else if (this.hasWarnings) {
      const message = this.getI18nMessage("msgBatchSuccess", [this.totalItems.toString()])
      showMessage(message, 5000, "info")
    } else {
      const message = this.getI18nMessage("msgBatchSuccess", [this.totalItems.toString()])
      showMessage(message, 5000, "info")
    }
  }

  /**
   * 获取国际化消息
   */
  private getI18nMessage(key: string, params: string[] = []): string {
    let message = this.pluginInstance.i18n?.shareService?.[key] || key
    params.forEach((param, index) => {
      message = message.replace(`[param${index + 1}]`, param)
    })
    return message
  }
}
