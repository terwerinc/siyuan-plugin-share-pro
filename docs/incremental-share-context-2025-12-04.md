# 增量分享功能开发上下文

> **生成时间**: 2025-12-04 18:15
> **状态**: Mock 主流程已跑通，等待真实 API 替换

---

## 📋 项目背景

**项目**: SiYuan 思源笔记 - 分享Pro插件  
**功能**: 增量分享 (Incremental Share)  
**技术栈**: TypeScript + Svelte + Vite  
**路径**: `siyuan-plugin-share-pro`

---

## 🎯 当前进度

### ✅ 已完成

1. **UI 界面** - `IncrementalShareUI.svelte`
   - ✅ 文档分组显示（新增、更新、未变更）
   - ✅ 批量选择和全选功能
   - ✅ 搜索过滤功能
   - ✅ 统计数据显示
   - ✅ 日期格式化（避免 Invalid Date）
   - ✅ 国际化支持

2. **核心服务** - `IncrementalShareService.ts`
   - ✅ 变更检测逻辑 `detectChangedDocuments()`
   - ✅ 批量分享逻辑 `bulkShareDocuments()`
   - ✅ 黑名单过滤
   - ✅ 分享历史更新

3. **批量分享** - `ShareService.bulkCreateShare()`
   - ✅ 分页分批次处理（每批 5 个文档）
   - ✅ 每个文档间隔 500ms（避免频率限制）
   - ✅ 自动获取文档信息
   - ✅ Mock 实现（等待替换真实 API）

4. **配置管理** - `SettingService`
   - ✅ Mock 方法：`getSettingConfig()` 和 `saveSettingConfig()`
   - ✅ 必须使用：`syncSetting()` 和 `getSettingByAuthor()`

5. **Mock 数据**
   - ✅ `MockShareHistory` - 3 个历史记录
   - ✅ `MockShareBlacklist` - 2 个黑名单项
   - ✅ 5 个测试文档（不同状态）

### 📊 测试结果

**最新测试日志**:
```
[mock-share-history] Mock ShareHistory initialized with 3 items
[mock-share-blacklist] Mock ShareBlacklist initialized with 2 items
[incremental-share-ui] 获取到 5 个文档（Mock 数据）
[incremental-share-service] 变更检测结果: {newDocuments: Array(1), updatedDocuments: Array(3), unchangedDocuments: Array(0), blacklistedCount: 1}
```

**功能状态**:
- ✅ 日期显示正常
- ✅ 批量分享成功
- ✅ 成功提示显示
- ✅ 主流程完全跑通

---

## 🔧 需要替换的真实 API

### 1. ShareService.bulkCreateShare()

**文件**: `src/service/ShareService.ts`  
**位置**: 第 631-639 行

**当前 Mock 代码**:
```typescript
// TODO: 替换为真实调用
// await this.createShare(docId)
// 注意：createShare 内部会自动获取文档信息

const mockShareUrl = `https://siyuan.wiki/s/${docId}`
```

**需要替换为**:
```typescript
// 调用已有的 createShare 方法
await this.createShare(docId)

// 获取分享链接
const shareInfo = await this.getSharedDocInfo(docId)
const realShareUrl = shareInfo.data.url // 根据实际返回结构调整
```

**参考**: `createShare(docId, settings, options)` 在第 63 行

---

### 2. SettingService.getSettingConfig()

**文件**: `src/service/SettingService.ts`  
**位置**: 第 117-127 行

**当前 Mock 代码**:
```typescript
// 🔧 Mock 实现
// TODO: 替换为真实调用
// const author = extractAuthorFromToken(config.serviceApiConfig.token)
// return await this.getSettingByAuthor(author)

this.logger.info("🔧 [Mock] getSettingConfig called")
return {
  incrementalShareConfig: {
    enabled: true,
    lastShareTime: Date.now() - 1000 * 60 * 60 * 24,
    notebookBlacklist: [],
    docBlacklist: [],
  },
}
```

**需要替换为**:
```typescript
// 从 token 解析 author（需要实现此函数）
const author = extractAuthorFromToken(config.serviceApiConfig.token)

// 使用已有方法获取配置
return await this.getSettingByAuthor(author)
```

**必须使用**: `getSettingByAuthor(author)` - 唯一入口（第 33 行）

---

### 3. SettingService.saveSettingConfig()

**文件**: `src/service/SettingService.ts`  
**位置**: 第 143-148 行

**当前 Mock 代码**:
```typescript
// 🔧 Mock 实现
// TODO: 替换为真实调用
// const token = config.serviceApiConfig.token
// await this.syncSetting(token, config)

this.logger.info("🔧 [Mock] saveSettingConfig called", config)
```

**需要替换为**:
```typescript
const token = config.serviceApiConfig.token
await this.syncSetting(token, config)
```

**必须使用**: `syncSetting(token, setting)` - 唯一入口（第 29 行）

---

## 📁 关键文件列表

### 核心业务逻辑

1. **`src/service/IncrementalShareService.ts`**
   - 变更检测：`detectChangedDocuments()`
   - 批量分享：`bulkShareDocuments()`
   - 统计信息：`getIncrementalShareStats()`
   - 更新时间：`updateLastShareTime()`

2. **`src/service/ShareService.ts`**
   - 单文档分享：`createShare(docId, settings, options)` (第 63 行)
   - **新增** 批量分享：`bulkCreateShare(docIds[])` (第 587 行)
   - 获取分享信息：`getSharedDocInfo(docId, token)`
   - 取消分享：`cancelShare(docId)`

3. **`src/service/SettingService.ts`**
   - 同步配置：`syncSetting(token, setting)` (第 29 行)
   - 获取配置：`getSettingByAuthor(author)` (第 33 行)
   - **新增** Mock 方法：`getSettingConfig()`, `saveSettingConfig(config)`

### UI 组件

4. **`src/libs/pages/IncrementalShareUI.svelte`**
   - 主界面组件
   - 文档分组展示
   - 批量选择和搜索
   - 格式化日期：`formatTime(timestamp)`

### Mock 实现

5. **`src/service/mock/MockShareHistory.ts`**
   - Mock 分享历史记录
   - 3 个预设历史项

6. **`src/service/mock/MockShareBlacklist.ts`**
   - Mock 黑名单
   - 2 个预设黑名单项

### 数据模型

7. **`src/models/ShareHistory.ts`**
   - `ShareHistoryItem` 接口
   - `ShareHistory` 接口

8. **`src/models/ShareBlacklist.ts`**
   - `BlacklistItem` 接口
   - `ShareBlacklist` 接口

9. **`src/models/ShareProConfig.ts`**
   - `incrementalShareConfig` 配置字段

---

## 🔄 数据流

```
用户操作
  ↓
IncrementalShareUI.svelte
  ├─ 加载文档: getAllDocuments()
  ├─ 检测变更: incrementalShareService.detectChangedDocuments()
  │   ├─ 获取历史: shareHistory.getHistoryByDocId()
  │   ├─ 检查黑名单: shareBlacklist.areInBlacklist()
  │   └─ 返回分类结果
  ├─ 用户选择文档
  └─ 批量分享: incrementalShareService.bulkShareDocuments()
      ├─ 过滤黑名单文档
      ├─ 调用: shareService.bulkCreateShare(docIds)
      │   ├─ 分批处理（每批 5 个）
      │   ├─ 每个文档: createShare(docId)
      │   └─ 返回批量结果
      ├─ 更新历史: shareHistory.addHistory()
      ├─ 更新配置: settingService.saveSettingConfig()
      └─ 显示成功提示
```

---

## 🐛 已修复的问题

### 问题 1: `config.incrementalShareConfig?.enabled` 未定义
**症状**: 变更检测返回空数组  
**修复**: 注释掉 enabled 检查（Mock 阶段）

### 问题 2: `shareService.shareDoc()` 不存在
**症状**: 批量分享报错  
**修复**: 创建新方法 `bulkCreateShare(docIds)`

### 问题 3: `settingService.getSettingConfig()` 不存在
**症状**: 更新时间报错  
**修复**: 添加 Mock 方法

### 问题 4: Invalid Date 显示
**症状**: 日期显示为 "Invalid Date"  
**修复**: 
- 添加 `formatTime(timestamp)` 函数
- 字段名统一为 `shareTime`

### 问题 5: `formatTime` 重复声明
**症状**: 编译错误  
**修复**: 删除旧版本，保留完善版

---

## 📝 Mock 数据设计

### ShareHistory - 3 条记录

```typescript
{
  docId: "20231201-mock001",
  docTitle: "Mock 文档1 - 已分享",
  shareTime: Date.now() - 7天,
  shareStatus: "success",
  shareUrl: "https://siyuan.wiki/s/20231201-mock001",
  docModifiedTime: Date.now() - 8天,
}
{
  docId: "20231202-mock002",
  docTitle: "Mock 文档2 - 已更新",
  shareTime: Date.now() - 3天,
  shareStatus: "success",
  shareUrl: "https://siyuan.wiki/s/20231202-mock002",
  docModifiedTime: Date.now() - 1小时, // 有更新
}
{
  docId: "20231203-mock003",
  docTitle: "Mock 文档3 - 分享失败",
  shareTime: Date.now() - 1天,
  shareStatus: "failed",
  errorMessage: "网络错误",
  docModifiedTime: Date.now() - 2天,
}
```

### ShareBlacklist - 2 条记录

```typescript
{
  id: "20231204-blacklist001",
  name: "Mock 黑名单文档",
  type: "document",
  addedTime: Date.now() - 5天,
  note: "测试黑名单文档",
}
{
  id: "mock-notebook-001",
  name: "Mock 黑名单笔记本",
  type: "notebook",
  addedTime: Date.now() - 10天,
  note: "测试黑名单笔记本",
}
```

### 测试文档 - 5 个

```typescript
// 1. 已分享未更新
{ docId: "20231201-mock001", modifiedTime: 8天前 }

// 2. 已分享有更新
{ docId: "20231202-mock002", modifiedTime: 1小时前 }

// 3. 分享失败
{ docId: "20231203-mock003", modifiedTime: 2天前 }

// 4. 黑名单文档（应被过滤）
{ docId: "20231204-blacklist001", modifiedTime: 1天前 }

// 5. 新增文档
{ docId: "20231205-mock005", modifiedTime: 30分钟前 }
```

**预期分类结果**:
- 新增文档: 1 个 (mock005)
- 更新文档: 2 个 (mock002, mock003)
- 未变更文档: 1 个 (mock001)
- 黑名单: 1 个 (blacklist001)

---

## 🎯 下一步工作

### 立即需要做的

1. **测试批量分享功能**
   - 勾选 2-3 个文档
   - 点击"批量分享"
   - 观察控制台日志

2. **替换真实 API**（3 个位置）
   - `ShareService.bulkCreateShare()` - 调用 `createShare(docId)`
   - `SettingService.getSettingConfig()` - 调用 `getSettingByAuthor(author)`
   - `SettingService.saveSettingConfig()` - 调用 `syncSetting(token, config)`

### 后续优化

3. **完善 UI 细节**
   - 添加国际化文本
   - 优化加载动画
   - 添加错误处理

4. **功能扩展**
   - 黑名单管理界面
   - 分享历史查询
   - 统计报表

---

## 📖 关键代码片段

### 1. 批量分享入口

**文件**: `IncrementalShareUI.svelte`

```typescript
const handleBulkShare = async () => {
  const selectedDocs = [
    ...Array.from(selectedNewDocs).map((docId) => ({
      docId,
      docTitle: filteredNewDocs.find((d) => d.docId === docId)?.docTitle || "",
    })),
    ...Array.from(selectedUpdatedDocs).map((docId) => ({
      docId,
      docTitle: filteredUpdatedDocs.find((d) => d.docId === docId)?.docTitle || "",
    })),
  ]

  const result = await pluginInstance.incrementalShareService.bulkShareDocuments(
    selectedDocs,
    config
  )
  
  // 显示结果提示
  // 重新加载文档列表
}
```

### 2. 变更检测逻辑

**文件**: `IncrementalShareService.ts`

```typescript
public async detectChangedDocuments(allDocuments, config) {
  // 获取黑名单状态
  const blacklistStatus = await this.shareBlacklist.areInBlacklist(docIds)
  
  for (const doc of allDocuments) {
    // 检查笔记本黑名单
    if (notebookBlacklistSet.has(doc.notebookId)) {
      result.blacklistedCount++
      continue
    }
    
    // 检查文档黑名单
    if (blacklistStatus[doc.docId]) {
      result.blacklistedCount++
      continue
    }

    // 获取历史记录
    const history = await this.shareHistory.getHistoryByDocId(doc.docId)

    if (!history) {
      // 新文档
      result.newDocuments.push(...)
    } else if (doc.modifiedTime > history.docModifiedTime) {
      // 已更新的文档
      result.updatedDocuments.push(...)
    } else {
      // 无变更的文档
      result.unchangedDocuments.push(history)
    }
  }
  
  return result
}
```

### 3. 分批处理逻辑

**文件**: `ShareService.ts`

```typescript
public async bulkCreateShare(docIds: string[]) {
  const BATCH_SIZE = 5      // 每批 5 个
  const DELAY_MS = 500      // 间隔 500ms

  // 分批处理
  for (let i = 0; i < docIds.length; i += BATCH_SIZE) {
    const batchDocIds = docIds.slice(i, i + BATCH_SIZE)
    
    for (const docId of batchDocIds) {
      try {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS))
        
        // TODO: 替换为真实调用
        // await this.createShare(docId)
        
        const mockShareUrl = `https://siyuan.wiki/s/${docId}`
        result.successCount++
      } catch (error) {
        result.failedCount++
      }
    }
    
    // 批次间隔
    if (i + BATCH_SIZE < docIds.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS))
    }
  }
  
  return result
}
```

---

## 🔍 调试技巧

### 1. 查看控制台日志

所有关键操作都有日志输出，前缀标识：
- `[mock-share-history]` - Mock 历史记录操作
- `[mock-share-blacklist]` - Mock 黑名单操作
- `[incremental-share-ui]` - UI 操作
- `[incremental-share-service]` - 服务层操作
- `[share-service]` - 分享服务操作
- `[setting-service]` - 配置服务操作

### 2. 检查编译

```bash
# 开发模式（watch）
npm run dev

# 或使用 pnpm
pnpm dev

# 检查问题
npx eslint src/service/*.ts --fix
```

### 3. 常见问题排查

**Q: 变更检测结果全是 0？**
A: 检查 `config.incrementalShareConfig?.enabled` 是否存在

**Q: 批量分享报错？**
A: 检查 `ShareService.bulkCreateShare()` 是否存在

**Q: 日期显示 Invalid Date？**
A: 检查字段名是 `shareTime` 还是 `lastShareTime`

---

## 💡 重要提示

### 架构原则

1. **单文档模式代码隔离**
   - 单文档逻辑与批量逻辑完全分离
   - 注释清晰标注代码所属模式

2. **Mock 数据优先**
   - 先用 Mock 跑通主流程
   - 再逐步替换真实 API
   - 每个 Mock 都有详细的 TODO 注释

3. **必须使用指定入口**
   - SettingService: `syncSetting()` 和 `getSettingByAuthor()`
   - ShareService: 循环调用 `createShare(docId)`

### 代码规范

1. **国际化**
   - 所有文本使用 `pluginInstance.i18n["key"]`
   - 不需要 fallback

2. **日志输出**
   - 使用 `this.logger.info/error/warn`
   - 关键操作必须有日志

3. **错误处理**
   - try-catch 包裹异步操作
   - 错误信息记录到历史

---

## 📞 恢复对话时的提示词

**直接复制下面内容开始对话**:

```
我之前在开发思源笔记分享Pro插件的增量分享功能。

当前状态：
- Mock 主流程已跑通
- 批量分享功能已实现（Mock）
- 需要替换 3 个真实 API

主要文件：
- src/service/ShareService.ts - 第 631 行需要调用 createShare(docId)
- src/service/SettingService.ts - 第 117、143 行需要实现真实配置读写
- src/service/IncrementalShareService.ts - 核心逻辑

请查看 incremental-share-context-2512-04.md 了解完整上下文。

我现在需要 [描述你的需求]。
```

---

## 📚 参考资料

### 相关文档

- `openspec/changes/add-incremental-sharing/proposal.md` - 功能提案
- `openspec/changes/add-incremental-sharing/tasks.md` - 任务列表
- `docs/ShareUI-Code-Structure.md` - ShareUI 代码结构

### 技术栈文档

- Svelte: https://svelte.dev/
- TypeScript: https://www.typescriptlang.org/
- Vite: https://vitejs.dev/

---

**最后更新**: 2025-12-04 18:15