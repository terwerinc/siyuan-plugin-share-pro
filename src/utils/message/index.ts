import { OperationContext, OperationType } from "./OperationContext"

/**
 * 创建操作上下文的便捷函数
 */
export const createOperationContext = (
  pluginInstance: any,
  operationType: OperationType,
  totalItems: number = 1,
  operationId?: string
): OperationContext => {
  return new OperationContext(pluginInstance, operationType, totalItems, operationId)
}

/**
 * 获取当前操作上下文
 */
export const getCurrentOperationContext = (): OperationContext | null => {
  return OperationContext.getCurrentContext()
}
