# 本地黑名单服务实现说明

## 概述

本文档说明了本地黑名单服务的实现，该服务用于替代原有的基于Java后端的黑名单管理功能。本地黑名单服务充分利用思源笔记的本地存储能力，提供更好的性能和用户体验。

## 存储方案

### 文档级别黑名单
- **存储位置**：文档属性
- **属性名**：`custom-share-blacklist-document`
- **存储格式**：JSON字符串，包含黑名单项的完整信息和元数据

### 笔记本级别黑名单
- **存储位置**：插件配置（AppConfig）
- **配置路径**：`appConfig.incrementalShareConfig.notebookBlacklist`
- **存储格式**：BlacklistItem对象数组

## 核心功能

### 1. 添加黑名单项
根据项的类型（文档或笔记本），将黑名单信息存储到相应的存储位置。

### 2. 移除黑名单项
从相应的存储位置删除黑名单项，支持文档和笔记本两种类型。

### 3. 批量检查黑名单
支持同时检查多个ID是否在黑名单中，自动区分文档ID和笔记本ID。

### 4. 获取所有黑名单项
获取当前所有的黑名单项，包括文档和笔记本级别。

## 技术实现

### 类结构
```typescript
class LocalBlacklistService implements ShareBlacklist {
  // 公共接口方法
  async getAllItems(): Promise<BlacklistItem[]>
  async addItem(item: BlacklistItem): Promise<void>
  async removeItem(id: string): Promise<void>
  async isInBlacklist(id: string): Promise<boolean>
  async areInBlacklist(ids: string[]): Promise<Record<string, boolean>>
  async clearBlacklist(): Promise<void>
  async getItemsByType(type: BlacklistItemType): Promise<BlacklistItem[]>
  async searchItems(query: string): Promise<BlacklistItem[]>
  
  // 私有方法
  private async getNotebookBlacklistItems(): Promise<BlacklistItem[]>
  private async addNotebookToBlacklist(item: BlacklistItem): Promise<void>
  private async removeNotebookFromBlacklist(id: string): Promise<void>
  private async areNotebooksInBlacklist(ids: string[]): Promise<Record<string, boolean>>
  private async clearNotebookBlacklist(): Promise<void>
  private async addDocumentToBlacklist(item: BlacklistItem): Promise<void>
  private async removeDocumentFromBlacklist(id: string): Promise<void>
  private async areDocumentsInBlacklist(ids: string[]): Promise<Record<string, boolean>>
}
```

### 数据结构
```typescript
interface BlacklistItem {
  id: string           // 文档ID或笔记本ID
  name: string         // 名称
  type: "notebook" | "document"  // 类型
  addedTime: number    // 添加时间
  note?: string        // 备注
}
```

## 集成与使用

### 在插件中的集成
在`index.ts`中，我们用`LocalBlacklistService`替换了原有的`BlacklistService`：

```typescript
// 使用本地黑名单服务替代原来的黑名单服务
const blacklistService = new LocalBlacklistService(this, this.settingService)
this.incrementalShareService = new IncrementalShareService(
  this,
  this.shareService,
  this.settingService,
  blacklistService
)
```

### 在增量分享服务中的使用
`IncrementalShareService`通过构造函数接收`LocalBlacklistService`实例，并在变更检测和批量分享过程中使用黑名单服务来过滤不需要分享的文档。

## 优势

1. **性能提升**：本地存储避免了网络延迟，提高了响应速度
2. **离线可用**：无需网络连接即可使用黑名单功能
3. **数据一致性**：与思源笔记的本地存储机制完美契合
4. **用户体验**：更快的响应速度和更流畅的操作体验

## 测试

提供了单元测试和集成测试来验证功能的正确性：

1. **单元测试**：针对每个方法的功能进行测试
2. **集成测试**：验证与插件系统的集成

## 注意事项

1. 文档级别的黑名单存储在各个文档的属性中，无法直接获取所有文档级别的黑名单项
2. 笔记本级别的黑名单存储在插件配置中，可以方便地获取和管理
3. ID区分采用启发式方法（长度判断），在极少数情况下可能存在误判