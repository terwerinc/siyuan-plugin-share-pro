# 在线分享专业版（Share Pro）插件技术文档

<cite>
**本文档中引用的文件**
- [README.md](file://README.md)
- [plugin.json](file://plugin.json)
- [package.json](file://package.json)
- [src/index.ts](file://src/index.ts)
- [src/main.ts](file://src/main.ts)
- [src/topbar.ts](file://src/topbar.ts)
- [src/statusBar.ts](file://src/statusBar.ts)
- [src/models/ShareProConfig.ts](file://src/models/ShareProConfig.ts)
- [src/models/AppConfig.ts](file://src/models/AppConfig.ts)
- [src/models/SingleDocSetting.ts](file://src/models/SingleDocSetting.ts)
- [src/models/ShareOptions.ts](file://src/models/ShareOptions.ts)
- [src/service/ShareService.ts](file://src/service/ShareService.ts)
- [src/service/IncrementalShareService.ts](file://src/service/IncrementalShareService.ts)
- [src/utils/ShareConfigUtils.ts](file://src/utils/ShareConfigUtils.ts)
- [src/libs/pages/ShareSetting.svelte](file://src/libs/pages/ShareSetting.svelte)
- [docs/TODO.md](file://docs/TODO.md)
- [docs/document-tree-fix-plan-2026-03-21.md](file://docs/document-tree-fix-plan-2026-03-21.md)
- [docs/incremental-share-context-2025-12-04.md](file://docs/incremental-share-context-2025-12-04.md)
- [docs/incremental-share-context-2025-12-09.md](file://docs/incremental-share-context-2025-12-09.md)
- [docs/progress-implementation-2026-03-20.md](file://docs/progress-implementation-2026-03-20.md)
- [docs/universal-progress-with-share-and-media-2026-03-21.md](file://docs/universal-progress-with-share-and-media-2026-03-21.md)
- [docs/subdocument-share-context-2026-02-28.md](file://docs/subdocument-share-context-2026-02-28.md)
- [src/libs/pages/IncrementalShareUI.svelte](file://src/libs/pages/IncrementalShareUI.svelte)
- [src/libs/pages/setting/IncrementalShareSetting.svelte](file://src/libs/pages/setting/IncrementalShareSetting.svelte)
- [src/libs/pages/setting/BlacklistSetting.svelte](file://src/libs/pages/setting/BlacklistSetting.svelte)
- [index.styl](file://index.styl)
</cite>

## 更新摘要
**所做更改**
- 更新了 Todo List 文档，从中文转换为英文，内容升级为结构化项目路线图
- 添加了详细的版本规划和功能分类体系
- 更新了增量分享功能的实现状态和架构改进
- 添加了统一进度管理系统的详细技术实现
- 更新了文档树修复计划的技术架构分析
- 添加了子文档分享功能的完整实现说明

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构概览](#架构概览)
5. [详细组件分析](#详细组件分析)
6. [依赖分析](#依赖分析)
7. [性能考虑](#性能考虑)
8. [故障排除指南](#故障排除指南)
9. [项目路线图](#项目路线图)
10. [结论](#结论)

## 简介

在线分享专业版（Share Pro）是一个专为思源笔记（SiYuan Note）设计的强大插件，旨在提供一键式文档分享功能。该插件支持多种分享模式，包括单文档分享、批量分享、增量分享以及高级配置管理。

### 主要特性

- **一键分享**：支持单击即可分享思源笔记
- **多文档分享**：支持子文档和引用文档的批量分享
- **增量分享**：智能检测文档变更并进行增量同步
- **高级配置**：支持主题定制、SEO优化、密码保护等功能
- **黑名单管理**：可配置文档黑名单，避免不必要的分享
- **进度监控**：实时显示分享进度和状态

**章节来源**
- [README.md:1-21](file://README.md#L1-L21)
- [plugin.json:1-35](file://plugin.json#L1-L35)

## 项目结构

该项目采用模块化的架构设计，主要分为以下几个核心部分：

```mermaid
graph TB
subgraph "核心入口"
A[src/index.ts] --> B[src/main.ts]
B --> C[src/topbar.ts]
end
subgraph "配置管理"
D[src/models/ShareProConfig.ts] --> E[src/models/AppConfig.ts]
F[src/utils/ShareConfigUtils.ts] --> G[src/models/SingleDocSetting.ts]
end
subgraph "服务层"
H[src/service/ShareService.ts] --> I[src/service/IncrementalShareService.ts]
J[src/service/LocalBlacklistService.ts] --> K[src/service/LocalShareHistory.ts]
end
subgraph "界面层"
L[src/libs/pages/ShareSetting.svelte] --> M[src/newUI.ts]
N[src/statusBar.ts] --> O[src/invoke/widgetInvoke.ts]
end
subgraph "工具类"
P[src/utils/ApiUtils.ts] --> Q[src/utils/ImageUtils.ts]
R[src/utils/progress/] --> S[src/workers/change-detection.worker.ts]
end
A --> D
A --> H
C --> L
C --> N
```

**图表来源**
- [src/index.ts:1-178](file://src/index.ts#L1-L178)
- [src/main.ts:1-34](file://src/main.ts#L1-L34)
- [src/topbar.ts:1-297](file://src/topbar.ts#L1-L297)

**章节来源**
- [package.json:1-54](file://package.json#L1-L54)

## 核心组件

### 插件主类（ShareProPlugin）

ShareProPlugin是整个插件的核心控制器，负责协调各个组件的工作。

```mermaid
classDiagram
class ShareProPlugin {
-logger : ILogger
-isMobile : boolean
-statusBarElement : any
-main : Main
-shareService : ShareService
-settingService : SettingService
-incrementalShareService : IncrementalShareService
+constructor(options)
+onload()
+onunload()
+openSetting()
+getDefaultCfg()
+safeLoad(storeName)
+safeParse(str, def)
+showIncrementalShareUI()
}
class Main {
-pluginInstance : ShareProPlugin
-topbar : Topbar
+start()
+showIncrementalShareUI()
}
class Topbar {
-logger : ILogger
-pluginInstance : ShareProPlugin
-shareService : ShareService
-widgetInvoke : WidgetInvoke
-lock : boolean
+initTopbar()
+showIncrementalShareUI()
}
ShareProPlugin --> Main : "包含"
ShareProPlugin --> Topbar : "初始化"
Main --> Topbar : "创建"
```

**图表来源**
- [src/index.ts:33-178](file://src/index.ts#L33-L178)
- [src/main.ts:12-34](file://src/main.ts#L12-L34)
- [src/topbar.ts:26-98](file://src/topbar.ts#L26-L98)

### 配置管理系统

插件使用分层配置系统来管理各种设置：

```mermaid
classDiagram
class ShareProConfig {
+siyuanConfig : SiyuanConfig
+serviceApiConfig : IServiceApiConfig
+appConfig : AppConfig
+isCustomCssEnabled : boolean
+isNewUIEnabled : boolean
+inited : boolean
}
class AppConfig {
+lang : string
+siteUrl : string
+theme : ThemeConfig
+domains : string[]
+incrementalShareConfig : IncrementalShareConfig
+shareSubdocuments : boolean
+shareReferences : boolean
}
class IncrementalShareConfig {
+enabled : boolean
+lastShareTime : number
+notebookBlacklist : BlacklistItem[]
}
class SingleDocSetting {
+docTreeEnable : boolean
+outlineEnable : boolean
+expiresTime : number|string
+shareSubdocuments : boolean
+maxSubdocuments : number
+shareReferences : boolean
+selectedSubdocIds : string[]
}
ShareProConfig --> AppConfig : "包含"
AppConfig --> IncrementalShareConfig : "包含"
ShareProConfig --> SingleDocSetting : "影响"
```

**图表来源**
- [src/models/ShareProConfig.ts:13-40](file://src/models/ShareProConfig.ts#L13-L40)
- [src/models/AppConfig.ts:12-88](file://src/models/AppConfig.ts#L12-L88)
- [src/models/SingleDocSetting.ts:17-93](file://src/models/SingleDocSetting.ts#L17-L93)

**章节来源**
- [src/models/ShareProConfig.ts:1-40](file://src/models/ShareProConfig.ts#L1-L40)
- [src/models/AppConfig.ts:1-88](file://src/models/AppConfig.ts#L1-L88)
- [src/models/SingleDocSetting.ts:1-93](file://src/models/SingleDocSetting.ts#L1-L93)

## 架构概览

插件采用分层架构设计，确保各组件职责清晰、耦合度低：

```mermaid
graph TB
subgraph "表现层"
UI[用户界面]
Topbar[顶部栏]
StatusBar[状态栏]
Settings[设置页面]
end
subgraph "业务逻辑层"
ShareService[分享服务]
IncrementalShareService[增量分享服务]
SettingService[设置服务]
BlacklistService[黑名单服务]
end
subgraph "数据访问层"
LocalStorage[本地存储]
API[远程API]
History[历史记录]
Config[配置管理]
end
subgraph "工具层"
Utils[工具类]
Workers[Web Workers]
Composables[组合式函数]
end
UI --> Topbar
Topbar --> ShareService
Topbar --> Settings
Settings --> SettingService
ShareService --> IncrementalShareService
ShareService --> LocalStorage
IncrementalShareService --> API
SettingService --> Config
ShareService --> Utils
IncrementalShareService --> Workers
ShareService --> Composables
```

**图表来源**
- [src/index.ts:33-178](file://src/index.ts#L33-L178)
- [src/service/ShareService.ts:40-1112](file://src/service/ShareService.ts#L40-L1112)
- [src/service/IncrementalShareService.ts:98-690](file://src/service/IncrementalShareService.ts#L98-L690)

## 详细组件分析

### 分享服务（ShareService）

ShareService是插件的核心业务逻辑组件，负责处理所有分享相关的操作。

```mermaid
sequenceDiagram
participant User as 用户
participant Topbar as 顶部栏
participant ShareService as 分享服务
participant SiyuanAPI as 思源API
participant RemoteAPI as 远程API
participant Storage as 存储
User->>Topbar : 点击分享按钮
Topbar->>ShareService : createShare(docId)
ShareService->>ShareService : 检查批量处理需求
alt 单文档分享
ShareService->>Storage : 更新文档设置
ShareService->>SiyuanAPI : 获取文档内容
ShareService->>ShareService : 构建分享内容
ShareService->>RemoteAPI : 创建分享
RemoteAPI-->>ShareService : 返回分享结果
ShareService->>Storage : 更新历史记录
ShareService-->>Topbar : 分享成功
else 多文档分享
ShareService->>ShareService : 扁平化文档列表
ShareService->>ShareService : 批量处理文档
loop 并发处理
ShareService->>SiyuanAPI : 获取文档内容
ShareService->>RemoteAPI : 创建分享
end
ShareService-->>Topbar : 批量分享完成
end
```

**图表来源**
- [src/service/ShareService.ts:70-84](file://src/service/ShareService.ts#L70-L84)
- [src/service/ShareService.ts:244-283](file://src/service/ShareService.ts#L244-L283)
- [src/service/ShareService.ts:288-334](file://src/service/ShareService.ts#L288-L334)

#### 核心功能特性

1. **智能文档收集**：支持子文档和引用文档的自动收集
2. **批量处理**：支持并发控制的批量分享
3. **媒体资源处理**：自动处理图片等媒体资源
4. **进度监控**：提供详细的分享进度反馈
5. **错误处理**：完善的异常处理和重试机制

**章节来源**
- [src/service/ShareService.ts:1-1112](file://src/service/ShareService.ts#L1-L1112)

### 增量分享服务（IncrementalShareService）

IncrementalShareService专门处理增量分享功能，能够智能检测文档变更并进行增量同步。

```mermaid
flowchart TD
Start([开始增量分享]) --> CheckConfig[检查配置]
CheckConfig --> DetectPage[检测文档变更]
DetectPage --> CollectDocs[收集变更文档]
CollectDocs --> CheckBlacklist{检查黑名单}
CheckBlacklist --> |在黑名单| SkipDoc[跳过文档]
CheckBlacklist --> |不在黑名单| AddToQueue[加入队列]
SkipDoc --> NextDoc[下一个文档]
AddToQueue --> NextDoc
NextDoc --> MoreDocs{还有文档?}
MoreDocs --> |是| DetectPage
MoreDocs --> |否| ProcessQueue[处理队列]
ProcessQueue --> ConcurrencyControl[并发控制]
ConcurrencyControl --> RetryMechanism[重试机制]
RetryMechanism --> UpdateHistory[更新历史记录]
UpdateHistory --> End([结束])
```

**图表来源**
- [src/service/IncrementalShareService.ts:160-210](file://src/service/IncrementalShareService.ts#L160-L210)
- [src/service/IncrementalShareService.ts:269-351](file://src/service/IncrementalShareService.ts#L269-L351)
- [src/service/IncrementalShareService.ts:396-474](file://src/service/IncrementalShareService.ts#L396-L474)

#### 增量分享特性

1. **智能缓存**：5分钟缓存机制减少重复计算
2. **并发控制**：最多5个并发任务，避免服务器压力
3. **队列管理**：支持任务暂停、恢复和状态跟踪
4. **智能重试**：针对不同错误类型采用不同的重试策略
5. **黑名单过滤**：支持笔记本级别的黑名单管理

**章节来源**
- [src/service/IncrementalShareService.ts:1-690](file://src/service/IncrementalShareService.ts#L1-L690)

### 设置界面（ShareSetting）

ShareSetting提供了完整的设置管理界面，采用标签页形式组织各种设置选项。

```mermaid
classDiagram
class ShareSetting {
+pluginInstance : ShareProPlugin
+dialog : Dialog
+vipInfo : KeyInfo
+activeTab : number
+tabs : Tab[]
+init()
+handleTabChange(e)
}
class Tab {
+label : string
+content : Component
+props : Object
}
class BasicSetting {
+基础设置表单
}
class CustomSetting {
+个性化设置
}
class DocSetting {
+文档设置
}
class SeoSetting {
+SEO设置
}
class IncrementalShareSetting {
+增量分享设置
}
class BlacklistSetting {
+黑名单管理
}
ShareSetting --> Tab : "创建"
ShareSetting --> BasicSetting : "包含"
ShareSetting --> CustomSetting : "包含"
ShareSetting --> DocSetting : "包含"
ShareSetting --> SeoSetting : "包含"
ShareSetting --> IncrementalShareSetting : "包含"
ShareSetting --> BlacklistSetting : "包含"
```

**图表来源**
- [src/libs/pages/ShareSetting.svelte:10-119](file://src/libs/pages/ShareSetting.svelte#L10-L119)

**章节来源**
- [src/libs/pages/ShareSetting.svelte:1-119](file://src/libs/pages/ShareSetting.svelte#L1-L119)

## 依赖分析

### 核心依赖关系

```mermaid
graph TB
subgraph "外部依赖"
Siyuan[siyuan@^1.1.6]
Svelte[svelte@^4.2.20]
ZhiLib[zhi-lib-base@^0.8.0]
ZhiAPI[zhi-siyuan-api@^2.33.0]
BlogAPI[zhi-blog-api@^1.74.2]
end
subgraph "内部模块"
Index[src/index.ts]
Services[src/service/]
Models[src/models/]
Utils[src/utils/]
Libs[src/libs/]
end
subgraph "构建工具"
Vite[vite@^5.4.21]
TypeScript[typescript@^5.9.3]
Stylus[stylus@^0.64.0]
end
Index --> Services
Services --> Models
Services --> Utils
Libs --> Svelte
Index --> Siyuan
Services --> ZhiAPI
Services --> BlogAPI
Utils --> ZhiLib
Build[Vite配置] --> Vite
Build --> TypeScript
Build --> Stylus
```

**图表来源**
- [package.json:22-54](file://package.json#L22-L54)

### 版本兼容性

插件对不同版本的依赖关系如下：

| 组件 | 版本要求 | 用途 |
|------|----------|------|
| siyuan | ^1.1.6 | 思源笔记API接口 |
| svelte | ^4.2.20 | 前端UI框架 |
| zhi-lib-base | ^0.8.0 | 基础工具库 |
| zhi-siyuan-api | ^2.33.0 | 思源API封装 |
| zhi-blog-api | ^1.74.2 | 博客API接口 |

**章节来源**
- [package.json:1-54](file://package.json#L1-L54)

## 性能考虑

### 并发控制策略

插件采用了多层次的并发控制策略来确保性能和稳定性：

1. **批量分享并发**：默认最多10个并发任务
2. **增量分享并发**：默认最多5个并发任务
3. **媒体处理并发**：每次最多5个媒体文件同时处理
4. **API调用限制**：避免对远程服务器造成过大压力

### 缓存机制

```mermaid
flowchart LR
subgraph "缓存层次"
A[内存缓存] --> B[本地存储缓存]
B --> C[远程API缓存]
end
subgraph "缓存策略"
D[5分钟缓存失效]
E[按需刷新]
F[手动清除]
end
A --> D
B --> E
C --> F
```

### 内存管理

- **Web Worker**：使用Web Worker处理大数据量的变更检测
- **渐进式加载**：分页加载文档列表，避免内存溢出
- **及时清理**：任务完成后及时释放内存资源

## 故障排除指南

### 常见问题及解决方案

| 问题类型 | 症状 | 解决方案 |
|----------|------|----------|
| 分享失败 | 提示网络错误或超时 | 检查网络连接，查看重试日志 |
| 文档未更新 | 增量分享未检测到变更 | 清除缓存，检查文档修改时间 |
| 媒体资源缺失 | 图片显示为占位符 | 检查媒体URL，确认资源可用性 |
| 设置不生效 | 配置更改后无变化 | 重启插件，检查配置同步 |

### 调试模式

插件支持开发模式，在开发模式下会：
- 输出详细的日志信息
- 启用调试功能
- 使用测试环境API

**章节来源**
- [src/index.ts:150-169](file://src/index.ts#L150-L169)

## 项目路线图

### 版本规划与功能分类

#### 1.16.0 版本 - 核心功能完成

**已完成的核心功能**：
- ✅ 实现引用文档分享功能（递归分享引用文档及其子文档）
- ✅ 实现子文档分享功能（递希笔记及其所有子文档）
- ✅ 实现增量分享功能（仅分享变更文档）
- ✅ 实现黑名单管理功能（支持笔记本和文档级别）

**进度管理与错误处理**：
- ✅ 实现多文档分享进度管理（右下角进度弹窗）
- ✅ 实现文档级错误状态隔离（A文档错误不污染B文档）
- ✅ 实现上次分享时间显示（灰色辅助文本）
- ✅ 实现错误详情弹窗（使用 Confirm.svelte 标准组件）
- ✅ 实现错误状态持久化（关闭弹窗后错误横幅仍显示）
- ✅ 实现"我知道了"错误确认机制

**黑名单管理修复**：
- ✅ 修复黑名单删除功能失效问题（ID与类型丢失）
- ✅ 修复黑名单全选功能失效问题（表头复选框无事件绑定）
- ✅ 修复复选框状态持久化问题（切换分页后选择丢失）
- ✅ 修复 DTO 转换中 id 字段硬编码问题

**国际化与代码规范**：
- ✅ 移除所有 i18n fallback 机制（严格国际化规范）
- ✅ 重构错误详情弹窗使用 Confirm.svelte 标准组件
- ✅ 修复 Svelte 可访问性警告（a11y-label-has-associated-control 等）

#### 1.17.0 版本 - 规划中 📋

**体验优化（参考飞书/钉钉/Notion 付费产品标准）**

**空状态与引导**：
- [ ] 实现首次使用引导（Onboarding Flow）
  - 参考：飞书文档首次使用时的分步引导
  - 参考：Notion 的模板引导流程
  - 实现：首次打开分享功能时显示功能介绍浮层
  - 实现：关键操作（添加黑名单、分享文档）的引导提示

- [ ] 实现空状态设计（Empty State）
  - 参考：钉钉文档空状态的插画+文案设计
  - 参考：语雀空状态的友好提示
  - 实现：黑名单为空时的引导添加界面
  - 实现：分享历史为空时的引导分享界面
  - 实现：无子文档/引用文档时的友好提示

**数据可视化**：
- [ ] 实现分享历史查询界面
  - 参考：飞书多维表格的筛选器设计
  - 功能：按时间范围、文档类型、分享状态筛选
  - 功能：关键词搜索（文档名、ID、备注）
  - 功能：导出 CSV（带进度提示）
  - 功能：分页加载（虚拟滚动优化大数据量）

- [ ] 实现统计报表页面
  - 参考：钉钉管理后台的数据看板
  - 参考：Notion 的图表组件
  - 功能：分享趋势图（日/周/月维度）
  - 功能：Top 10 分享文档排行
  - 功能：分享成功率统计
  - 功能：错误类型分布饼图

**快捷操作**：
- [ ] 实现右键菜单快速添加黑名单
  - 参考：飞书文档的右键菜单设计
  - 功能：在文档树右键直接添加到黑名单
  - 功能：在分享界面右键排除文档
  - 功能：批量右键操作（多选后右键）

**核心功能完善**

**数据一致性**：
- [ ] 实现数据一致性检查机制
  - 参考：阿里 OSS 的数据校验机制
  - 功能：定时 24 小时自动校验分享数据
  - 功能：手动触发一致性检查
  - 功能：差异报告与一键修复

**分享安全**：
- [ ] 实现分享链接安全增强
  - 参考：腾讯文档的链接权限管理
  - 功能：分享链接有效期设置（1天/7天/30天/永久）
  - 功能：分享链接访问密码
  - 功能：分享链接访问次数限制

**性能优化**：
- [ ] 实现大数据量分享优化
  - 参考：字节跳动文档的分片上传机制
  - 功能：超大量子文档分批处理
  - 功能：进度保存与断点续传
  - 功能：后台静默分享模式

**其他规划**：
- callout（预研）
- 自定义图床存储- 百度网盘（openlist）、自部署 minio（待排期）
- 给予现有的发布，看看能不能扩展（预研）
- 基于分享笔记的语义问答

**长期规划**：
- [ ] 2.0 版本愿景
  - 智能分享推荐（基于文档关联度AI推荐）
  - 团队协作分享（支持多人协作分享空间）
  - 分享内容版本管理（历史版本对比与回滚）
  - 跨平台分享（支持导出为多种格式）

**章节来源**
- [docs/TODO.md:1-120](file://docs/TODO.md#L1-L120)

## 统一进度管理系统

### 核心问题分析

当前系统存在两个核心问题：

1. **showMessage 消息通知混乱问题**
   - 消息通知混乱：批量分享时会显示多个 showMessage 通知条（黑条），造成界面混乱
   - 进度显示位置不当：进度信息显示在子文档树下方，容易被遮挡看不到
   - 频繁通知干扰：每个文档处理都会触发 showMessage，对于大量文档会造成频繁的视觉干扰

2. **资源处理与进度管理不同步问题**
   - 进度提前结束：文档分享完成后立即显示成功消息，但资源文件（媒体上传）仍在异步处理中
   - 错误不反馈：资源上传失败时（如 "[share-pro] [2026-03-21 00:11:17] [ERROR] [share-service] 第1组媒体上传失败=>Some assets failed to upload"），前台仍然显示成功，这是绝对错误的
   - 用户体验不一致：用户看到成功提示，但实际上部分资源可能上传失败

### 解决方案概述

采用**事件驱动的资源通知机制**，让异步的资源处理能够主动通知 ProgressManager 其状态变化，从而实现：

1. 保持资源处理的异步性（使用 void 调用）
2. 实时更新资源处理进度到进度条
3. 确保进度条在资源处理完成前保持打开状态
4. 正确聚合和反馈资源处理错误

### 技术实现细节

**创建资源事件系统**：
- 文件路径：`src/utils/progress/ResourceEventEmitter.ts`
- 提供事件发射器用于资源处理状态通知
- 定义标准事件类型（开始、进度、错误、完成）

**扩展 ProgressState 接口**：
- 新增字段：totalResources、completedResources、resourceErrors、isResourceProcessing、documentsCompleted
- 支持资源处理状态的完整跟踪

**增强 ProgressManager 类**：
- 监听资源事件：在 startBatch 时注册资源事件监听器
- 状态协调逻辑：实现智能的完成判断机制
- 资源进度更新：处理资源进度和错误事件

**修改 processAllMediaResources 方法**：
- 在资源处理过程中触发相应的事件
- 保持异步调用方式不变
- 实现资源处理的事件通知

**智能自动关闭策略**：
- 成功场景：只有当状态为 "success" 且没有文档错误、资源错误时才自动关闭（5秒后）
- 失败场景：任何错误（文档错误、资源错误、状态为 "error"）都会禁用自动关闭，界面持久显示
- 手动关闭：右上角的 X 按钮作为手动关闭入口，失败场景下用户必须主动点击 X 才能关闭

**章节来源**
- [docs/universal-progress-with-share-and-media-2026-03-21.md:1-366](file://docs/universal-progress-with-share-and-media-2026-03-21.md#L1-L366)

## 文档树修复计划

### 根本性设计缺陷修复方案

#### 背景和问题分析

**现有的文档树实现是"假的"文档树**：
- 现有实现方式：当前的文档树实现仅基于文档路径（hpath）的字符串分割，无法反映真实的文档关系
- 缺少关键文档关系：无法显示同级文档（siblings）、子级文档（children）和父级文档（parents）的真实层级结构
- 用户体验误导：用户期望看到完整的文档树结构，但实际只看到路径分解，这严重违背了用户预期

#### 用户期望的文档树结构
用户期望的文档树应该显示：
- 同级文档：同一父目录下的其他文档
- 子级文档：当前文档下的所有子文档
- 父级文档：当前文档的父目录、祖父目录等
- 根据深度级别控制：支持指定深度级别的文档树展示（1-6级）

#### 解决方案概述

重构文档树生成逻辑，使用思源官方API获取真实的文档关系结构，实现完整的文档树展示。

**核心设计原则**：
1. 真实文档关系：使用思源官方 `/api/filetree/listDocsByPath` API 获取真实的文档树结构
2. 完整层级展示：同时显示父级、同级、子级文档
3. 深度级别控制：支持指定深度级别的文档树展示
4. 最小化改动：基于现有架构进行扩展，避免大规模重构

#### 详细实施方案

**1. 重构 SiYuanApiAdaptor 中的文档树实现**

**文件路径**: `zhi-siyuan-api/src/lib/adaptor/siYuanApiAdaptor.ts`

**关键修改**:
- 移除基于路径的假文档树实现（行183-234）
- 集成真实的文档树获取逻辑

```typescript
// 在 getPost 方法中替换原有的文档树逻辑
// 处理文档树
let docTree = []
let docTreeLevel = 3
if (this.cfg?.preferenceConfig?.docTreeEnable) {
  docTreeLevel = this.cfg?.preferenceConfig?.docTreeLevel ?? 3

  // 获取文档的基本信息
  const notebookId = siyuanPost.box || ""
  const docPath = siyuanPost.path || `/${siyuanPost.root_id}.sy`

  // 构建完整的文档树结构
  // 1. 获取父级路径信息
  const pathParts = docPath.replace(".sy", "").split("/").filter(part => part.trim() !== "")
  const parentPaths = []
  for (let i = 0; i < pathParts.length - 1 && i < docTreeLevel; i++) {
    parentPaths.push({
      id: pathParts[i],
      parentId: i > 0 ? pathParts[i - 1] : "",
      name: pathParts[i],
      depth: i,
      type: "parent"
    })
  }

  // 2. 获取同级文档（父目录下的其他文档）
  const parentPath = pathParts.slice(0, -1).join("/")
  const siblings = await this.siyuanKernelApi.getSiblingDocs(notebookId, parentPath)

  // 3. 获取子级文档（当前文档下的所有子文档）
  const children = await this.siyuanKernelApi.getChildDocs(notebookId, docPath, docTreeLevel)

  // 4. 合并所有文档树节点
  docTree = [...parentPaths, ...siblings, ...children]
  this.logger.info("检测到配置，真实的文档树已获取")
}
```

**2. 增强 SiyuanKernelApi 的文档树功能**

**文件路径**: `zhi-siyuan-api/src/lib/kernel/siyuanKernelApi.ts`

**关键修改**:
- 添加 `getSiblingDocs` 方法：获取指定路径下同级文档
- 添加 `getChildDocs` 方法：获取指定文档的子级文档（支持深度控制）

```typescript
// 获取同级文档（父目录下的其他文档）
public async getSiblingDocs(notebook: string, parentPath: string): Promise<any[]> {
  if (!parentPath || parentPath === "/") {
    return [] // 根目录没有同级文档
  }

  const response = await this.siyuanRequest("/api/filetree/listDocsByPath", {
    notebook: notebook,
    path: parentPath
  })

  if (!response || !Array.isArray(response.files)) {
    return []
  }

  return response.files.map(file => ({
    id: file.id,
    parentId: parentPath.split("/").pop() || "",
    name: file.name.replace(".sy", ""),
    depth: 0, // 同级文档深度为0
    type: "sibling"
  }))
}

// 获取子级文档（递归到指定深度）
public async getChildDocs(notebook: string, docPath: string, maxDepth: number = 3): Promise<any[]> {
  const children = []
  await this._recursiveGetChildren(notebook, docPath, children, 1, maxDepth)
  return children
}

private async _recursiveGetChildren(notebook: string, currentPath: string, result: any[], currentDepth: number, maxDepth: number): Promise<void> {
  if (currentDepth > maxDepth) {
    return
  }

  const response = await this.siyuanRequest("/api/filetree/listDocsByPath", {
    notebook: notebook,
    path: currentPath
  })

  if (!response || !Array.isArray(response.files)) {
    return
  }

  for (const file of response.files) {
    const filePath = file.path
    const fileName = file.name.replace(".sy", "")
    const pathParts = filePath.replace(".sy", "").split("/").filter(part => part.trim() !== "")
    const parentId = pathParts[pathParts.length - 2] || ""

    result.push({
      id: file.id,
      parentId: parentId,
      name: fileName,
      depth: currentDepth,
      type: "child",
      hasChildren: (file.subFileCount || 0) > 0
    })

    // 递归获取子文档
    if ((file.subFileCount || 0) > 0) {
      await this._recursiveGetChildren(notebook, filePath, result, currentDepth + 1, maxDepth)
    }
  }
}
```

#### 关键文件修改清单

1. **修改文件**:
   - `zhi-siyuan-api/src/lib/adaptor/siYuanApiAdaptor.ts` - 重构文档树实现，使用真实API
   - `zhi-siyuan-api/src/lib/kernel/siyuanKernelApi.ts` - 增强文档树功能，添加获取同级和子级文档的方法

#### 测试验证方案

**功能测试**：
1. 文档树结构验证：
   - 验证文档树显示真实的同级、子级、父级文档
   - 验证不同深度级别的文档树展示（1-6级）
   - 验证文档树与文档大纲功能的一致性
   - 验证文档树在分享页面的正确显示

2. 边界情况测试：
   - 根目录文档的文档树显示
   - 没有子文档的文档树显示
   - 深度级别为1时的文档树显示
   - 深度级别为6时的文档树显示

**回归测试**：
- 确保现有文档分享功能不受影响
- 验证文档级别和全局配置的优先级逻辑
- 验证子文档分享和引用文档分享功能

#### 实施优先级

1. **第一阶段**：增强 SiyuanKernelApi 的文档树功能（添加 getSiblingDocs 和 getChildDocs 方法）
2. **第二阶段**：重构 SiYuanApiAdaptor 中的文档树实现
3. **第三阶段**：全面测试和验证

这个方案完全满足用户需求：
- ✅ 文档树显示真实的文档关系（同级、子级、父级）
- ✅ 支持指定深度级别的文档树展示
- ✅ 提供符合付费软件标准的专业用户体验

**章节来源**
- [docs/document-tree-fix-plan-2026-03-21.md:1-188](file://docs/document-tree-fix-plan-2026-03-21.md#L1-L188)

## 子文档分享功能实现

### 核心架构设计

**三层配置架构**（已正确实现）

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

### 关键技术实现

**子文档获取方法（实际实现）**：

根据 `src/composables/useSiyuanApi.ts` 中的实际代码：

**获取子文档总数**：
```typescript
// 获取指定文档的子文档总数
const sql = `
  SELECT COUNT(DISTINCT b1.root_id) AS count
  FROM blocks b1
  WHERE b1.root_id = '${escapedDocId}' OR b1.path LIKE '%/${escapedDocId}%'
`;
```

**分页获取子文档列表**：
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

### 配置默认值

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `shareSubdocuments` | `true` | 子文档分享默认开启 |
| `maxSubdocuments` | `100` | 默认分享100个子文档 |
| `docTreeLevel` | `3` | 文档树深度默认3层 |
| `outlineLevel` | `6` | 文档大纲深度默认6层 |

**章节来源**
- [docs/subdocument-share-context-2026-02-28.md:1-204](file://docs/subdocument-share-context-2026-02-28.md#L1-L204)

## 增量分享功能实现状态

### 当前进度

**已完成**：

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

**功能状态**：
- ✅ 日期显示正常
- ✅ 批量分享成功
- ✅ 成功提示显示
- ✅ 主流程完全跑通

### 已修复的问题

1. **问题 1**: `config.incrementalShareConfig?.enabled` 未定义
   - 症状：变更检测返回空数组  
   - 修复：注释掉 enabled 检查（Mock 阶段）

2. **问题 2**: `shareService.shareDoc()` 不存在
   - 症状：批量分享报错  
   - 修复：创建新方法 `bulkCreateShare(docIds)`

3. **问题 3**: `settingService.getSettingConfig()` 不存在
   - 症状：更新时间报错  
   - 修复：添加 Mock 方法

4. **问题 4**: Invalid Date 显示
   - 症状：日期显示为 "Invalid Date"  
   - 修复：添加 `formatTime(timestamp)` 函数，字段名统一为 `shareTime`

5. **问题 5**: `formatTime` 重复声明
   - 症状：编译错误  
   - 修复：删除旧版本，保留完善版

**章节来源**
- [docs/incremental-share-context-2025-12-04.md:1-589](file://docs/incremental-share-context-2025-12-04.md#L1-L589)

## 黑名单管理系统重构

### 技术债务分析与改进计划

#### 架构技术债务分析与改进计划

**提交**: `4218e65 docs(architecture): add technical debt analysis and improvement plan`

**内容**:
- 分析初始架构决策中的技术债务根本原因
- 识别本地存储能力低估及其影响
- 提出系统性架构审计框架
- 制定存储架构优化方案，包含分层缓存和同步机制
- 提供架构决策检查清单

#### 本地分享历史持久化与缓存

**提交**: `4c5ed16 feat(share): add local share history persistence and caching`

**内容**:
- 实现LocalShareHistory服务，将分享历史存储在文档属性中
- 添加内存分享历史缓存以减少冗余查询
- 修改IncrementalShareService以从本地存储获取历史记录并支持缓存
- 更新shareDocumentWithRetry以返回详细结果（包括shareUrl和errorMessage）
- 处理分享历史清理逻辑

#### 黑名单系统重构

**提交**: `eb6cfd6 refactor(blacklist): replace backend blacklist with local storage service`

**内容**:
- 移除BlacklistService和ShareBlacklistUI.svelte
- 在AppConfig中添加notebookBlacklist配置支持本地存储笔记本黑名单
- 引入LocalBlacklistService使用文档属性和应用配置处理黑名单数据
- 更新IncrementalShareService和ShareProPlugin使用LocalBlacklistService替代后端API服务
- 修改BlacklistSetting.svelte与LocalBlacklistService交互，替换API调用为本地存储操作

#### 黑名单智能搜索功能

**提交**: `6802f71 feat(blacklist): add intelligent search for documents and notebooks`

**内容**:
- 实现带防抖的黑名单目标选择搜索输入框
- 添加API服务方法按关键词搜索文档和笔记本
- 集成带加载状态和选择功能的搜索结果下拉框
- 在黑名单类型更改时清除搜索结果和输入
- 禁用未选择有效targetId时的添加按钮
- 更新国际化占位符指导关键词搜索使用
- 重构黑名单表单UI支持搜索下拉框和隐藏输入框

#### 增量分享变更检测简化与搜索过滤

**提交**: `6e13271 refactor(incremental-share): simplify change detection and add search filter`

**内容**:
- 从变更检测结果中移除unchangedDocuments和blacklistedCount
- 在worker和服务层跳过黑名单文档过滤
- 为API调用添加searchTerm参数以进行过滤文档查询
- 更新UI仅合并和显示新文档和更新文档
- 用后端搜索功能替换客户端过滤
- 为所有文档都被列入黑名单的情况添加错误消息

#### 分享管理弹窗与增量分享UI集成

**提交**: `025f33f feat(share-ui): add share management dialog with incremental share UI integration`

**内容**:
- 导入和使用Dialog组件创建分享管理模态框
- 在打开对话框前获取最新的VIP信息并在需要时显示错误消息
- 在对话框内集成ShareManage组件并传递props
- 在增量分享UI头部添加新按钮以打开分享管理对话框
- 为新头部按钮和对话框内容容器添加样式
- 允许向ShareManage组件传递自定义pageSize属性以灵活分页
- 重构ShareManage组件以接受和使用动态页面大小而非固定常量

**章节来源**
- [docs/incremental-share-context-2025-12-09.md:1-214](file://docs/incremental-share-context-2025-12-09.md#L1-L214)

## 结论

在线分享专业版（Share Pro）插件通过其模块化的设计和丰富的功能特性，为思源笔记用户提供了强大而便捷的文档分享解决方案。插件的主要优势包括：

1. **功能完整性**：涵盖从基础分享到高级配置的所有需求
2. **性能优化**：采用多种优化策略确保流畅的用户体验
3. **扩展性强**：清晰的架构设计便于功能扩展和维护
4. **用户体验**：直观的界面设计和详细的进度反馈

该插件特别适合需要频繁分享知识内容的用户，无论是个人学习笔记还是团队协作文档，都能提供高效的分享体验。

**已完成的重要修复**：
- 文档大纲遮挡问题已修复，参考 Mintlify 的最佳实践
- 夜间暗黑模式故障已修复，确保夜间正常使用
- 黑名单管理系统已从后端迁移到本地存储，提升性能和用户体验
- 统一进度管理系统已实现，解决 showMessage 混乱和资源处理同步问题

**待完成的功能**：
- 增量分享功能的完整实现（真实API替换）
- 黑名单功能的 CRUD 操作完善
- UI 增强功能的进一步开发
- 1.17.0 版本规划中的所有功能实现

**项目路线图**：
- 1.16.0 版本已实现核心功能，包括子文档分享、增量分享、黑名单管理等
- 1.17.0 版本规划中包含体验优化、数据可视化、快捷操作等功能
- 长期规划（2.0 版本）包括智能分享推荐、团队协作分享、版本管理等高级功能

通过结构化的项目路线图和详细的技术实现，该插件正朝着成为专业级文档分享解决方案的目标稳步前进。