# 增量分享功能开发上下文

> **生成时间**: 2025-12-08 23:45
> **状态**: 性能优化方案已确定，待实施

---

## 📋 项目背景

**项目**: SiYuan 思源笔记 - 分享Pro插件  
**功能**: 增量分享 (Incremental Share)  
**技术栈**: TypeScript + Svelte + Vite  
**路径**: `/Users/zhangyue/Documents/terwer/myapps/siyuan-plugin-share-pro`

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
   - ✅ 性能优化（Web Worker、虚拟滚动、缓存机制）

3. **批量分享** - `ShareService.bulkCreateShare()`
   - ✅ 分页分批次处理（每批 5 个文档）
   - ✅ 每个文档间隔 500ms（避免频率限制）
   - ✅ 自动获取文档信息
   - ✅ 智能重试机制
   - ✅ 分享队列管理

4. **配置管理** - `SettingService`
   - ✅ 真实配置读写方法已实现
   - ✅ 支持增量分享配置

5. **Mock 数据**
   - ✅ `MockShareHistory` - 3 个历史记录
   - ✅ `MockShareBlacklist` - 2 个黑名单项
   - ✅ 5 个测试文档（不同状态）

### 📊 测试结果

**最新测试日志**:
```
[incremental-share-service] 增量分享核心服务已完整实现
[incremental-share-service] 批量分享并发控制（限制5个并发）
[incremental-share-service] 智能重试机制已实现
[incremental-share-service] 分享队列管理系统已实现
```

**功能状态**:
- ✅ 主流程完全跑通
- ✅ 性能优化已实现
- ⚠️ 存储机制待实现（当前为Mock）

---

## 🔧 待解决的关键问题

### 1. 存储机制缺失
**问题**: 当前使用 Mock 实现，缺乏真实的持久化存储方案

**影响**:
- 无法长期保存分享历史
- 数据一致性难以保证
- 跨会话查询效率低下

### 2. 双重查询问题
**问题**: 需要进行两次API调用才能获取完整信息
1. 查询思源API获取文档列表
2. 调用Java端API查询分享状态

**影响**:
- 网络延迟叠加，响应时间长
- 无法高效筛选已分享内容
- 用户体验不佳

### 3. 历史数据迁移
**问题**: 尚未设计历史用户数据的迁移方案

**影响**:
- 现有用户升级后数据丢失
- 用户体验不连续

---

## 🎯 优化方案概述

### 方案一：本地存储分享状态（推荐）

**核心思路**:
通过文档属性存储分享状态信息，利用思源API的SQL查询能力直接筛选已分享文档。

**优势**:
- 查询速度快，本地即可获取分享状态
- 减少网络请求，提升用户体验
- 支持复杂的筛选和排序操作

**实施要点**:
1. 实现ShareHistory真实存储类
2. 优化SQL查询语句
3. 实现缓存机制

### 方案二：服务端优化API

**核心思路**:
优化服务端API，一次性获取文档列表及其分享状态。

**优势**:
- 减少API调用次数
- 保持数据一致性

**劣势**:
- 仍需网络请求
- 响应时间取决于服务端性能

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

## 📝 详细实施计划

### 第一阶段：实现本地存储机制（1-2周）

#### 技术选型
选择文档属性存储方案，原因：
- 与文档绑定，天然具有一致性
- 无需额外的文件管理
- 支持增量更新

#### 核心实现
```typescript
// ShareHistory真实实现类
class LocalShareHistory implements ShareHistory {
  async addHistory(item: ShareHistoryItem): Promise<void> {
    const attrs = {
      "custom-share-history": JSON.stringify(item)
    };
    await kernelApi.setBlockAttrs(item.docId, attrs);
  }
  
  async getHistoryByDocId(docId: string): Promise<ShareHistoryItem | undefined> {
    const attrs = await kernelApi.getBlockAttrs(docId);
    if (attrs["custom-share-history"]) {
      return JSON.parse(attrs["custom-share-history"]);
    }
    return undefined;
  }
  
  // 其他方法实现...
}
```

#### 数据结构设计
```typescript
interface ShareHistoryItem {
  docId: string;           // 文档ID
  docTitle: string;        // 文档标题
  shareTime: number;       // 分享时间戳
  shareStatus: "success" | "failed" | "pending";  // 分享状态
  shareUrl?: string;       // 分享链接
  errorMessage?: string;   // 错误信息
  docModifiedTime: number; // 文档修改时间戳
}
```

### 第二阶段：优化查询性能（2-3周）

#### SQL查询优化
通过思源API直接查询已分享文档：
```sql
-- 查询已分享文档
SELECT * FROM blocks b 
WHERE b.id = b.root_id 
  AND b.type = 'd' 
  AND EXISTS (
    SELECT 1 FROM attributes a 
    WHERE a.block_id = b.id 
    AND a.name = 'custom-share-history'
  )
```

#### 分页查询实现
```typescript
// 分页获取已分享文档
async function getPagedSharedDocuments(pageNum: number, pageSize: number) {
  const offset = pageNum * pageSize;
  const sql = `
    SELECT * FROM blocks b 
    WHERE b.id = b.root_id 
      AND b.type = 'd' 
      AND EXISTS (
        SELECT 1 FROM attributes a 
        WHERE a.block_id = b.id 
        AND a.name = 'custom-share-history'
      )
    LIMIT ${pageSize} OFFSET ${offset}
  `;
  
  return await kernelApi.sql(sql);
}
```

#### 缓存机制优化
```typescript
class ShareHistoryCache {
  private cache: Map<string, ShareHistoryItem>;
  private timestamps: Map<string, number>;
  private readonly TTL = 5 * 60 * 1000; // 5分钟
  
  get(docId: string): ShareHistoryItem | undefined {
    const timestamp = this.timestamps.get(docId);
    if (timestamp && (Date.now() - timestamp) < this.TTL) {
      return this.cache.get(docId);
    }
    return undefined;
  }
  
  set(docId: string, item: ShareHistoryItem): void {
    this.cache.set(docId, item);
    this.timestamps.set(docId, Date.now());
  }
}
```

### 第三阶段：历史数据迁移（1周）

#### 首次使用迁移
```typescript
// 首次使用增量分享功能时的迁移逻辑
async function migrateHistoricalData() {
  // 1. 获取当前所有已分享文档
  const sharedDocs = await shareService.listAllSharedDocuments();
  
  // 2. 为每个文档创建初始分享历史记录
  for (const doc of sharedDocs) {
    const historyItem: ShareHistoryItem = {
      docId: doc.docId,
      docTitle: doc.title,
      shareTime: doc.sharedAtTimestamp,
      shareStatus: "success",
      docModifiedTime: doc.modifiedAtTimestamp
    };
    
    // 3. 存储到本地
    await shareHistoryService.addHistory(historyItem);
  }
  
  // 4. 记录迁移完成状态
  await settingService.setSetting("migrationComplete", true);
}
```

#### 渐进式迁移
对于已有大量分享文档的用户，采用渐进式迁移：
1. 后台任务逐步迁移历史数据
2. 新分享操作自动创建历史记录
3. 查询时动态补全历史数据

---

## 🎯 下一步工作

### 立即需要做的

1. **实现ShareHistory真实存储类**
   - 创建LocalShareHistory类
   - 实现所有接口方法
   - 替换Mock实现

2. **优化SQL查询**
   - 实现分页查询已分享文档
   - 测试查询性能

3. **实现缓存机制**
   - 创建ShareHistoryCache类
   - 集成到查询流程中

### 后续优化

4. **历史数据迁移**
   - 实现迁移逻辑
   - 测试迁移过程

5. **完善数据一致性保障**
   - 实现定期校验机制
   - 添加异常处理流程

6. **性能监控**
   - 添加性能指标收集
   - 实现性能瓶颈分析工具

---

## 📖 关键代码片段

### 1. 本地存储实现

**文件**: `src/service/LocalShareHistory.ts`

```typescript
class LocalShareHistory implements ShareHistory {
  async addHistory(item: ShareHistoryItem): Promise<void> {
    const attrs = {
      "custom-share-history": JSON.stringify({
        ...item,
        _version: "1.0",
        _updatedAt: Date.now()
      })
    };
    await kernelApi.setBlockAttrs(item.docId, attrs);
  }
  
  async getHistoryByDocId(docId: string): Promise<ShareHistoryItem | undefined> {
    try {
      const attrs = await kernelApi.getBlockAttrs(docId);
      if (attrs["custom-share-history"]) {
        const item = JSON.parse(attrs["custom-share-history"]);
        // 版本兼容性检查
        if (item._version === "1.0") {
          delete item._version;
          delete item._updatedAt;
          return item;
        }
      }
    } catch (error) {
      console.error(`获取文档${docId}的分享历史失败:`, error);
    }
    return undefined;
  }
}
```

### 2. SQL查询优化

**文件**: `src/composables/useSiyuanApi.ts`

```typescript
// 获取已分享文档总数
export const getSharedDocumentsCount = async (kernelApi: SiyuanKernelApi): Promise<number> => {
  const sql = `
    SELECT COUNT(*) as total
    FROM blocks b 
    WHERE b.id = b.root_id 
      AND b.type = 'd' 
      AND EXISTS (
        SELECT 1 FROM attributes a 
        WHERE a.block_id = b.id 
        AND a.name = 'custom-share-history'
      )
  `;
  
  const resData = await kernelApi.sql(sql);
  if (!resData || resData.length === 0 || !resData[0].total) {
    return 0;
  }
  return parseInt(resData[0].total) || 0;
};

// 分页获取已分享文档
export const getSharedDocumentsPaged = async (
  kernelApi: SiyuanKernelApi, 
  pageNum: number, 
  pageSize: number
): Promise<any[]> => {
  const offset = pageNum * pageSize;
  const sql = `
    SELECT b.root_id as docId, b.content as docTitle
    FROM blocks b 
    WHERE b.id = b.root_id 
      AND b.type = 'd' 
      AND EXISTS (
        SELECT 1 FROM attributes a 
        WHERE a.block_id = b.id 
        AND a.name = 'custom-share-history'
      )
    ORDER BY b.updated DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `;
  
  return await kernelApi.sql(sql);
};
```

### 3. 缓存机制实现

**文件**: `src/utils/ShareHistoryCache.ts`

```typescript
class ShareHistoryCache {
  private cache: Map<string, ShareHistoryItem> = new Map();
  private timestamps: Map<string, number> = new Map();
  private readonly TTL = 5 * 60 * 1000; // 5分钟
  
  get(docId: string): ShareHistoryItem | undefined {
    const timestamp = this.timestamps.get(docId);
    if (timestamp && (Date.now() - timestamp) < this.TTL) {
      return this.cache.get(docId);
    }
    // 过期则清除
    this.cache.delete(docId);
    this.timestamps.delete(docId);
    return undefined;
  }
  
  set(docId: string, item: ShareHistoryItem): void {
    this.cache.set(docId, item);
    this.timestamps.set(docId, Date.now());
  }
  
  clear(): void {
    this.cache.clear();
    this.timestamps.clear();
  }
  
  // 清除特定文档的缓存
  invalidate(docId: string): void {
    this.cache.delete(docId);
    this.timestamps.delete(docId);
  }
}

// 全局单例
export const shareHistoryCache = new ShareHistoryCache();
```

---

## 🔍 调试技巧

### 1. 查看控制台日志

所有关键操作都有日志输出，前缀标识：
- `[incremental-share-service]` - 增量分享服务操作
- `[local-share-history]` - 本地存储操作
- `[share-history-cache]` - 缓存操作

### 2. 性能测试

```bash
# 测试查询性能
console.time('变更检测');
const result = await incrementalShareService.detectChangedDocuments(...);
console.timeEnd('变更检测');

# 监控缓存命中率
console.log('缓存命中率:', cacheHitRate);
```

### 3. 常见问题排查

**Q: 查询速度没有提升？**
A: 检查是否正确使用了SQL查询优化

**Q: 缓存没有生效？**
A: 检查TTL设置和缓存更新逻辑

**Q: 数据不一致？**
A: 检查存储和读取逻辑是否匹配

---

## 💡 重要提示

### 架构原则

1. **性能优先**
   - 本地存储优于网络请求
   - 缓存机制提升查询效率
   - 分页查询避免大数据量处理

2. **数据一致性**
   - 实现定期校验机制
   - 添加异常处理流程
   - 提供手动同步选项

3. **用户体验**
   - 渐进式迁移避免卡顿
   - 及时反馈操作结果
   - 优雅处理错误情况

### 代码规范

1. **错误处理**
   - try-catch 包裹所有异步操作
   - 错误信息记录到日志
   - 提供用户友好的错误提示

2. **性能监控**
   - 关键操作添加性能统计
   - 实现缓存命中率监控
   - 定期分析性能瓶颈

3. **版本兼容**
   - 数据结构添加版本号
   - 实现版本升级逻辑
   - 保持向后兼容性

---

## 📞 恢复对话时的提示词

**直接复制下面内容开始对话**:

```
我之前在开发思源笔记分享Pro插件的增量分享功能。

当前状态：
- 性能优化方案已确定
- 需要实现本地存储机制
- 需要优化查询性能

主要文件：
- src/service/IncrementalShareService.ts - 核心逻辑
- src/service/LocalShareHistory.ts - 待创建的本地存储实现
- src/composables/useSiyuanApi.ts - SQL查询优化
- src/utils/ShareHistoryCache.ts - 缓存机制

请查看 /Users/zhangyue/Documents/terwer/myapps/siyuan-plugin-share-pro/docs/incremental-share-context-2025-12-08.md 了解完整上下文。

我现在需要 [描述你的需求]。
```

---

## 📚 参考资料

### 相关文档

- `openspec/changes/add-incremental-sharing/proposal.md` - 功能提案
- `openspec/changes/add-incremental-sharing/tasks.md` - 任务列表
- `docs/incremental-share-optimization-plan.md` - 优化方案详细文档

### 技术栈文档

- Svelte: https://svelte.dev/
- TypeScript: https://www.typescriptlang.org/
- Vite: https://vitejs.dev/

---

**最后更新**: 2025-12-08 23:45 