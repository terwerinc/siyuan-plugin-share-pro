## 1. 类型定义与数据模型

- [ ] 1.1 创建 `src/types/storage-config.d.ts`，定义 StorageBackendType、StorageBackendStatus、StorageConfig、OpenListConfig、RustFSConfig 等接口
- [ ] 1.2 定义 STORAGE_LIMITS 常量（50MB 文件限制、允许的 MIME 类型列表）
- [ ] 1.3 修改 `src/models/ShareProConfig.ts`，添加可选的 `storageConfig?: StorageConfig` 字段
- [ ] 1.4 验证类型定义导出到 `src/types/index.d.ts`

## 2. API 层扩展

- [ ] 2.1 在 `src/api/share-api.ts` 中新增 StorageApiKeys 枚举（11 个存储相关接口）
- [ ] 2.2 实现 `getStorageList()` 方法获取存储后端列表
- [ ] 2.3 实现 `addStorageBackend()` 方法添加存储后端
- [ ] 2.4 实现 `updateStorageBackend()` 方法更新存储配置
- [ ] 2.5 实现 `deleteStorageBackend()` 方法删除存储后端
- [ ] 2.6 实现 `switchStorageBackend()` 方法切换激活存储
- [ ] 2.7 实现 `checkStorageHealth()` 和 `checkAllStorageHealth()` 健康检查方法
- [ ] 2.8 实现迁移相关方法：`startMigration()`、`getMigrationStatus()`、`cancelMigration()`、`rollbackMigration()`

## 3. 服务层实现

- [ ] 3.1 创建 `src/service/StorageService.ts` 类
- [ ] 3.2 实现存储配置的 CRUD 操作方法
- [ ] 3.3 实现存储后端切换逻辑
- [ ] 3.4 实现健康检查调用和结果缓存
- [ ] 3.5 实现迁移任务管理（启动、状态查询、取消、回滚）
- [ ] 3.6 添加错误处理，映射 StorageErrorCode 到用户友好的错误消息

## 4. 前端界面开发

- [ ] 4.1 创建 `src/libs/pages/setting/StorageSetting.svelte` 组件
- [ ] 4.2 实现存储后端列表展示（名称、类型、状态、操作按钮）
- [ ] 4.3 实现添加存储对话框（选择类型：OpenList/RustFS）
- [ ] 4.4 实现 OpenList 配置表单（服务地址、Token、存储驱动、路径等）
- [ ] 4.5 实现 RustFS 配置表单（Endpoint、AccessKey、SecretKey、Bucket 等）
- [ ] 4.6 实现健康检查按钮和状态显示
- [ ] 4.7 实现存储切换功能
- [ ] 4.8 实现存储删除确认对话框
- [ ] 4.9 实现迁移 UI（源/目标选择、进度显示、控制按钮）

## 5. 国际化支持

- [ ] 5.1 在 `src/i18n/zh_CN.json` 中添加存储设置相关词条
- [ ] 5.2 在 `src/i18n/en_US.json` 中添加存储设置相关词条
- [ ] 5.3 确保所有用户可见字符串都使用 i18n 翻译

## 6. 集成与验证

- [ ] 6.1 在设置页面中集成 StorageSetting 组件
- [ ] 6.2 验证存储配置保存和读取正常
- [ ] 6.3 验证添加/编辑/删除存储后端功能正常
- [ ] 6.4 验证存储切换功能正常
- [ ] 6.5 验证健康检查功能正常
- [ ] 6.6 验证文件大小限制在前端正确校验
- [ ] 6.7 运行 ESLint 和 Prettier 检查代码规范
