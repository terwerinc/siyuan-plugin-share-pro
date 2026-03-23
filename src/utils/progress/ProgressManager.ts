import { ProgressState } from "./ProgressState"
import { progressStore } from "./progressStore"
import { RESOURCE_EVENTS, resourceEventEmitter } from "./ResourceEventEmitter"

/**
 * ProgressManager utility class for managing batch operation progress
 */
export class ProgressManager {
  /**
   * Start a new batch operation
   * @param operationName 操作名称
   * @param count 总数
   * @param initiatorDocId 发起操作的文档ID - 用于文档级别的错误隔离
   */
  static startBatch(operationName: string, count: number, initiatorDocId: string = "") {
    const id = `progress_${Date.now()}`
    const newState: ProgressState = {
      id,
      operationName,
      total: count,
      completed: 0,
      percentage: 0,
      status: "processing",
      initiatorDocId, // 发起操作的文档ID
      currentDocId: "",
      currentDocTitle: "",
      errors: [],
      startTime: Date.now(),
      endTime: null,
      // Resource processing fields
      totalResources: 0,
      completedResources: 0,
      resourceErrors: [],
      isResourceProcessing: false,
      documentsCompleted: false,
    }
    progressStore.set(newState)

    // Register resource event listeners
    const handleResourceStart = (event: { docId: string; totalResources: number }) => {
      progressStore.update((currentState) => {
        if (!currentState || currentState.id !== id) return currentState
        return {
          ...currentState,
          isResourceProcessing: true,
          totalResources: currentState.totalResources + event.totalResources,
        }
      })
    }

    const handleResourceProgress = (event: { docId: string; completed: number }) => {
      progressStore.update((currentState) => {
        if (!currentState || currentState.id !== id) return currentState
        return {
          ...currentState,
          completedResources: currentState.completedResources + event.completed,
        }
      })
    }

    const handleResourceError = (event: { docId: string; error: any }) => {
      progressStore.update((currentState) => {
        if (!currentState || currentState.id !== id) return currentState
        // 关键修复：发生资源错误时立即更新状态为 error，确保标题正确显示
        return {
          ...currentState,
          resourceErrors: [...currentState.resourceErrors, { docId: event.docId, error: event.error }],
          status: "error",
        }
      })
    }

    const handleResourceComplete = (event: { docId: string }) => {
      progressStore.update((currentState) => {
        if (!currentState || currentState.id !== id) return currentState

        // Check if all resources are processed
        const allResourcesProcessed = currentState.completedResources >= currentState.totalResources

        if (allResourcesProcessed) {
          return {
            ...currentState,
            isResourceProcessing: false,
          }
        }
        return currentState
      })

      // After handling resource completion, check if we can complete the batch
      this.checkAndCompleteBatch(id)
    }

    // Store event handlers to be able to remove them later
    ;(progressStore as any).eventHandlers = {
      handleResourceStart,
      handleResourceProgress,
      handleResourceError,
      handleResourceComplete,
    }

    // Register resource event listeners
    resourceEventEmitter.on(RESOURCE_EVENTS.START, handleResourceStart)
    resourceEventEmitter.on(RESOURCE_EVENTS.PROGRESS, handleResourceProgress)
    resourceEventEmitter.on(RESOURCE_EVENTS.ERROR, handleResourceError)
    resourceEventEmitter.on(RESOURCE_EVENTS.COMPLETE, handleResourceComplete)

    return id
  }

  /**
   * Update progress for a batch operation
   */
  static updateProgress(
    id: string,
    data: {
      completed: number
      currentDocId: string
      currentDocTitle: string
    }
  ) {
    progressStore.update((currentState) => {
      if (!currentState || currentState.id !== id) return currentState

      return {
        ...currentState,
        completed: data.completed,
        currentDocId: data.currentDocId,
        currentDocTitle: data.currentDocTitle,
        percentage: Math.round((data.completed / currentState.total) * 100),
      }
    })
  }

  /**
   * Add an error to the batch operation
   */
  static addError(id: string, docId: string, error: any) {
    progressStore.update((currentState) => {
      if (!currentState || currentState.id !== id) return currentState

      // 关键修复：添加文档错误时立即更新状态为 error，确保标题正确显示
      return {
        ...currentState,
        errors: [...currentState.errors, { docId, error }],
        status: "error",
      }
    })
  }

  /**
   * Complete a batch operation
   */
  static completeBatch(id: string, success: boolean, error: any = null) {
    progressStore.update((currentState) => {
      if (!currentState || currentState.id !== id) return currentState

      return {
        ...currentState,
        endTime: Date.now(),
        status: success ? "success" : error ? "error" : "canceled",
      }
    })
    this.cleanupEventListeners()
  }

  /**
   * Cancel a batch operation
   */
  static cancelBatch(id: string) {
    progressStore.update((currentState) => {
      if (!currentState || currentState.id !== id) return currentState

      return {
        ...currentState,
        endTime: Date.now(),
        status: "canceled",
      }
    })
    this.cleanupEventListeners()
  }

  /**
   * Clear the current batch
   */
  static clearBatch() {
    progressStore.set(null)
  }

  /**
   * Mark documents as completed for a batch operation
   */
  static markDocumentsCompleted(id: string) {
    progressStore.update((currentState) => {
      if (!currentState || currentState.id !== id) return currentState

      // 如果文档已完成且没有资源在处理中，直接标记为完成
      const shouldComplete = !currentState.isResourceProcessing && currentState.totalResources === 0

      if (shouldComplete) {
        const hasErrors = currentState.errors.length > 0 || currentState.resourceErrors.length > 0
        return {
          ...currentState,
          documentsCompleted: true,
          endTime: Date.now(),
          status: hasErrors ? "error" : "success",
        }
      }

      return {
        ...currentState,
        documentsCompleted: true,
      }
    })
  }

  /**
   * Smart completion check that considers both documents and resources
   */
  static checkAndCompleteBatch(id: string) {
    progressStore.update((currentState) => {
      if (!currentState || currentState.id !== id) return currentState

      // Only complete when documents are done AND resources are not processing
      if (currentState.documentsCompleted && !currentState.isResourceProcessing) {
        const hasErrors = currentState.errors.length > 0 || currentState.resourceErrors.length > 0
        const finalStatus = hasErrors ? "error" : "success"

        return {
          ...currentState,
          endTime: Date.now(),
          status: finalStatus,
        }
      }
      return currentState
    })
  }

  /**
   * Clean up event listeners when batch is completed or canceled
   */
  static cleanupEventListeners() {
    const handlers = (progressStore as any).eventHandlers
    if (handlers) {
      resourceEventEmitter.removeListener(RESOURCE_EVENTS.START, handlers.handleResourceStart)
      resourceEventEmitter.removeListener(RESOURCE_EVENTS.PROGRESS, handlers.handleResourceProgress)
      resourceEventEmitter.removeListener(RESOURCE_EVENTS.ERROR, handlers.handleResourceError)
      resourceEventEmitter.removeListener(RESOURCE_EVENTS.COMPLETE, handlers.handleResourceComplete)
      delete (progressStore as any).eventHandlers
    }
  }
}
