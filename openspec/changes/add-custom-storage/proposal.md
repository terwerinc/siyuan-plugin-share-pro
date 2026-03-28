# Change: 添加自定义图床存储功能

## Why

当前插件仅支持默认的官方存储后端，用户无法将图片和附件资源存储到自己的网盘或私有服务器。为了满足用户对存储自主可控的需求，需要支持配置多种自定义存储后端（OpenList、RustFS），实现资源的自主可控存储。

## What Changes

- **新增存储配置类型定义**：创建 `src/types/storage-config.d.ts`，定义存储后端类型、配置接口和健康检查结果
- **扩展 ShareProConfig 模型**：在 `src/models/ShareProConfig.ts` 中添加 `storageConfig` 字段
- **扩展 ShareApi**：在 `src/api/share-api.ts` 中添加存储管理相关 API 方法（列表、添加、更新、删除、切换、健康检查、迁移）
- **新增 StorageService 服务层**：创建 `src/service/StorageService.ts`，封装存储管理业务逻辑
- **新增存储设置界面**：创建 `src/libs/pages/setting/StorageSetting.svelte`，提供存储配置 UI
- **支持存储后端**：
  - OpenList：开源聚合平台，支持 30+ 种网盘
  - RustFS：S3 兼容的高性能对象存储
- **文件限制**：单文件最大 50MB，支持图片、视频、音频、文档等多种类型
- **敏感信息加密**：Token 和 SecretKey 等敏感字段加密存储

## Impact

- **Affected specs**: storage（新增）
- **Affected code**:
  - `src/types/storage-config.d.ts`（新增）
  - `src/models/ShareProConfig.ts`（修改）
  - `src/api/share-api.ts`（修改）
  - `src/service/StorageService.ts`（新增）
  - `src/libs/pages/setting/StorageSetting.svelte`（新增）
  - `src/i18n/*.json`（新增国际化词条）
