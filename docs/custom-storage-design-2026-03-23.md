# 自定义图床存储功能架构设计

> 版本：1.1.0  
> 日期：2026-03-23  
> 状态：设计阶段

## 一、功能概述

支持用户配置自定义图床存储后端，包括 **OpenList**、**RustFS** 两种平台，实现**图片和附件**资源的自主可控存储。

### 核心特性

- **文件类型**：支持 50MB 以内的所有附件类型（图片、视频、音频、文档等）
- **大小限制**：单文件最大 50MB，有效控制存储成本和性能
- **后端扩展**：已预留 `contentType` 字段，支持任意 MIME 类型

### 支持的存储平台

| 平台 | 类型 | 特点 | 适用场景 |
|------|------|------|----------|
| OpenList | 开源聚合平台 | 支持 30+ 种网盘、自部署、社区驱动 | 需要聚合多种网盘的场景 |
| RustFS | 自部署对象存储 | S3 兼容、高性能、Apache 2.0 许可 | 企业部署、私有云 |

> **暂不支持**：百度网盘（官方 API 不明确，个人项目成本考虑，后续再评估）

### 核心目标

1. **存储自主可控**：用户可选择将资源存储到自己的网盘或服务器
2. **无缝切换**：支持多种存储后端之间的平滑切换
3. **成本可控**：50MB 单文件限制，有效控制存储和带宽成本
4. **类型扩展**：不局限于图片，支持任意 MIME 类型附件
5. **易于扩展**：架构设计支持未来新增其他存储服务

---

## 二、整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    思源插件（本项目）                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │  StorageConfig  │    │  StorageSetting │    │  ShareApi    │ │
│  │  (配置模型)      │    │  (设置界面)      │    │  (API调用)   │ │
│  └────────┬────────┘    └────────┬────────┘    └──────┬───────┘ │
│           │                      │                     │        │
│           └──────────────────────┼─────────────────────┘        │
│                                  ▼                              │
│                    ┌─────────────────────────┐                  │
│                    │   ShareProConfig        │                  │
│                    │   storageConfig: {...}  │                  │
│                    └─────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────┘
                                   │
                                   │ HTTP API
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    后端服务（另一个项目）                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                 StorageService                           │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │    │
│  │  │ Default  │  │ OpenList │  │ RustFS   │              │    │
│  │  │ Storage  │  │ Adapter  │  │ Adapter  │              │    │
│  │  └──────────┘  └──────────┘  └──────────┘              │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 三、数据模型设计

### 3.1 存储类型枚举

```typescript
// src/types/storage-config.d.ts（新增文件）

/**
 * 存储后端类型
 */
export type StorageBackendType = 
  | "default"        // 默认存储（后端内置）
  | "openlist"       // OpenList 开源聚合平台
  | "rustfs"         // RustFS 自部署对象存储

/**
 * 存储后端状态
 */
export type StorageBackendStatus = 
  | "active"       // 激活使用中
  | "inactive"     // 未激活
  | "error"        // 错误状态
  | "migrating"    // 迁移中

/**
 * 文件上传限制常量
 */
export const STORAGE_LIMITS = {
  MAX_FILE_SIZE: 50 * 1024 * 1024,  // 50MB
  ALLOWED_TYPES: [
    // 图片
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
    // 视频
    "video/mp4", "video/webm", "video/quicktime",
    // 音频
    "audio/mpeg", "audio/wav", "audio/ogg",
    // 文档
    "application/pdf", 
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    // 压缩包
    "application/zip", "application/x-rar-compressed", "application/x-7z-compressed",
    // 其他
    "application/octet-stream",
  ]
} as const

/**
 * 存储后端健康检查结果
 */
export interface StorageHealthCheckResult {
  healthy: boolean
  latency?: number        // 响应延迟(ms)
  availableSpace?: number // 可用空间(bytes)
  totalSpace?: number     // 总空间(bytes)
  lastCheckTime: number   // 上次检查时间戳
  errorMessage?: string   // 错误信息
}
```

### 3.2 OpenList 配置

```typescript
/**
 * OpenList 配置
 * 
 * 项目地址：https://github.com/OpenListTeam/OpenList
 * 特点：AList 社区分支，支持 30+ 种网盘聚合，自部署
 * 支持存储：百度网盘、阿里云盘、OneDrive、Google Drive、S3 等
 */
export interface OpenListConfig {
  // 存储类型标识
  type: "openlist"
  
  // 存储名称（用户自定义，便于识别）
  name: string
  
  // OpenList 服务连接配置
  serverUrl: string       // OpenList 服务地址，如：https://openlist.example.com
  token: string           // OpenList API Token（加密存储）
  
  // 存储路径配置
  rootPath?: string       // 根路径，如：/share-pro/
  
  // 后端存储选择（OpenList 支持多种后端）
  storageDriver?: string  // 存储驱动名称，如："BaiduNetdisk"、"Aliyundrive"、"S3"
  storagePath?: string    // 存储路径
  
  // 高级配置
  maxFileSize?: number    // 单文件最大限制（字节）
  useProxy?: boolean      // 是否使用代理下载
  
  // 状态信息（只读，由后端维护）
  status?: StorageBackendStatus
  healthCheck?: StorageHealthCheckResult
}
```

### 3.3 RustFS 配置

```typescript
/**
 * RustFS 配置
 * 
 * 项目地址：https://github.com/rustfs/rustfs
 * 特点：Rust 编写、S3 兼容、高性能、Apache 2.0 许可
 * 性能：比 MinIO 快 2.3 倍（4KB 对象）
 */
export interface RustFSConfig {
  // 存储类型标识
  type: "rustfs"
  
  // 存储名称（用户自定义，便于识别）
  name: string
  
  // RustFS 连接配置
  endpoint: string        // 服务地址，如：https://rustfs.example.com
  port?: number           // 端口，默认 9000
  consolePort?: number    // 控制台端口，默认 9001
  useSSL: boolean         // 是否使用 SSL
  
  // 认证信息（S3 兼容）
  accessKey: string       // Access Key（加密存储）
  secretKey: string       // Secret Key（加密存储）
  
  // 存储桶配置
  bucket: string          // 存储桶名称
  region?: string         // 区域，默认 us-east-1
  
  // 路径配置
  rootPath?: string       // 根路径前缀，如：share-pro/
  
  // 高级配置
  maxFileSize?: number    // 单文件最大限制（字节）
  urlExpiry?: number      // 预签名 URL 过期时间（秒），默认 7天
  
  // 状态信息（只读，由后端维护）
  status?: StorageBackendStatus
  healthCheck?: StorageHealthCheckResult
}
```

### 3.4 统一存储配置

```typescript
/**
 * 存储配置（支持多后端）
 */
export interface StorageConfig {
  // 是否启用自定义存储（false 则使用默认存储）
  enabled: boolean
  
  // 当前激活的存储后端 ID
  activeBackendId: string
  
  // 存储后端列表
  backends: StorageBackendConfig[]
  
  // 默认存储配置（后端内置，无需配置）
  defaultConfig?: {
    type: "default"
    name: string  // 显示名称，如 "官方存储"
  }
  
  // 迁移配置
  migration?: StorageMigrationInfo
}

/**
 * 存储后端配置（联合类型）
 */
export type StorageBackendConfig = 
  | OpenListConfig
  | RustFSConfig
  | { type: "default"; name: string }

/**
 * 迁移信息
 */
export interface StorageMigrationInfo {
  inProgress: boolean
  sourceBackendId?: string
  targetBackendId?: string
  progress?: number        // 0-100
  startTime?: number
  errorMessage?: string
}
```

### 3.5 集成到 ShareProConfig

```typescript
// 修改 src/models/ShareProConfig.ts

import { StorageConfig } from "../types/storage-config"

class ShareProConfig {
  // ... 现有字段 ...
  
  /**
   * 自定义图床存储配置
   * @since 1.17.0
   */
  storageConfig?: StorageConfig
  
  // ... 其他字段 ...
}
```

---

## 四、API 接口设计

### 4.1 接口列表

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 存储列表 | POST | /api/storage/list | 获取所有存储后端 |
| 存储详情 | POST | /api/storage/get | 获取单个存储配置 |
| 添加存储 | POST | /api/storage/add | 添加新存储后端 |
| 更新存储 | POST | /api/storage/update | 更新存储配置 |
| 删除存储 | POST | /api/storage/delete | 删除存储后端 |
| 切换存储 | POST | /api/storage/switch | 切换激活存储 |
| 健康检查 | POST | /api/storage/healthCheck | 单个存储健康检查 |
| 批量检查 | POST | /api/storage/healthCheckAll | 所有存储健康检查 |
| 开始迁移 | POST | /api/storage/migration/start | 启动数据迁移 |
| 迁移状态 | POST | /api/storage/migration/status | 查询迁移进度 |
| 取消迁移 | POST | /api/storage/migration/cancel | 取消迁移任务 |
| 回滚迁移 | POST | /api/storage/migration/rollback | 回滚迁移 |

### 4.2 请求/响应结构

```typescript
// ============ 请求结构 ============

/** 添加存储后端请求 */
interface StorageAddRequest {
  type: StorageBackendType
  name: string
  config: Omit<OpenListConfig, "type" | "status" | "healthCheck">
        | Omit<RustFSConfig, "type" | "status" | "healthCheck">
}

/** 更新存储后端请求 */
interface StorageUpdateRequest {
  id: string
  config: Partial<OpenListConfig> | Partial<RustFSConfig>
}

/** 切换存储后端请求 */
interface StorageSwitchRequest {
  backendId: string
}

/** 迁移请求 */
interface MigrationStartRequest {
  sourceBackendId: string
  targetBackendId: string
  options?: {
    deleteSource?: boolean      // 迁移后删除源文件
    overwriteExisting?: boolean // 覆盖已存在文件
  }
}

// ============ 响应结构 ============

/** 存储后端列表响应 */
interface StorageListResponse {
  backends: Array<{
    id: string
    name: string
    type: StorageBackendType
    status: StorageBackendStatus
    healthCheck?: StorageHealthCheckResult
    createdAt: number
    updatedAt: number
  }>
  activeBackendId: string
}

/** 健康检查响应 */
interface HealthCheckResponse {
  backendId: string
  result: StorageHealthCheckResult
}

/** 迁移状态响应 */
interface MigrationStatusResponse {
  inProgress: boolean
  sourceBackendId?: string
  targetBackendId?: string
  progress: number
  totalFiles: number
  migratedFiles: number
  failedFiles: number
  startTime?: number
  estimatedEndTime?: number
  errors: Array<{
    file: string
    error: string
    time: number
  }>
}
```

### 4.3 ShareApi 扩展

```typescript
// 在 src/api/share-api.ts 中新增

enum StorageApiKeys {
  STORAGE_LIST = "/api/storage/list",
  STORAGE_GET = "/api/storage/get",
  STORAGE_ADD = "/api/storage/add",
  STORAGE_UPDATE = "/api/storage/update",
  STORAGE_DELETE = "/api/storage/delete",
  STORAGE_SWITCH = "/api/storage/switch",
  STORAGE_HEALTH_CHECK = "/api/storage/healthCheck",
  STORAGE_HEALTH_CHECK_ALL = "/api/storage/healthCheckAll",
  STORAGE_MIGRATION_START = "/api/storage/migration/start",
  STORAGE_MIGRATION_STATUS = "/api/storage/migration/status",
  STORAGE_MIGRATION_CANCEL = "/api/storage/migration/cancel",
  STORAGE_MIGRATION_ROLLBACK = "/api/storage/migration/rollback",
}

// ShareApi 类新增方法
class ShareApi {
  // 存储管理
  async getStorageList(): Promise<StorageListResponse>
  async addStorageBackend(request: StorageAddRequest): Promise<ServiceResponse>
  async updateStorageBackend(request: StorageUpdateRequest): Promise<ServiceResponse>
  async deleteStorageBackend(backendId: string): Promise<ServiceResponse>
  async switchStorageBackend(backendId: string): Promise<ServiceResponse>
  
  // 健康检查
  async checkStorageHealth(backendId: string): Promise<HealthCheckResponse>
  async checkAllStorageHealth(): Promise<HealthCheckResponse[]>
  
  // 迁移管理
  async startMigration(request: MigrationStartRequest): Promise<ServiceResponse>
  async getMigrationStatus(): Promise<MigrationStatusResponse>
  async cancelMigration(): Promise<ServiceResponse>
  async rollbackMigration(): Promise<ServiceResponse>
}
```

---

## 五、前端界面设计

### 5.1 设置页面布局

```
┌─────────────────────────────────────────────────────────────┐
│  存储设置                                                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  当前存储：[官方存储 ▼]    状态：● 正常    延迟：23ms         │
│  文件限制：单文件最大 50MB                                    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 存储后端列表                              [+ 添加]   │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ ○ 官方存储（默认）                    ● 正常  [切换] │    │
│  │   类型：默认存储  使用中                              │    │
│  │                                                      │    │
│  │ ○ OpenList 服务                      ● 正常  [切换] │    │
│  │   类型：OpenList  后端：阿里云盘                      │    │
│  │   [配置] [健康检查] [迁移] [删除]                     │    │
│  │                                                      │    │
│  │ ○ 公司 RustFS                        ⚠ 异常  [切换] │    │
│  │   类型：RustFS  连接超时                             │    │
│  │   [配置] [健康检查] [修复] [删除]                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 存储迁移                                             │    │
│  │ 从：[官方存储    ▼]  到：[OpenList服务 ▼]            │    │
│  │ [开始迁移]                                           │    │
│  │                                                      │    │
│  │ 迁移进度：████████░░░░░░░░ 45%  (450/1000 文件)     │    │
│  │ 预计剩余时间：约 15 分钟                              │    │
│  │ [暂停] [取消]                                        │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 添加存储表单 - 选择类型

```
┌─────────────────────────────────────────────────────────────┐
│  添加存储后端                                        [×]    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  选择存储类型：                                               │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  🔗 OpenList                                         │    │
│  │  开源聚合平台，支持 30+ 种网盘                        │    │
│  │  适合：需要聚合多种网盘的场景                         │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  🚀 RustFS                                           │    │
│  │  高性能 S3 兼容对象存储，比 MinIO 更快                │    │
│  │  适合：企业部署、私有云                               │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ⚠ 单文件限制：50MB                                          │
│                                                              │
│                              [取消]          [下一步]        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 OpenList 配置表单

```
┌─────────────────────────────────────────────────────────────┐
│  配置 OpenList                                       [×]    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  名称：      [我的 OpenList 服务   ]                         │
│                                                              │
│  ──────────── 服务连接 ────────────                          │
│  服务地址：  [https://openlist.example.com  ]                │
│  API Token： [••••••••••••••••    ] [显示]                   │
│                                                              │
│  ──────────── 后端存储 ────────────                          │
│  存储驱动：  [阿里云盘      ▼]  ← OpenList 支持的后端         │
│            可选：百度网盘、阿里云盘、OneDrive、S3 等          │
│  存储路径：  [/share-pro/        ]                           │
│                                                              │
│  ──────────── 高级设置 ────────────                          │
│  使用代理下载：[ ]                                            │
│  单文件上限：  [无限制]                                       │
│                                                              │
│                    [取消]  [保存并测试连接]                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.4 RustFS 配置表单

```
┌─────────────────────────────────────────────────────────────┐
│  配置 RustFS                                         [×]    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  名称：      [公司 RustFS 服务    ]                          │
│                                                              │
│  ──────────── 服务连接 ────────────                          │
│  服务地址：  [https://rustfs.example.com   ]                 │
│  端口：      [9000]    控制台端口：[9001]                     │
│  使用 SSL：  [✓]                                             │
│                                                              │
│  ──────────── 认证信息 ────────────                          │
│  Access Key：[rustfsadmin        ]                          │
│  Secret Key：[••••••••••••••••    ] [显示]                   │
│                                                              │
│  ──────────── 存储桶 ────────────                            │
│  存储桶：    [share-pro           ]                          │
│  区域：      [us-east-1           ]                          │
│  路径前缀：  [images/             ]                          │
│                                                              │
│  ──────────── 高级设置 ────────────                          │
│  预签名URL过期时间：[7] 天                                    │
│                                                              │
│                    [取消]  [保存并测试连接]                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 六、后端实现要点

### 6.1 存储适配器接口

```typescript
// 后端项目：存储适配器接口

interface StorageAdapter {
  // 基础操作
  upload(file: Buffer, path: string, options?: UploadOptions): Promise<UploadResult>
  download(path: string): Promise<Buffer>
  delete(path: string): Promise<void>
  exists(path: string): Promise<boolean>
  
  // 列表操作
  list(prefix: string): Promise<FileList>
  
  // URL 生成
  getPublicUrl(path: string): Promise<string>
  getSignedUrl(path: string, expiry?: number): Promise<string>
  
  // 健康检查
  healthCheck(): Promise<StorageHealthCheckResult>
  
  // 容量信息
  getStorageInfo(): Promise<StorageInfo>
}

// 实现类
class BaiduNetdiskAdapter implements StorageAdapter { /* 百度网盘 API */ }
class OpenListAdapter implements StorageAdapter { /* OpenList API */ }
class RustFSAdapter implements StorageAdapter { /* S3 兼容 API */ }
class DefaultStorageAdapter implements StorageAdapter { /* 默认存储 */ }
```

### 6.2 各平台适配要点

#### OpenList 适配器
- 统一 API 调用
- 支持多种后端存储驱动
- 代理下载支持
- 路径映射

#### RustFS 适配器
- S3 兼容 API（AWS SDK）
- 预签名 URL 生成
- 分片上传
- 版本控制支持

### 6.3 迁移服务

```typescript
// 后端项目：迁移服务

class StorageMigrationService {
  async startMigration(
    sourceAdapter: StorageAdapter,
    targetAdapter: StorageAdapter,
    options: MigrationOptions
  ): Promise<MigrationTask>
  
  async getProgress(taskId: string): Promise<MigrationProgress>
  async cancel(taskId: string): Promise<void>
  async rollback(taskId: string): Promise<void>
}
```

---

## 七、错误处理

### 7.1 错误码定义

```typescript
enum StorageErrorCode {
  // 配置错误
  CONFIG_INVALID = "STORAGE_CONFIG_INVALID",
  CONFIG_MISSING = "STORAGE_CONFIG_MISSING",
  
  // 连接错误
  CONNECTION_FAILED = "STORAGE_CONNECTION_FAILED",
  CONNECTION_TIMEOUT = "STORAGE_CONNECTION_TIMEOUT",
  AUTH_FAILED = "STORAGE_AUTH_FAILED",
  
  // 文件限制错误
  FILE_TOO_LARGE = "STORAGE_FILE_TOO_LARGE",        // 超过 50MB
  FILE_TYPE_NOT_ALLOWED = "STORAGE_FILE_TYPE_NOT_ALLOWED",
  
  // OpenList 特定错误
  OPENLIST_DRIVER_NOT_FOUND = "STORAGE_OPENLIST_DRIVER_NOT_FOUND",
  OPENLIST_AUTH_FAILED = "STORAGE_OPENLIST_AUTH_FAILED",
  
  // RustFS 特定错误
  RUSTFS_BUCKET_NOT_FOUND = "STORAGE_RUSTFS_BUCKET_NOT_FOUND",
  RUSTFS_ACCESS_DENIED = "STORAGE_RUSTFS_ACCESS_DENIED",
  
  // 迁移错误
  MIGRATION_IN_PROGRESS = "STORAGE_MIGRATION_IN_PROGRESS",
  MIGRATION_FAILED = "STORAGE_MIGRATION_FAILED",
  MIGRATION_ROLLBACK_FAILED = "STORAGE_MIGRATION_ROLLBACK_FAILED",
}
```

### 7.2 敏感信息加密

敏感字段列表：
- `token` - OpenList
- `secretKey` - RustFS

加密方式：使用后端提供的加密 API，前端不存储明文。

---

## 八、数据迁移方案

### 8.1 迁移流程

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ 准备阶段 │───▶│ 迁移阶段 │───▶│ 验证阶段 │───▶│ 完成阶段 │
└─────────┘    └─────────┘    └─────────┘    └─────────┘
     │              │              │              │
     ▼              ▼              ▼              ▼
  检查空间      分批上传文件    校验文件完整性  切换存储后端
  预估时间      更新进度       生成迁移报告    清理临时数据
  创建任务      错误重试       标记失败文件    可选删除源
```

### 8.2 回滚策略

1. **快照机制**：迁移前创建文件索引快照
2. **增量回滚**：仅回滚失败文件
3. **完整回滚**：恢复到迁移前状态

---

## 九、文件结构规划

```
src/
├── types/
│   ├── storage-config.d.ts     # 新增：存储配置类型定义
│   └── index.d.ts              # 修改：导出新类型
├── models/
│   └── ShareProConfig.ts       # 修改：添加 storageConfig
├── api/
│   └── share-api.ts            # 修改：添加存储相关 API
├── service/
│   └── StorageService.ts       # 新增：存储管理服务
└── libs/pages/setting/
    └── StorageSetting.svelte   # 新增：存储设置界面
```

---

## 十、实现优先级

| 阶段 | 任务 | 优先级 | 预计工时 |
|------|------|--------|----------|
| P0 | 类型定义文件创建 | 高 | 0.5天 |
| P0 | ShareProConfig 集成 | 高 | 0.5天 |
| P1 | ShareApi 扩展方法 | 高 | 1天 |
| P1 | 设置界面开发 | 中 | 2天 |
| P2 | 健康检查机制 | 中 | 1天 |
| P2 | 文件大小限制校验 | 中 | 0.5天 |
| P3 | 迁移功能 UI | 低 | 1天 |
| P3 | 错误处理完善 | 低 | 0.5天 |

**总计：约 7.5 天**

---

## 十一、风险评估

| 风险项 | 影响 | 缓解措施 |
|--------|------|----------|
| OpenList 版本兼容 | 中 | 文档标注支持的版本范围 |
| 大文件上传超时 | 中 | 50MB 限制、分片上传、断点续传 |
| 存储空间不足 | 中 | 迁移前空间检查、进度预警 |
| 敏感信息泄露 | 高 | 加密存储、不记录日志 |
| 文件类型校验绕过 | 中 | 后端二次校验 MIME 类型 |

---

## 十二、后续扩展

预留的扩展点：
1. **百度网盘** - 待官方 API 明确后评估
2. **阿里云 OSS** - S3 兼容，可直接复用 RustFS 适配器
3. **腾讯云 COS** - S3 兼容
4. **七牛云 Kodo** - S3 兼容
5. **又拍云** - 需要单独适配器

---

## 十三、参考链接

- [OpenList GitHub](https://github.com/OpenListTeam/OpenList)
- [OpenList 官方文档](https://openlistteam.github.io/OpenList/)
- [RustFS GitHub](https://github.com/rustfs/rustfs)
- [RustFS 官方文档](https://rustfs.com/docs)
