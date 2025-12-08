# 增量分享功能优化方案

## 1. 概述

本文档旨在解决增量分享功能中的性能瓶颈问题，特别是双重查询导致的效率低下问题。通过实现本地存储机制和优化数据查询策略，显著提升用户体验。

## 2. 当前问题分析

### 2.1 双重查询问题
当前实现需要进行两次API调用：
1. 查询思源API获取文档列表
2. 调用Java端API查询分享状态

这种双重查询方式存在以下问题：
- 网络延迟叠加，响应时间长
- 无法高效筛选已分享内容
- 用户体验不佳，特别是在大型知识库中

### 2.2 存储机制缺失
目前使用Mock实现，缺乏真实的持久化存储方案，导致：
- 无法长期保存分享历史
- 数据一致性难以保证
- 跨会话查询效率低下

## 3. 优化方案设计

### 3.1 方案一：本地存储分享状态（推荐）

#### 3.1.1 存储方案选择
```typescript
// 存储方案建议
// 1. 文档属性存储（推荐）
kernelApi.setBlockAttrs(docId, { 
  "custom-share-history": JSON.stringify(shareHistoryItem) 
})

// 2. 插件数据目录存储
fs.writeFile(`${pluginDir}/share-history.json`, JSON.stringify(shareHistoryItems))
```

#### 3.1.2 优势
- 查询速度快，本地即可获取分享状态
- 减少网络请求，提升用户体验
- 支持复杂的筛选和排序操作

#### 3.1.3 劣势
- 需要实现数据同步机制
- 跨设备同步需要额外处理

### 3.2 方案二：服务端优化API

#### 3.2.1 API优化建议
```typescript
// 建议的服务端API优化
// 一次性获取文档列表及其分享状态
POST /api/share/batchGetStatus
{
  "docIds": ["id1", "id2", "id3"...]
}
```

#### 3.2.2 优势
- 减少API调用次数
- 保持数据一致性

#### 3.2.3 劣势
- 仍需网络请求
- 响应时间取决于服务端性能

## 4. 实施计划

### 4.1 第一阶段：实现本地存储机制（1-2周）

#### 4.1.1 技术选型
选择文档属性存储方案，原因：
- 与文档绑定，天然具有一致性
- 无需额外的文件管理
- 支持增量更新

#### 4.1.2 核心实现
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

#### 4.1.3 数据结构设计
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

### 4.2 第二阶段：优化查询性能（2-3周）

#### 4.2.1 SQL查询优化
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

#### 4.2.2 分页查询实现
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

#### 4.2.3 缓存机制优化
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

### 4.3 第三阶段：历史数据迁移（1周）

#### 4.3.1 首次使用迁移
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

#### 4.3.2 渐进式迁移
对于已有大量分享文档的用户，采用渐进式迁移：
1. 后台任务逐步迁移历史数据
2. 新分享操作自动创建历史记录
3. 查询时动态补全历史数据

### 4.4 第四阶段：数据一致性保障（持续进行）

#### 4.4.1 定期校验机制
```typescript
// 后台定时任务每24小时检查一次
class DataConsistencyChecker {
  async checkConsistency() {
    // 1. 获取所有本地记录的分享文档
    const localSharedDocs = await this.getLocalSharedDocuments();
    
    // 2. 与服务端数据对比
    for (const doc of localSharedDocs) {
      const remoteStatus = await this.getRemoteShareStatus(doc.docId);
      if (remoteStatus !== doc.shareStatus) {
        // 3. 发现不一致时更新本地记录
        await this.updateLocalRecord(doc.docId, remoteStatus);
      }
    }
  }
}
```

#### 4.4.2 异常处理机制
```typescript
// 异常情况处理
class ExceptionHandler {
  async handleDeletedDocument(docId: string) {
    // 1. 检测文档是否已被删除
    const docExists = await kernelApi.getDocument(docId);
    if (!docExists) {
      // 2. 清理对应的分享历史记录
      await shareHistoryService.removeHistory(docId);
    }
  }
  
  async handleStatusAnomaly(docId: string) {
    // 1. 标记状态异常的记录
    await shareHistoryService.updateHistory(docId, {
      shareStatus: "failed",
      errorMessage: "状态异常，请手动检查"
    });
    
    // 2. 提示用户处理
    showMessage("发现分享状态异常，请前往分享管理页面检查", 5000, "warning");
  }
}
```

## 5. 性能优化效果预期

### 5.1 查询性能提升
- 文档列表获取时间：从原来的2次API调用缩减为1次SQL查询
- 查询响应时间：预计提升60-80%
- 大型知识库（10000+文档）查询时间：从10秒降至2秒以内

### 5.2 用户体验改善
- 分享历史即时可见，无需等待网络响应
- 筛选和排序操作本地完成，响应迅速
- 减少网络依赖，提升离线使用体验

### 5.3 系统资源占用
- 内存占用：增加约10-20MB（用于缓存）
- 存储占用：每个文档增加约1KB元数据
- 网络请求：减少50%以上的API调用

## 6. 风险评估与应对措施

### 6.1 技术风险
1. **数据一致性风险**
   - 应对措施：实现定期校验机制和异常处理流程
   
2. **存储容量风险**
   - 应对措施：实现智能清理机制，定期清理过期数据
   
3. **兼容性风险**
   - 应对措施：保持向后兼容，提供降级方案

### 6.2 实施风险
1. **迁移失败风险**
   - 应对措施：实现回滚机制，确保数据安全
   
2. **性能不达预期**
   - 应对措施：持续监控性能指标，及时调整优化策略

## 7. 落地行动计划

### 7.1 短期目标（1个月内）
- [ ] 实现ShareHistory真实存储类
- [ ] 完成SQL查询优化
- [ ] 实现基础缓存机制
- [ ] 完成单元测试和集成测试

### 7.2 中期目标（2-3个月）
- [ ] 实现历史数据迁移方案
- [ ] 完善数据一致性保障机制
- [ ] 优化移动端体验
- [ ] 完成性能压测和调优

### 7.3 长期目标（3-6个月）
- [ ] 实现智能清理机制
- [ ] 添加分享统计报表功能
- [ ] 支持跨设备数据同步
- [ ] 持续监控和优化性能

## 8. 总结

通过实施本地存储机制和SQL查询优化，我们可以从根本上解决双重查询问题，显著提升增量分享功能的性能和用户体验。该方案具有实施可行性高、性能提升显著、用户体验改善明显等优点，是当前最优的解决方案。