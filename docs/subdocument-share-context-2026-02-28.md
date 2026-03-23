# 思源笔记分享专业版 v1.16.0 开发上下文总结

**最后更新时间：2026年2月28日**
**开发者：Terwer**

## 项目概述

思源笔记在线分享专业版 v1.16.0 版本的核心功能是**子文档分享功能**，这是用户长期期待的重要特性。增量分享功能已经稳定运行数月，现在正式推出完整的子文档树分享能力。

## 核心架构设计

### 三层配置架构（已正确实现）

1. **Level 1 - 全局配置 (userPreferences)**
   - 存储位置：`ShareProConfig.appConfig`
   - 配置项：`shareSubdocuments` (boolean, 默认 true), `maxSubdocuments` (number, 默认 100)
   - 文件：`src/models/AppConfig.ts`

2. **Level 2 - 文档级配置 (singleDocSetting)**
   - 存储位置：文档属性 (Block Attributes)
   - 配置项：`shareSubdocuments` (boolean), `maxSubdocuments` (number)
   - 文件：`src/models/SingleDocSetting.ts`
   - 属性键：`CUSTOM_SHARE_SUBDOCUMENTS`, `CUSTOM_MAX_SUBDOCUMENTS`

3. **Level 3 - 分享选项 (shareOptions)**
   - 存储位置：服务器端敏感信息
   - **注意**：`shareSubdocuments` 不在此层级，仅包含密码等敏感信息
   - 文件：`src/models/ShareOptions.ts`

### 配置优先级逻辑

```typescript
// 有效配置计算逻辑
const effectiveShareSubdocuments = settings?.shareSubdocuments ?? globalShareSubdocuments;
const effectiveMaxSubdocuments = settings?.maxSubdocuments ?? globalMaxSubdocuments ?? 100;
```

### 统一API入口设计（已实现）

- **`createShare(docId, settings, options)`** - 对外唯一入口
  - 根据配置决定是否包含子文档
  - 聚合逻辑处理

- **`handleOne(docId, settings, options)`** - 内部单文档处理
  - 原 `createShare` 方法重命名
  - 纯净的单文档分享逻辑

- **`cancelShare(docId)`** - 对外取消入口
  - 统一处理单文档或子文档取消

- **`cancelOne(docId)`** - 内部单文档取消
  - 原 `cancelShare` 方法重命名

## 已完成的关键功能

### 1. 数据模型层
- ✅ `src/models/SingleDocSetting.ts` - 添加 `shareSubdocuments` 和 `maxSubdocuments`
- ✅ `src/models/AppConfig.ts` - 添加全局配置，默认值设为 true
- ✅ `src/models/ShareOptions.ts` - **移除** `shareSubdocuments`（仅保留敏感信息）
- ✅ `src/utils/SettingKeys.ts` - 添加配置键常量

### 2. 配置工具
- ✅ `src/utils/AttrUtils.ts` - 实现 `toAttrs()` 和 `fromAttrs()` 方法
- ✅ 正确映射文档属性与配置对象

### 3. 核心服务
- ✅ `src/service/ShareService.ts` - 重构统一API入口
- ✅ 实现 `flattenDocumentsForSharing()` 方法
- ✅ BFS广度优先算法 + SQL分页查询
- ✅ 数量限制：默认100，最大999，支持-1无限制
- ✅ 深度控制：默认3层，可配置1-10层

### 4. UI集成
- ✅ `src/libs/pages/ShareUI.svelte` - 紧凑水平布局（方案一）
- ✅ `src/libs/pages/setting/DocSetting.svelte` - 默认开启子文档分享
- ✅ `src/topbar.ts` - 更新调用新的统一API

### 5. 国际化
- ✅ `src/i18n/en_US.json` - 添加英文文案
- ✅ `src/i18n/zh_CN.json` - 添加中文文案

## UI设计要点

### 紧凑水平布局（方案一）
- 三个核心功能在同一行显示：子文档分享、文档树、文档大纲
- 左侧文字左对齐顶格，右侧控件右对齐
- 使用自定义CSS类避免样式冲突：
  - `.compact-share-config`
  - `.compact-switch`
  - `.compact-label`
  - `.ui-checkbox`

### 响应式设计
- 移动端自动换行 (`flex-wrap: wrap`)
- 保持专业SaaS产品UI标准

## 关键技术实现

### 子文档获取方法（实际实现）

根据 `src/composables/useSiyuanApi.ts` 中的实际代码：

#### 获取子文档总数
```typescript
// 获取指定文档的子文档总数
const sql = `
  SELECT COUNT(DISTINCT b1.root_id) AS count
  FROM blocks b1
  WHERE b1.root_id = '${escapedDocId}' OR b1.path LIKE '%/${escapedDocId}%'
`;
```

#### 分页获取子文档列表
```typescript
// 分页获取子文档列表
const sql = `
  SELECT DISTINCT b2.root_id, b2.content, b2.path, b2.updated, b2.created
  FROM blocks b2
  WHERE b2.id IN (
      SELECT DISTINCT b1.root_id
      FROM blocks b1
      WHERE b1.root_id = '${escapedDocId}' OR b1.path LIKE '%/${escapedDocId}%'
      ORDER BY b1.updated DESC, b1.created DESC
      LIMIT ${pageSize} OFFSET ${offset}
  )
  ORDER BY b2.updated DESC, b2.created DESC, b2.id
`;
```

### 性能优化措施
- 分页加载：每次50个文档
- 智能缓存：5分钟缓存子文档信息
- 并发控制：最多10个并发分享
- 异步处理：不阻塞UI主线程

## 配置默认值

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `shareSubdocuments` | `true` | 子文档分享默认开启 |
| `maxSubdocuments` | `100` | 默认分享100个子文档 |
| `docTreeLevel` | `3` | 文档树深度默认3层 |
| `outlineLevel` | `6` | 文档大纲深度默认6层 |

## 已修复的关键问题

1. **架构错误**：最初错误地将 `shareSubdocuments` 放在 Level 3，现已修正到 Level 1+2
2. **UI可见性**：子文档分享选项现在始终可见，不再仅在分享后显示
3. **默认值问题**：设置页面和分享页面都默认开启子文档分享
4. **API设计**：实现统一入口，避免多个入口点
5. **样式问题**：修复checkbox过大和布局错乱问题

## 测试验证点

### 功能测试
- [x] 基本开关功能正常
- [x] 数量限制（100/500/999/无限制）工作正常
- [x] 深度控制（1-10层/无限深度）工作正常
- [x] 三层配置优先级正确
- [x] 新UI、旧UI、topbar菜单都调用统一API

### 边界情况
- [x] 超过999个子文档的警告提示
- [x] 循环引用文档的安全处理
- [x] 子文档不存在时的优雅降级
- [x] 网络异常的错误处理

## 后续规划（v1.16.0+）

根据发布公告，后续版本将实现：
1. **子文档树可视化预览** - 直观查看分享结构
2. **手动选择/排除特定子文档** - 精细化控制
3. **智能预估分享时间和存储空间** - 提前了解资源消耗
4. **移动端优化体验** - 完整移动适配
5. **团队协作功能** - 多人协同编辑和分享

## 重要文件路径速查

- **核心服务**: `src/service/ShareService.ts`
- **数据模型**: `src/models/`
- **UI组件**: `src/libs/pages/`
- **工具函数**: `src/utils/`
- **国际化**: `src/i18n/`
- **API封装**: `src/composables/useSiyuanApi.ts`

## 开发环境配置

- **分支**: `dev`
- **主分支**: `main`
- **构建命令**: `npm run build`
- **测试命令**: `npm test`

## 注意事项

1. **不要修改** `createShare` 和 `cancelShare` 的对外API签名
2. **所有新功能**必须通过统一入口处理
3. **配置变更**需要同时更新中英文国际化文件
4. **性能敏感**操作必须考虑分页和缓存
5. **向后兼容**现有用户配置

---

**开发状态**: v1.16.0 核心功能已完成，准备发布
**下一步**: 可以开始实现后续规划中的高级功能，如可视化预览等