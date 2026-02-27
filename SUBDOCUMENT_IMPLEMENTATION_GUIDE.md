# 子文档分享功能实施指南

## 背景
- 增量分享功能已稳定运行几个月，无重大bug
- 用户急需子文档分享功能，主要用于分析手册等大型文档树结构
- openspec提案已通过验证：`npx openspec validate add-subdocument-sharing --strict`

## 核心需求
- **数量限制**: 默认100个，最大999个，支持无限制选项（带风险提示）
- **深度控制**: 默认3层，可配置1-10层，支持无限深度选项（带风险提示）
- **技术方案**: 使用SQL查询方案（已生产验证），支持分页避免内存溢出
- **算法**: BFS广度优先遍历
- **集成**: 既支持增量分享扩展，也支持独立单次分享

## 已完成的准备工作

### 1. SQL查询方法已实现
文件: `src/composables/useSiyuanApi.ts`

```typescript
// 获取子文档总数
export const getSubdocCount = async (kernelApi: SiyuanKernelApi, docId: string): Promise<number>

// 分页获取子文档列表
export const getSubdocsPaged = async (
  kernelApi: SiyuanKernelApi,
  docId: string,
  page: number,
  pageSize: number
): Promise<Array<{
  docId: string
  docTitle: string
  path: string
  modifiedTime: number
  createdTime: number
}>>
```

### 2. SQL查询语句
**获取总数:**
```sql
SELECT COUNT(DISTINCT b1.root_id) AS count
FROM blocks b1
WHERE b1.root_id = '[docId]' OR b1.path LIKE '%/[docId]%'
```

**分页获取:**
```sql
SELECT DISTINCT b2.root_id, b2.content, b2.path, b2.updated, b2.created
FROM blocks b2
WHERE b2.id IN (
    SELECT DISTINCT b1.root_id
    FROM blocks b1
    WHERE b1.root_id = '[docId]' OR b1.path LIKE '%/[docId]%'
    ORDER BY b1.updated DESC, b1.created DESC
    LIMIT [pagesize] OFFSET [page * pagesize]
)
ORDER BY b2.updated DESC, b2.created DESC, b2.id
```

## 实施步骤清单

### 第1步: 数据模型扩展
- [ ] `src/models/ShareOptions.ts` - 添加 `shareSubdocuments?: boolean` 属性
- [ ] `src/models/SingleDocSetting.ts` - 添加 `shareSubdocuments?: boolean` 属性
- [ ] `src/models/ShareProConfig.ts` - 在 `AppConfig` 中添加 `shareSubdocuments?: boolean`

### 第2步: 配置键定义
- [ ] `src/utils/SettingKeys.ts` - 添加 `CUSTOM_SHARE_SUBDOCUMENTS = "custom-share-subdocuments"`

### 第3步: 配置服务
- [ ] `src/service/SettingService.ts` - 实现配置同步和管理方法

### 第4步: 核心分享服务
- [ ] `src/service/ShareService.ts` - 实现子文档递归获取和分享逻辑
  - 使用BFS算法
  - 调用 `getSubdocCount` 和 `getSubdocsPaged` 方法
  - 实现数量限制（100/999/无限制）和深度控制（3/1-10/无限）
  - 支持缓存（5分钟）、异步加载、批量处理（10并发）

### 第5步: UI组件
- [ ] `src/libs/pages/ShareSetting.svelte` - 添加全局子文档分享开关
- [ ] `src/libs/components/ShareDialog.svelte` - 添加单次分享子文档选项
- [ ] `src/libs/components/SubdocumentTreePreview.svelte` - 创建子文档树预览组件

### 第6步: 国际化
- [ ] `src/i18n/en_US.json` - 添加 `subdocuments.xxx` 命名空间
- [ ] `src/i18n/zh_CN.json` - 添加中文对应文案

### 第7步: 测试
- [ ] 功能测试：100/500/999/无限制场景
- [ ] 深度测试：1-10层和无限深度
- [ ] 性能测试：1000+子文档分享性能
- [ ] 集成测试：与增量分享、引用文档分享协同

## 关键注意事项

### 性能优化
- 必须使用分页加载，避免一次性加载所有子文档导致内存溢出
- 实现5分钟缓存机制，减少重复SQL查询
- 使用Web Worker进行子文档树构建，不阻塞UI主线程
- 虚拟滚动支持大量子文档展示

### 风险提示
- 超过999个子文档时必须显示明确警告
- 启用无限深度时必须显示循环引用和性能风险警告
- 提供"仅分享首层子文档"快捷选项

### 异常处理
- 子文档已删除：跳过并记录日志
- 子文档权限不足：显示明确错误信息
- 网络异常：保存进度，支持断点续传

## 验收标准
完整的验收标准请参考：`openspec/changes/add-subdocument-sharing/tasks.md`

## 开发环境准备
```bash
# 验证提案
npx openspec validate add-subdocument-sharing --strict

# 查看相关文件
ls -la openspec/changes/add-subdocument-sharing/
```

## 下一步行动
1. 从第1步开始，按顺序实施
2. 每完成一个步骤，更新 `tasks.md` 中的复选框
3. 完成后运行 `npx openspec archive add-subdocument-sharing --yes`
4. 提交PR并关联openspec提案

---
**预计开发时间**: 2-3天
**优先级**: 中优先级（用户急需）
**风险**: 低（基于生产验证的SQL方案）