# 统一进度管理方案 - 解决 showMessage 混乱和资源处理同步问题

## 背景和问题分析

当前系统存在两个核心问题：

### 1. showMessage 消息通知混乱问题
- **消息通知混乱**：批量分享时会显示多个 showMessage 通知条（黑条），造成界面混乱
- **进度显示位置不当**：进度信息显示在子文档树下方，容易被遮挡看不到
- **频繁通知干扰**：每个文档处理都会触发 showMessage，对于大量文档会造成频繁的视觉干扰

### 2. 资源处理与进度管理不同步问题（新发现）
- **进度提前结束**：文档分享完成后立即显示成功消息，但资源文件（媒体上传）仍在异步处理中
- **错误不反馈**：资源上传失败时（如 "[share-pro] [2026-03-21 00:11:17] [ERROR] [share-service] 第1组媒体上传失败=>Some assets failed to upload"），前台仍然显示成功，这是绝对错误的
- **用户体验不一致**：用户看到成功提示，但实际上部分资源可能上传失败

### 关键约束条件
- **资源文件必须异步处理**：必须使用 `void this.processAllMediaResources(...)` 调用，不能改为 await
- **进度条必须实时反馈**：不能阻塞主流程，要保持流畅的用户体验
- **资源没结束禁止关闭**：进度管理器必须等待资源处理完成后才能标记为完成
- **错误必须正确反馈**：资源上传失败时，前台不能显示成功

## 解决方案概述

采用**事件驱动的资源通知机制**，让异步的资源处理能够主动通知 ProgressManager 其状态变化，从而实现：
1. 保持资源处理的异步性（使用 void 调用）
2. 实时更新资源处理进度到进度条
3. 确保进度条在资源处理完成前保持打开状态
4. 正确聚合和反馈资源处理错误

### 核心设计原则

1. **事件驱动架构**：资源处理通过事件通知 ProgressManager，而非直接调用
2. **保持异步调用**：继续使用 `void this.processAllMediaResources(...)`，不阻塞主流程
3. **状态协调机制**：ProgressManager 协调文档和资源的完成状态
4. **智能完成判断**：只有当文档和资源都处理完成后才标记为最终完成
5. **最小化改动**：基于现有 ProgressManager 架构进行扩展
6. **付费级用户体验**：任何失败场景都必须让用户明确看到错误信息，禁止自动关闭导致用户错过关键错误。成功场景可以自动关闭以提供流畅体验，但失败场景必须持久显示直到用户手动关闭。

## 详细实施方案

### 1. 创建资源事件系统

**文件路径**: `src/utils/progress/ResourceEventEmitter.ts`

**功能**:
- 提供事件发射器用于资源处理状态通知
- 定义标准事件类型（开始、进度、错误、完成）

```typescript
import EventEmitter from 'eventemitter3'

export const resourceEventEmitter = new EventEmitter()

export const RESOURCE_EVENTS = {
  START: 'resource:start',
  PROGRESS: 'resource:progress',
  ERROR: 'resource:error',
  COMPLETE: 'resource:complete'
}
```

### 2. 扩展 ProgressState 接口

**文件路径**: `src/utils/progress/ProgressState.ts`

**新增字段**:
```typescript
export interface ProgressState {
  // ... 现有字段
  totalResources: number          // 总资源数
  completedResources: number      // 已完成资源数
  resourceErrors: Array<{         // 资源处理错误
    docId: string
    error: any
  }>
  isResourceProcessing: boolean   // 是否正在处理资源
  documentsCompleted: boolean     // 文档是否已完成
}
```

### 3. 增强 ProgressManager 类

**文件路径**: `src/utils/progress/ProgressManager.ts`

**关键增强**:
1. **监听资源事件**：在 startBatch 时注册资源事件监听器
2. **状态协调逻辑**：实现智能的完成判断机制
3. **资源进度更新**：处理资源进度和错误事件

```typescript
// 在 startBatch 方法中添加事件监听
static startBatch(operationName: string, count: number) {
  // ... 现有代码 ...

  // 注册资源事件监听器
  resourceEventEmitter.on(RESOURCE_EVENTS.START, handleResourceStart)
  resourceEventEmitter.on(RESOURCE_EVENTS.PROGRESS, handleResourceProgress)
  resourceEventEmitter.on(RESOURCE_EVENTS.ERROR, handleResourceError)
  resourceEventEmitter.on(RESOURCE_EVENTS.COMPLETE, handleResourceComplete)

  return id
}

// 智能完成判断
static checkAndCompleteBatch(id: string) {
  progressStore.update((currentState) => {
    if (!currentState || currentState.id !== id) return currentState

    // 只有当文档和资源都完成时才标记为最终完成
    if (currentState.documentsCompleted && !currentState.isResourceProcessing) {
      const hasErrors = currentState.errors.length > 0 || currentState.resourceErrors.length > 0
      const finalStatus = hasErrors ? "error" : "success"

      return {
        ...currentState,
        endTime: Date.now(),
        status: finalStatus
      }
    }
    return currentState
  })
}
```

### 4. 修改 processAllMediaResources 方法

**文件路径**: `src/service/ShareService.ts`

**关键修改**:
- 在资源处理过程中触发相应的事件
- 保持异步调用方式不变

```typescript
private async processAllMediaResources(docId: string, media: any[], dataViewMedia: any[]) {
  try {
    const totalResources = (media?.length || 0) + (dataViewMedia?.length || 0)

    // 触发资源开始事件
    if (totalResources > 0) {
      resourceEventEmitter.emit(RESOURCE_EVENTS.START, { docId, totalResources })
    }

    // 处理常规媒体资源
    if (media && media.length > 0) {
      await this.processShareMedia(docId, media, (completed, error) => {
        if (completed > 0) {
          resourceEventEmitter.emit(RESOURCE_EVENTS.PROGRESS, { docId, completed })
        }
        if (error) {
          resourceEventEmitter.emit(RESOURCE_EVENTS.ERROR, { docId, error })
        }
      })
    }

    // 处理DataViews媒体资源
    if (dataViewMedia && dataViewMedia.length > 0) {
      await this.processDataViewMedia(docId, dataViewMedia, (completed, error) => {
        if (completed > 0) {
          resourceEventEmitter.emit(RESOURCE_EVENTS.PROGRESS, { docId, completed })
        }
        if (error) {
          resourceEventEmitter.emit(RESOURCE_EVENTS.ERROR, { docId, error })
        }
      })
    }

    // 触发资源完成事件
    resourceEventEmitter.emit(RESOURCE_EVENTS.COMPLETE, { docId })

  } catch (error) {
    this.logger.error(`Resource processing failed for doc ${docId}:`, error)
    resourceEventEmitter.emit(RESOURCE_EVENTS.ERROR, { docId, error })
    resourceEventEmitter.emit(RESOURCE_EVENTS.COMPLETE, { docId })
  }
}
```

### 5. 更新 handleOne 和 batchProcessDocuments 方法

**文件路径**: `src/service/ShareService.ts`

**关键修改**:
1. **保持 void 调用**：`void this.processAllMediaResources(docId, data.media, data.dataViewMedia)`
2. **文档完成标记**：在 batchProcessDocuments 中标记文档完成状态
3. **触发智能完成检查**：文档完成后调用 checkAndCompleteBatch

```typescript
// 在 batchProcessDocuments 的文档处理完成后
completedCount++
ProgressManager.updateProgress(progressId, { /* ... */ })

// 标记文档完成
if (completedCount === total) {
  ProgressManager.markDocumentsCompleted(progressId)
}

// 在 handleOne 中保持异步调用
void this.processAllMediaResources(docId, data.media, data.dataViewMedia)
```

### 6. 单文档场景的特殊处理

对于单文档操作，由于没有 ProgressManager，需要全局监听资源事件：

**文件路径**: `src/service/ShareService.ts`

```typescript
// 在构造函数中注册全局资源事件监听
constructor(pluginInstance: ShareProPlugin) {
  // ... 现有代码 ...

  // 监听资源错误事件，用于单文档场景
  resourceEventEmitter.on(RESOURCE_EVENTS.ERROR, (event) => {
    this.handleResourceErrorForSingleDoc(event.docId, event.error)
  })
}

private handleResourceErrorForSingleDoc(docId: string, error: any) {
  // 查找对应的文档历史记录
  // 更新历史记录状态为失败
  // 显示资源处理错误消息
  const errorMessage = this.pluginInstance.i18n["shareService"]["msgResourceError"] + (error?.message || String(error));
  showMessage(errorMessage, 15000, "error") // 15秒显示时间，给用户足够时间查看
}
```

### 7. 更新 ProgressManager UI 组件

**文件路径**: `src/libs/components/ProgressManager.svelte`

**增强显示**:
- 显示资源处理进度（使用正确的国际化字符串替换）
- 显示综合的成功/失败状态
- 支持详细的错误信息展示
- **智能自动关闭策略**：成功时自动关闭，失败时持久显示

```svelte
<!-- Resource progress display with proper i18n replacement -->
{#if currentBatch.totalResources > 0}
  <div class="resource-progress">
    <div class="resource-info">
      <span class="resource-info-text">
        {pluginInstance.i18n["progressManager"]["resourcesProcessed"]
          .replace("[param1]", currentBatch.completedResources.toString())
          .replace("[param2]", currentBatch.totalResources.toString())}
      </span>
    </div>
    <!-- resource progress bar -->
  </div>
{/if}

<!-- Error details display -->
{#if currentBatch && (currentBatch.errors.length > 0 || currentBatch.resourceErrors.length > 0)}
  <div class="error-details">
    <div class="error-header">
      {pluginInstance.i18n["progressManager"]["errorsDetected"]}
    </div>
    <!-- document and resource errors -->
  </div>
{/if}
```

### 8. 智能自动关闭策略

**核心逻辑**:
- **成功场景**：只有当状态为 "success" 且没有文档错误、资源错误时才自动关闭（5秒后）
- **失败场景**：任何错误（文档错误、资源错误、状态为 "error"）都会禁用自动关闭，界面持久显示
- **手动关闭**：右上角的 X 按钮作为手动关闭入口，失败场景下用户必须主动点击 X 才能关闭

## 关键文件修改清单

1. **新增文件**:
   - `src/utils/progress/ResourceEventEmitter.ts` - 资源事件系统（使用 eventemitter3）

2. **修改文件**:
   - `src/utils/progress/ProgressState.ts` - 扩展进度状态接口
   - `src/utils/progress/ProgressManager.ts` - 增强事件监听和状态协调
   - `src/service/ShareService.ts` - 集成资源事件触发和单文档错误处理
   - `src/libs/components/ProgressManager.svelte` - 更新UI显示资源进度和错误详情

3. **新增国际化文本**:
```json
{
  "progressManager": {
    "processingResources": "正在处理资源...",
    "resourcesProcessed": "资源: [param1]/[param2]",
    "resourceError": "资源处理失败",
    "waitingForResourceCompletion": "等待资源处理完成...",
    "errorsDetected": "检测到错误：",
    "documentErrors": "文档错误",
    "resourceErrors": "资源错误",
    "autoCloseIn": "[param1]秒后自动关闭"
  },
  "shareService": {
    "msgResourceError": "资源处理失败："
  }
}
```

## 测试验证方案

### 集成测试场景
1. **正常资源处理流程**：
   - 分享包含图片的文档
   - 验证进度条正确显示文档和资源进度
   - 验证进度条在资源处理完成后自动关闭（成功场景）

2. **资源处理失败场景**：
   - 模拟资源上传失败
   - 验证进度条显示错误状态且**不会自动关闭**
   - 验证错误详情正确显示（资源: 2/5 这样的具体数字）
   - 验证用户必须手动关闭（通过右上角X按钮）

3. **文档处理失败场景**：
   - 模拟文档分享失败
   - 验证进度条显示错误状态且**不会自动关闭**
   - 验证错误详情正确显示

4. **单文档资源失败**：
   - 分享单个包含图片的文档，模拟资源失败
   - 验证 showMessage 显示资源失败错误且**持续显示15秒**
   - 确保用户有足够时间查看错误信息

5. **混合失败场景**：
   - 部分文档成功，部分文档失败
   - 部分资源成功，部分资源失败
   - 验证进度条显示错误状态且**不会自动关闭**
   - 验证所有错误类型都正确显示

6. **性能测试**：
   - 大批量文档包含大量资源
   - 验证异步处理不阻塞主流程
   - 验证事件系统性能良好

### 回归测试
- 确保现有文档分享功能不受影响
- 验证无资源文档的分享仍然正常工作
- 确认取消分享功能仍然正常
- 验证增量分享功能的资源处理也得到修复

## 实施优先级

1. **第一阶段**：创建 ResourceEventEmitter 和扩展 ProgressState
2. **第二阶段**：增强 ProgressManager 以支持事件监听和状态协调
3. **第三阶段**：修改 ShareService 集成资源事件触发
4. **第四阶段**：实现单文档场景的资源错误处理
5. **第五阶段**：更新UI和国际化支持（包括正确的字符串替换）
6. **第六阶段**：全面测试和验证

## 技术栈调整说明

由于在 Electron 渲染进程中，Node.js 的 `events` 模块无法被 Vite 正确解析，我们已将事件发射器从 `import { EventEmitter } from 'events'` 改为使用 `eventemitter3` 库：
- **安装命令**: `pnpm install eventemitter3`
- **导入方式**: `import EventEmitter from 'eventemitter3'`
- **优势**: 高性能、轻量级、浏览器兼容、API 与 Node.js EventEmitter 高度兼容

## 这个方案完全满足所有约束条件：
- ✅ 资源文件保持异步处理（使用 void 调用）
- ✅ 进度条实时反馈资源处理进度
- ✅ 资源没结束禁止关闭进度条
- ✅ 资源失败时正确反馈错误，不显示成功
- ✅ **智能自动关闭策略**：成功时自动关闭提供流畅体验，失败时持久显示确保用户不会错过错误信息
- ✅ **正确的国际化字符串替换**：资源进度显示为 "资源: 2/5" 而不是 "资源: [param1]/[param2]"
- ✅ **详细的错误展示**：同时显示文档错误和资源错误，帮助用户快速定位问题
- ✅ **付费级用户体验**：从付费用户角度深度优化，确保任何失败都能被用户明确感知和处理