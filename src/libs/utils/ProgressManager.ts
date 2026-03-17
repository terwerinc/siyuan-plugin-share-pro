import { updateProgressState, ProgressState } from "./ProgressState"
import { progressStore } from "./progressStore"

/**
 * ProgressManager utility class for managing batch operation progress
 */
export class ProgressManager {
  /**
   * Start a new batch operation
   */
  static startBatch(operationName: string, count: number) {
    const id = `progress_${Date.now()}`
    const newState: ProgressState = {
      id,
      operationName,
      total: count,
      completed: 0,
      percentage: 0,
      status: "processing",
      currentDocId: "",
      currentDocTitle: "",
      errors: [],
      startTime: Date.now(),
      endTime: null,
    }
    progressStore.set(newState)
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
    progressStore.update(currentState => {
      if (!currentState || currentState.id !== id) return currentState

      return {
        ...currentState,
        completed: data.completed,
        currentDocId: data.currentDocId,
        currentDocTitle: data.currentDocTitle,
        percentage: Math.round((data.completed / currentState.total) * 100)
      }
    })
  }

  /**
   * Add an error to the batch operation
   */
  static addError(id: string, docId: string, error: any) {
    progressStore.update(currentState => {
      if (!currentState || currentState.id !== id) return currentState

      return {
        ...currentState,
        errors: [...currentState.errors, { docId, error }]
      }
    })
  }

  /**
   * Complete a batch operation
   */
  static completeBatch(id: string, success: boolean, error: any = null) {
    progressStore.update(currentState => {
      if (!currentState || currentState.id !== id) return currentState

      return {
        ...currentState,
        endTime: Date.now(),
        status: success ? 'success' : error ? 'error' : 'canceled'
      }
    })
  }

  /**
   * Cancel a batch operation
   */
  static cancelBatch(id: string) {
    progressStore.update(currentState => {
      if (!currentState || currentState.id !== id) return currentState

      return {
        ...currentState,
        endTime: Date.now(),
        status: 'canceled'
      }
    })
  }

  /**
   * Clear the current batch
   */
  static clearBatch() {
    progressStore.set(null)
  }
}