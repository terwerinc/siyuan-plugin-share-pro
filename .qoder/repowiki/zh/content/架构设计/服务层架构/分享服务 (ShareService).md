# 分享服务（ShareService）

<cite>
**本文引用的文件**
- [src/service/ShareService.ts](file://src/service/ShareService.ts)
- [src/service/IncrementalShareService.ts](file://src/service/IncrementalShareService.ts)
- [src/service/LocalShareHistory.ts](file://src/service/LocalShareHistory.ts)
- [src/composables/useEmbedBlock.ts](file://src/composables/useEmbedBlock.ts)
- [src/composables/useDataTable.ts](file://src/composables/useDataTable.ts)
- [src/composables/useFold.ts](file://src/composables/useFold.ts)
- [src/composables/useSiyuanApi.ts](file://src/composables/useSiyuanApi.ts)
- [src/api/share-api.ts](file://src/api/share-api.ts)
- [src/models/ShareOptions.ts](file://src/models/ShareOptions.ts)
- [src/models/ShareProConfig.ts](file://src/models/ShareProConfig.ts)
- [src/models/SingleDocSetting.ts](file://src/models/SingleDocSetting.ts)
- [src/models/ShareHistory.ts](file://src/models/ShareHistory.ts)
- [src/models/AppConfig.ts](file://src/models/AppConfig.ts)
- [src/utils/progress/ProgressManager.ts](file://src/utils/progress/ProgressManager.ts)
- [src/utils/progress/ProgressState.ts](file://src/utils/progress/ProgressState.ts)
- [src/utils/progress/ResourceEventEmitter.ts](file://src/utils/progress/ResourceEventEmitter.ts)
- [src/utils/ShareHistoryUtils.ts](file://src/utils/ShareHistoryUtils.ts)
- [src/utils/ChangeDetectionWorkerUtil.ts](file://src/utils/ChangeDetectionWorkerUtil.ts)
- [src/utils/ShareHistoryCache.ts](file://src/utils/ShareHistoryCache.ts)
- [src/utils/AttrUtils.ts](file://src/utils/AttrUtils.ts)
- [src/workers/change-detection.worker.ts](file://src/workers/change-detection.worker.ts)
- [src/libs/pages/ShareUI.svelte](file://src/libs/pages/ShareUI.svelte)
</cite>

## 更新摘要
**所做更改**
- 新增forceUpdate属性到ShareOptions模型，支持强制更新分享功能
- 增强handleOne方法的增量检测逻辑，支持forceUpdate选项跳过增量检测
- 改进错误处理和状态管理，包括文档级别错误隔离和增强的错误提示
- 优化批量处理中的跳过文档统计和进度反馈
- 增强ShareUI组件的错误状态管理，实现基于initiatorDocId的文档级别错误隔离

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构总览](#架构总览)
5. [详细组件分析](#详细组件分析)
6. [依赖关系分析](#依赖关系分析)
7. [性能考量](#性能考量)
8. [故障排查指南](#故障排查指南)
9. [结论](#结论)
10. [附录](#附录)

## 简介
本文件系统性阐述"思源笔记分享专业版"的分享服务（ShareService）设计与实现，重点覆盖以下能力：
- 单文档分享与批量文档分享
- 子文档扁平化处理与引用文档分享
- 增量分享功能：基于时间戳的文档变更检测与自动跳过未变更文档
- **新增** 强制更新功能：支持forceUpdate选项跳过增量检测，强制重新分享
- 文档预处理：嵌入块、数据视图、折叠块
- 媒体资源处理机制（常规媒体与DataViews媒体）
- 分享选项更新、历史记录管理、错误处理策略
- 配置优先级（文档级 vs 全局级）
- 性能优化（分页获取、并发控制）
- 与API层的交互模式与数据流转
- **新增** 增强的错误状态管理：基于initiatorDocId实现文档级别的错误隔离
- **更新** 改进的增量分享检测机制：移除convertSiyuanDateToTimestamp工具函数，改用更直接的Date构造函数；同时改进了日期字段处理，保留原始创建和修改时间戳

## 项目结构
分享服务位于 src/service/ShareService.ts，围绕其构建了配套的组合式工具（composables）与API封装（api/share-api.ts），并通过进度与资源事件系统（progress/）实现批量与资源处理的可观测性。同时集成了增量分享服务（IncrementalShareService.ts）以支持基于时间戳的文档变更检测。

```mermaid
graph TB
subgraph "服务层"
SS["ShareService<br/>分享服务"]
ISS["IncrementalShareService<br/>增量分享服务"]
LSH["LocalShareHistory<br/>本地历史记录"]
PM["ProgressManager<br/>进度管理"]
RE["ResourceEventEmitter<br/>资源事件"]
end
subgraph "文档预处理"
EB["useEmbedBlock<br/>嵌入块"]
DT["useDataTable<br/>数据视图"]
FD["useFold<br/>折叠块"]
end
subgraph "API封装"
SA["ShareApi<br/>分享API"]
end
subgraph "模型与类型"
SO["ShareOptions<br/>分享选项"]
SDC["SingleDocSetting<br/>单文档设置"]
SPC["ShareProConfig<br/>插件配置"]
ASC["AppConfig<br/>应用配置"]
SHI["ShareHistory<br/>历史记录接口"]
SDTO["DocDTO/PageDTO<br/>服务端DTO"]
end
SS --> EB
SS --> DT
SS --> FD
SS --> SA
SS --> LSH
SS --> PM
SS -.监听.-> RE
ISS --> SS
ISS --> SA
ISS --> ASC
SA --> SDTO
SS --> SDC
SS --> SO
SS --> SPC
SS --> SHI
```

**图表来源**
- [src/service/ShareService.ts:40-1188](file://src/service/ShareService.ts#L40-L1188)
- [src/service/IncrementalShareService.ts:98-691](file://src/service/IncrementalShareService.ts#L98-L691)
- [src/service/LocalShareHistory.ts:17-129](file://src/service/LocalShareHistory.ts#L17-L129)
- [src/composables/useEmbedBlock.ts:23-85](file://src/composables/useEmbedBlock.ts#L23-L85)
- [src/composables/useDataTable.ts:22-101](file://src/composables/useDataTable.ts#L22-L101)
- [src/composables/useFold.ts:23-102](file://src/composables/useFold.ts#L23-L102)
- [src/api/share-api.ts:16-240](file://src/api/share-api.ts#L16-L240)
- [src/models/ShareOptions.ts:16-45](file://src/models/ShareOptions.ts#L16-L45)
- [src/models/SingleDocSetting.ts:18-85](file://src/models/SingleDocSetting.ts#L18-L85)
- [src/models/ShareProConfig.ts:13-40](file://src/models/ShareProConfig.ts#L13-L40)
- [src/models/AppConfig.ts:68-81](file://src/models/AppConfig.ts#L68-L81)
- [src/models/ShareHistory.ts:13-74](file://src/models/ShareHistory.ts#L13-L74)
- [src/types/service-dto.d.ts:13-134](file://src/types/service-dto.d.ts#L13-L134)

**章节来源**
- [src/service/ShareService.ts:40-1188](file://src/service/ShareService.ts#L40-L1188)
- [src/service/IncrementalShareService.ts:98-691](file://src/service/IncrementalShareService.ts#L98-L691)
- [src/api/share-api.ts:16-240](file://src/api/share-api.ts#L16-L240)

## 核心组件
- ShareService：统一入口、配置解析、文档扁平化、单/多文档处理、媒体资源处理、历史记录与错误处理。
- IncrementalShareService：增量分享核心服务，负责基于时间戳的文档变更检测、批量分享管理和配置更新。
- LocalShareHistory：本地历史记录管理，提供直接访问和操作本地分享历史数据的能力。
- ShareApi：对后端分享服务的HTTP封装，统一鉴权与请求构造。
- useEmbedBlock/useDataTable/useFold：文档预处理组合式函数，分别负责嵌入块、数据视图、折叠块的提取与渲染。
- ProgressManager/ResourceEventEmitter：批量与资源处理的进度与事件驱动框架。
- 模型与类型：ShareOptions、SingleDocSetting、ShareProConfig、AppConfig、ShareHistory、DocDTO/PageDTO。

**章节来源**
- [src/service/ShareService.ts:40-1188](file://src/service/ShareService.ts#L40-L1188)
- [src/service/IncrementalShareService.ts:98-691](file://src/service/IncrementalShareService.ts#L98-L691)
- [src/service/LocalShareHistory.ts:17-129](file://src/service/LocalShareHistory.ts#L17-L129)
- [src/api/share-api.ts:16-240](file://src/api/share-api.ts#L16-L240)
- [src/composables/useEmbedBlock.ts:23-85](file://src/composables/useEmbedBlock.ts#L23-L85)
- [src/composables/useDataTable.ts:22-101](file://src/composables/useDataTable.ts#L22-L101)
- [src/composables/useFold.ts:23-102](file://src/composables/useFold.ts#L23-L102)
- [src/utils/progress/ProgressManager.ts:8-275](file://src/utils/progress/ProgressManager.ts#L8-L275)
- [src/utils/progress/ResourceEventEmitter.ts:1-11](file://src/utils/progress/ResourceEventEmitter.ts#L1-L11)
- [src/models/ShareOptions.ts:16-45](file://src/models/ShareOptions.ts#L16-L45)
- [src/models/SingleDocSetting.ts:18-85](file://src/models/SingleDocSetting.ts#L18-L85)
- [src/models/ShareProConfig.ts:13-40](file://src/models/ShareProConfig.ts#L13-L40)
- [src/models/AppConfig.ts:68-81](file://src/models/AppConfig.ts#L68-L81)
- [src/models/ShareHistory.ts:13-74](file://src/models/ShareHistory.ts#L13-L74)
- [src/types/service-dto.d.ts:13-134](file://src/types/service-dto.d.ts#L13-L134)

## 架构总览
下图展示了从调用入口到后端服务的数据流与职责划分，包括新增的增量分享功能、跳过文档的跟踪机制以及本地历史记录访问能力。

```mermaid
sequenceDiagram
participant Caller as "调用方"
participant ISS as "IncrementalShareService"
participant SS as "ShareService"
participant LSH as "LocalShareHistory"
participant SA as "ShareApi"
participant Kernel as "思源内核API"
participant Svc as "分享服务后端"
Caller->>ISS : detectChangedDocuments()/bulkShareDocuments()
ISS->>SS : createShare(docId, settings?, options?)
SS->>SS : 解析配置与优先级
SS->>SS : 执行增量检测基于时间戳
Note over SS : 检查 options.forceUpdate
alt forceUpdate = true
SS->>SS : 跳过增量检测，直接分享
else forceUpdate = false
SS->>SS : 正常增量检测
end
SS->>SS : 扁平化文档列表子文档+引用
SS->>SS : 处理跳过文档的进度跟踪
SS->>SA : createShare(HTML+元数据)
SA->>Svc : POST /api/share/create
Svc-->>SA : {code,msg,data}
SA-->>SS : 返回响应
SS->>SS : 记录历史/更新选项
SS->>SA : uploadMedia/uploadDataViewMedia
SA->>Svc : POST /api/asset/upload*
Svc-->>SA : {code,msg}
SA-->>SS : 返回结果
SS->>LSH : addHistory()/getHistoryByDocId()
LSH-->>SS : 本地历史记录
SS-->>ISS : 返回分享结果
ISS-->>Caller : 返回批量结果
```

**图表来源**
- [src/service/IncrementalShareService.ts:269-351](file://src/service/IncrementalShareService.ts#L269-L351)
- [src/service/ShareService.ts:255-322](file://src/service/ShareService.ts#L255-L322)
- [src/service/ShareService.ts:587-730](file://src/service/ShareService.ts#L587-L730)
- [src/service/ShareService.ts:1032-1076](file://src/service/ShareService.ts#L1032-L1076)
- [src/service/ShareService.ts:228-231](file://src/service/ShareService.ts#L228-L231)
- [src/service/LocalShareHistory.ts:101-127](file://src/service/LocalShareHistory.ts#L101-L127)
- [src/api/share-api.ts:46-71](file://src/api/share-api.ts#L46-L71)

## 详细组件分析

### ShareService：统一分享入口与处理编排
- 统一入口
  - createShare：根据配置决定单文档或批量处理；若启用子文档，则先扁平化再并发处理。
- 文档扁平化
  - flattenDocumentsForSharing：基于配置与文档设置，合并主文档、子文档与引用文档，去重并应用数量限制与分页获取。
  - 配置优先级：文档级设置（SingleDocSetting）优先于全局（ShareProConfig.appConfig）。
- 单文档处理（handleOne）
  - **更新** 增量检测：内置基于时间戳的文档变更检测，支持forceUpdate选项跳过增量检测，自动跳过未变更的文档
  - 预处理：嵌入块、数据视图、折叠块；写入文档属性（发布时间、单文档设置）。
  - 发布：调用 ShareApi.createShare，保存成功/失败历史。
  - 选项更新：updateShareOptions 支持仅更新分享选项（如密码）而不重复上传内容。
  - 媒体处理：processAllMediaResources 顺序处理常规媒体与DataViews媒体，触发资源事件。
- 批量处理
  - batchProcessDocuments：使用并发控制（processWithConcurrency）处理多个文档，结合 ProgressManager 实时更新进度与错误。
  - **新增** 跳过文档跟踪：统计跳过的文档数量并更新进度状态。
- 取消分享
  - cancelShare/cancelOne：支持单/多文档取消，清理本地历史并删除远端文档。
- 历史记录管理
  - **新增** getLocalShareHistory：提供直接访问本地分享历史数据的能力，用于ShareUI组件的分享时间跟踪。
  - handleShareSuccess/handleShareFailure/handleShareException：统一管理历史记录的添加和更新。
- **新增** 错误状态管理
  - 基于initiatorDocId实现文档级别的错误隔离，错误banner只显示发起操作的文档的错误
  - 支持文档错误和资源错误的分类管理
  - 增强的错误提示和状态反馈机制

**章节来源**
- [src/service/ShareService.ts:255-322](file://src/service/ShareService.ts#L255-L322)
- [src/service/ShareService.ts:101-226](file://src/service/ShareService.ts#L101-L226)
- [src/service/ShareService.ts:587-730](file://src/service/ShareService.ts#L587-L730)
- [src/service/ShareService.ts:1153-1229](file://src/service/ShareService.ts#L1153-L1229)
- [src/service/ShareService.ts:404-496](file://src/service/ShareService.ts#L404-L496)
- [src/service/ShareService.ts:1240-1247](file://src/service/ShareService.ts#L1240-L1247)
- [src/service/ShareService.ts:228-231](file://src/service/ShareService.ts#L228-L231)
- [src/service/ShareService.ts:1019-1073](file://src/service/ShareService.ts#L1019-L1073)

#### ShareOptions模型增强（forceUpdate属性）
**更新** ShareOptions模型已新增forceUpdate属性，提供强制更新分享功能：

- **forceUpdate属性**：boolean类型，默认false，用于控制是否跳过增量检测
- **使用场景**：当文档树深度等设置变更后需要强制重新分享的场景
- **实现机制**：在handleOne方法中检查options.forceUpdate，为true时跳过增量检测逻辑
- **UI集成**：ShareUI组件通过handleReShare方法支持forceUpdate参数，允许用户强制重新分享

**章节来源**
- [src/models/ShareOptions.ts:16-45](file://src/models/ShareOptions.ts#L16-L45)
- [src/service/ShareService.ts:268-286](file://src/service/ShareService.ts#L268-L286)
- [src/libs/pages/ShareUI.svelte:236-284](file://src/libs/pages/ShareUI.svelte#L236-L284)

#### 增量分享功能增强
- **更新** 内置增量检测：handleOne方法中实现了基于时间戳的文档变更检测逻辑
- **强制更新支持**：新增forceUpdate选项，为true时跳过增量检测，直接进行分享
- 自动跳过未变更文档：通过比较文档的当前修改时间与历史记录中的docModifiedTime，自动跳过未变更的文档
- **新增** 跳过文档统计：在批量处理中统计跳过的文档数量并更新进度
- 配置管理：IncrementalShareService负责管理增量分享配置，包括enabled状态和lastShareTime时间戳

**章节来源**
- [src/service/ShareService.ts:266-282](file://src/service/ShareService.ts#L266-L282)
- [src/service/IncrementalShareService.ts:369-389](file://src/service/IncrementalShareService.ts#L369-L389)

#### 改进的增量分享检测机制
**更新** 增量分享检测机制已得到重要改进：

- **移除convertSiyuanDateToTimestamp工具函数**：不再使用复杂的日期格式转换，直接采用Date构造函数处理时间戳
- **直接的Date构造函数**：在handleOne方法中，直接使用`new Date(post.dateUpdated).getTime()`获取文档修改时间戳
- **保留原始时间戳**：改进了日期字段处理，直接使用文档的原始创建和修改时间戳，无需额外转换
- **简化的时间处理逻辑**：移除了convertTimestampToSiyuanDate和convertSiyuanDateToTimestamp之间的双向转换，提高了性能和准确性
- **forceUpdate集成**：新增forceUpdate选项支持，允许用户强制跳过增量检测

这种改进使得增量检测更加直接和高效，避免了不必要的日期格式转换开销，同时保持了时间戳的精确性。

**章节来源**
- [src/service/ShareService.ts:261-277](file://src/service/ShareService.ts#L261-L277)

#### 增强的错误状态管理（新增）
**更新** 错误状态管理已得到显著增强：

- **文档级别错误隔离**：基于initiatorDocId实现，错误banner只显示发起操作的文档的错误
- **关键设计原则**：initiatorDocId（用户点击"分享"按钮的文档ID）不会随处理进度变化
- **错误分类管理**：支持文档错误和资源错误的分类管理
- **UI集成**：ShareUI组件通过$progressStore订阅实现错误状态的实时更新
- **错误详情弹窗**：支持详细的错误信息展示和错误清除功能

**章节来源**
- [src/service/ShareService.ts:313-331](file://src/service/ShareService.ts#L313-L331)
- [src/utils/progress/ProgressManager.ts:15-37](file://src/utils/progress/ProgressManager.ts#L15-L37)
- [src/utils/progress/ProgressState.ts:4-33](file://src/utils/progress/ProgressState.ts#L4-L33)
- [src/libs/pages/ShareUI.svelte:305-369](file://src/libs/pages/ShareUI.svelte#L305-L369)

#### 跳过文档的跟踪和反馈机制（新增）
- **跳过文档计数**：在batchProcessDocuments中新增skippedCount变量，用于统计跳过的文档数量
- **进度更新**：通过ProgressManager.addSkipped方法更新跳过文档的进度状态
- **统计汇总**：批量完成后显示跳过文档的数量和分享成功的文档数量
- **状态管理**：在handleOne中检测到文档未变更时，返回{skipped: true}状态给批量处理逻辑

**章节来源**
- [src/service/ShareService.ts:348-397](file://src/service/ShareService.ts#L348-L397)
- [src/service/ShareService.ts:363-375](file://src/service/ShareService.ts#L363-L375)

#### 配置优先级（文档级 vs 全局级）
- 文档树与大纲：docTreeEnable/docTreeLevel、outlineEnable/outlineLevel，均采用"文档级 > 全局"策略。
- 子文档与引用：shareSubdocuments、shareReferences、maxSubdocuments，同样遵循上述优先级。
- 限制与安全：maxSubdocuments=-1 表示无限制，但存在最大上限约束与警告日志。

**章节来源**
- [src/service/ShareService.ts:127-171](file://src/service/ShareService.ts#L127-L171)
- [src/models/SingleDocSetting.ts:18-85](file://src/models/SingleDocSetting.ts#L18-L85)
- [src/models/ShareProConfig.ts:13-40](file://src/models/ShareProConfig.ts#L13-L40)

#### 文档预处理流程
- 嵌入块（useEmbedBlock）
  - 通过 Cheerio 解析 editorDom，定位 data-type="NodeBlockQueryEmbed" 的节点，调用内核接口获取默认视图内容，返回映射与顺序。
- 数据视图（useDataTable）
  - 识别 data-av-type="table" 的节点，获取默认视图与其它视图，使用 Promise.all 并发渲染，合并为单一结果。
- 折叠块（useFold）
  - 仅处理 data-type="NodeHeading" 且 fold="1" 的节点，借助事务接口临时展开并提取内容，返回映射与顺序。

**章节来源**
- [src/composables/useEmbedBlock.ts:33-77](file://src/composables/useEmbedBlock.ts#L33-L77)
- [src/composables/useDataTable.ts:26-95](file://src/composables/useDataTable.ts#L26-L95)
- [src/composables/useFold.ts:33-94](file://src/composables/useFold.ts#L33-L94)

#### 媒体资源处理机制
- 常规媒体（processShareMedia）
  - 分批（每批5个）抓取 base64，构造参数并调用 ShareApi.uploadMedia；支持进度回调与错误回调。
- DataViews 媒体（processDataViewMedia）
  - 与常规媒体类似，但标识 source=dataviews，并携带 cellId 以便后端识别。
- 顺序处理（processAllMediaResources）
  - 先常规媒体，后 DataViews 媒体，避免并发导致的后端处理混乱；通过 ResourceEventEmitter 发布 START/PROGRESS/ERROR/COMPLETE 事件，供进度管理联动。

**章节来源**
- [src/service/ShareService.ts:732-878](file://src/service/ShareService.ts#L732-L878)
- [src/service/ShareService.ts:885-1026](file://src/service/ShareService.ts#L885-L1026)
- [src/service/ShareService.ts:1032-1076](file://src/service/ShareService.ts#L1032-L1076)
- [src/utils/progress/ResourceEventEmitter.ts:1-11](file://src/utils/progress/ResourceEventEmitter.ts#L1-L11)

#### 引用文档分享
- getReferencedDocuments：重构后的递归查询策略
  - SQL查询策略：使用内核API执行SQL查询，从refs表中获取def_block_root_id，过滤掉当前文档ID，确保自引用保护。
  - 递归算法：采用深度优先搜索（DFS），支持最大递归深度控制（默认3层）。
  - 性能优化：实现循环引用检测和去重机制，使用Set数据结构跟踪已处理文档ID，避免无限递归和重复处理。
  - 错误处理：每个文档获取都有独立的try-catch块，单个文档失败不影响整体流程。
  - 扁平化合并：与子文档列表合并，形成最终分享清单。

**章节来源**
- [src/service/ShareService.ts:430-512](file://src/service/ShareService.ts#L430-L512)

#### 分享选项更新与历史记录
- updateShareOptions：仅更新分享选项（如密码），不重新上传内容。
- 历史记录：无论成功/失败均写入本地历史（LocalShareHistory），并更新缓存；支持按 docIds 查询历史。
- **新增** getLocalShareHistory：提供直接访问本地历史记录的方法，用于UI组件的分享时间跟踪。

**章节来源**
- [src/service/ShareService.ts:519-541](file://src/service/ShareService.ts#L519-L541)
- [src/service/ShareService.ts:554-574](file://src/service/ShareService.ts#L554-L574)
- [src/service/ShareService.ts:228-231](file://src/service/ShareService.ts#L228-L231)
- [src/models/ShareHistory.ts:13-74](file://src/models/ShareHistory.ts#L13-L74)
- [src/utils/ShareHistoryUtils.ts:15-29](file://src/utils/ShareHistoryUtils.ts#L15-L29)

### API 层交互模式
- ShareApi：集中封装 /api/share/* 与 /api/asset/* 等接口，统一鉴权头与请求体构造。
- ServiceResponse：统一响应结构（code/msg/data），便于上层一致处理。
- DTO：DocDTO/PageDTO 等服务端数据结构，用于历史与列表查询。

**章节来源**
- [src/api/share-api.ts:16-240](file://src/api/share-api.ts#L16-L240)
- [src/types/service-dto.d.ts:98-134](file://src/types/service-dto.d.ts#L98-L134)
- [src/types/service-api.d.ts:13-17](file://src/types/service-api.d.ts#L13-L17)

### 并发与进度
- 并发控制（processWithConcurrency）：滑动窗口实现，保证最大并发与结果顺序一致性，单任务错误不影响整体流程。
- 进度管理（ProgressManager）：批量开始/更新/完成/取消，同时监听资源事件，实现文档与资源双维度进度。
- **新增** 跳过文档进度：ProgressManager.addSkipped方法专门处理跳过文档的进度更新。

**章节来源**
- [src/service/ShareService.ts:1086-1145](file://src/service/ShareService.ts#L1086-L1145)
- [src/utils/progress/ProgressManager.ts:12-275](file://src/utils/progress/ProgressManager.ts#L12-L275)

### 增量分享服务
- 变更检测：detectChangedDocumentsSinglePage - 支持单页文档变更检测，基于时间戳比较判断文档状态
- 批量分享：bulkShareDocuments - 支持并发控制和队列管理的批量分享
- 配置管理：updateLastShareTime - 更新最后分享时间戳，用于后续增量检测
- 缓存机制：使用内存缓存和共享缓存减少重复查询
- 黑名单过滤：集成黑名单检查，避免分享黑名单中的文档
- 智能重试：支持网络错误和服务器错误的智能重试机制

**章节来源**
- [src/service/IncrementalShareService.ts:160-210](file://src/service/IncrementalShareService.ts#L160-L210)
- [src/service/IncrementalShareService.ts:269-351](file://src/service/IncrementalShareService.ts#L269-L351)
- [src/service/IncrementalShareService.ts:369-389](file://src/service/IncrementalShareService.ts#L369-L389)

### 本地历史记录管理
- **LocalShareHistory类**：提供完整的本地历史记录管理能力
- **addHistory**：添加新的分享历史记录，包含版本信息和更新时间
- **updateHistory**：更新现有历史记录，支持部分字段更新
- **removeHistory**：删除历史记录，清理相关文档属性
- **getHistoryByDocId**：根据文档ID获取历史记录，支持版本兼容性检查

**章节来源**
- [src/service/LocalShareHistory.ts:17-129](file://src/service/LocalShareHistory.ts#L17-L129)

## 依赖关系分析
```mermaid
classDiagram
class ShareService {
+createShare(docId, settings?, options?)
+flattenDocumentsForSharing(...)
+handleOne(...)
+batchProcessDocuments(...)
+updateShareOptions(...)
+cancelShare(docId)
+getLocalShareHistory(docId)
}
class IncrementalShareService {
+detectChangedDocumentsSinglePage()
+bulkShareDocuments()
+updateLastShareTime()
}
class LocalShareHistory {
+addHistory(item)
+updateHistory(docId, updates)
+removeHistory(docId)
+getHistoryByDocId(docId)
}
class ShareApi {
+createShare(body)
+uploadMedia(body)
+uploadDataViewMedia(body)
+updateShareOptions(body)
}
class useEmbedBlock {
+getEmbedBlocks(dom, parentId)
}
class useDataTable {
+getDataViews(dom)
}
class useFold {
+getFoldBlocks(dom)
}
class ProgressManager {
+addSkipped(id, docId, docTitle)
}
class ResourceEventEmitter
class ShareOptions {
+forceUpdate? : boolean
}
ShareService --> ShareApi : "调用"
ShareService --> useEmbedBlock : "预处理"
ShareService --> useDataTable : "预处理"
ShareService --> useFold : "预处理"
ShareService --> ProgressManager : "批量进度"
ShareService --> ResourceEventEmitter : "资源事件"
ShareService --> LocalShareHistory : "本地历史"
IncrementalShareService --> ShareService : "委托分享"
IncrementalShareService --> ShareApi : "查询文档"
IncrementalShareService --> ProgressManager : "批量进度"
ShareOptions --> ShareService : "配置"
```

**图表来源**
- [src/service/ShareService.ts:40-1188](file://src/service/ShareService.ts#L40-L1188)
- [src/service/IncrementalShareService.ts:98-691](file://src/service/IncrementalShareService.ts#L98-L691)
- [src/service/LocalShareHistory.ts:17-129](file://src/service/LocalShareHistory.ts#L17-L129)
- [src/api/share-api.ts:16-240](file://src/api/share-api.ts#L16-L240)
- [src/composables/useEmbedBlock.ts:23-85](file://src/composables/useEmbedBlock.ts#L23-L85)
- [src/composables/useDataTable.ts:22-101](file://src/composables/useDataTable.ts#L22-L101)
- [src/composables/useFold.ts:23-102](file://src/composables/useFold.ts#L23-L102)
- [src/utils/progress/ProgressManager.ts:8-275](file://src/utils/progress/ProgressManager.ts#L8-L275)
- [src/utils/progress/ResourceEventEmitter.ts:1-11](file://src/utils/progress/ResourceEventEmitter.ts#L1-L11)
- [src/models/ShareOptions.ts:16-45](file://src/models/ShareOptions.ts#L16-L45)

## 性能考量
- 分页获取子文档：默认分页大小50，避免一次性拉取过多子文档造成内存压力。
- 并发控制：批量分享默认并发10，既提升吞吐又避免后端过载。
- 限制与上限：maxSubdocuments=-1 表示无限制，但实际受最大上限与警告约束，防止超大规模导致性能问题。
- 媒体分批：每批5个，减少单次请求负载与网络抖动影响。
- 顺序处理媒体：避免并发导致的后端处理冲突，保证稳定性。
- 引用文档优化：重构后的SQL查询策略减少了JavaScript递归开销，循环引用检测避免了无限递归。
- 增量分享优化：基于时间戳的文档变更检测，避免重复分享未变更文档，显著提升性能。
- 缓存机制：增量分享服务使用5分钟缓存，减少重复查询和计算开销。
- **新增** 跳过文档优化：通过跳过未变更文档，减少不必要的分享操作，提升整体性能。
- **更新** 增量检测性能优化：移除convertSiyuanDateToTimestamp工具函数，直接使用Date构造函数，减少日期格式转换开销，提高增量检测效率。
- **新增** 本地历史记录优化：getLocalShareHistory方法直接访问本地数据，避免网络请求延迟，提高UI响应速度。
- **新增** ShareUI组件优化：通过getLocalShareHistory实现更准确的分享时间跟踪，提升用户体验。
- **新增** 错误状态管理优化：基于initiatorDocId的文档级别错误隔离，避免错误状态的交叉污染。
- **新增** forceUpdate性能优化：强制更新功能避免了不必要的增量检测开销，直接进行分享操作。

**章节来源**
- [src/service/ShareService.ts:174-175](file://src/service/ShareService.ts#L174-L175)
- [src/service/ShareService.ts](file://src/service/ShareService.ts#L1159)
- [src/service/ShareService.ts:741-745](file://src/service/ShareService.ts#L741-L745)
- [src/service/ShareService.ts:894-898](file://src/service/ShareService.ts#L894-L898)
- [src/service/ShareService.ts:1032-1076](file://src/service/ShareService.ts#L1032-L1076)
- [src/service/IncrementalShareService.ts:108-111](file://src/service/IncrementalShareService.ts#L108-L111)
- [src/service/ShareService.ts:228-231](file://src/service/ShareService.ts#L228-L231)

## 故障排查指南
- 分享失败
  - 单文档：handleOne 捕获异常并记录历史，同时弹窗提示；可检查日志与历史记录。
  - 批量：ProgressManager 聚合错误，可在进度界面查看具体失败项。
- 媒体处理失败
  - processShareMedia/processDataViewMedia 对单个批次失败有容错；可通过资源事件监听定位错误。
- 取消分享
  - cancelShare/cancelOne：支持单/多文档取消，失败时返回错误码与消息，本地历史同步清理。
- 配置问题
  - 若未初始化分享服务端地址，ShareApi 会提示"未找到分享服务"，请检查配置。
- 引用文档问题
  - 循环引用：系统会自动检测并跳过，避免无限递归。
  - 性能问题：可通过降低递归深度或禁用引用文档分享来缓解。
- 增量分享问题
  - 时间戳异常：检查incrementalShareConfig.lastShareTime是否正确设置
  - 配置失效：确认incrementalShareConfig.enabled是否为true
  - 缓存问题：使用clearCache()方法清除缓存后重试
  - **更新** 增量检测异常：检查post.dateUpdated格式是否正确，确保使用直接的Date构造函数处理时间戳
  - **新增** forceUpdate问题：检查options.forceUpdate是否正确传递，确认强制更新功能正常工作
- **新增** 跳过文档问题
  - 跳过计数异常：检查ProgressManager.addSkipped方法是否正确调用
  - 进度显示错误：确认跳过文档的进度计算逻辑是否正确
  - 批量统计错误：验证batchProcessDocuments中的skippedCount统计
- **新增** 错误状态管理问题
  - 错误隔离异常：检查initiatorDocId是否正确设置，确认文档级别错误隔离功能
  - UI错误显示：确认ShareUI组件的错误状态订阅是否正常工作
  - 错误详情弹窗：检查错误详情消息生成逻辑和弹窗显示功能
- **新增** 本地历史记录问题
  - getLocalShareHistory方法异常：检查LocalShareHistory.getHistoryByDocId方法的实现
  - ShareUI组件显示错误：确认ShareUI通过getLocalShareHistory获取的lastShareTime是否正确
  - 数据不同步：检查LocalShareHistory.addHistory方法是否正确更新文档属性

**章节来源**
- [src/service/ShareService.ts:692-730](file://src/service/ShareService.ts#L692-L730)
- [src/service/ShareService.ts:1213-1218](file://src/service/ShareService.ts#L1213-L1218)
- [src/service/ShareService.ts:732-878](file://src/service/ShareService.ts#L732-L878)
- [src/service/ShareService.ts:885-1026](file://src/service/ShareService.ts#L885-L1026)
- [src/service/ShareService.ts:404-496](file://src/service/ShareService.ts#L404-L496)
- [src/api/share-api.ts:177-209](file://src/api/share-api.ts#L177-L209)
- [src/service/IncrementalShareService.ts:259-265](file://src/service/IncrementalShareService.ts#L259-L265)
- [src/service/ShareService.ts:228-231](file://src/service/ShareService.ts#L228-L231)

## 结论
ShareService 以清晰的职责边界与完善的预处理、并发与事件机制，实现了从单文档到批量分享的全链路能力。通过"文档级 > 全局"的配置优先级、分页与并发控制等优化手段，在保证稳定性的同时兼顾性能与可维护性。配合 ShareApi 与进度/资源事件系统，为用户提供了可观测、可回溯的分享体验。

**新增** 强制更新功能进一步增强了分享服务的灵活性，允许用户在文档设置变更后强制重新分享，避免了增量检测导致的分享延迟。

**新增** 增强的错误状态管理显著提升了用户体验，基于initiatorDocId的文档级别错误隔离确保用户只能看到与自己操作相关的错误信息，避免了错误状态的交叉污染。

**更新** 改进的增量分享检测机制显著提升了性能和可靠性，移除convertSiyuanDateToTimestamp工具函数的使用，采用直接的Date构造函数处理时间戳，减少了不必要的日期格式转换开销，同时保留了原始的创建和修改时间戳，确保了时间数据的准确性和完整性。

**新增** 本地分享历史数据访问能力为ShareUI组件提供了更准确的分享时间跟踪，通过getLocalShareHistory方法直接访问本地历史记录，避免了服务端响应延迟和数据不同步问题，显著提升了用户体验。

## 附录

### 使用示例（参数配置、返回值与异常处理）
- 单文档分享
  - 入口：调用 createShare(docId, settings?, options?)。
  - 设置：SingleDocSetting（如 docTreeEnable/docTreeLevel、outlineEnable/outlineLevel、shareSubdocuments、maxSubdocuments、shareReferences）。
  - 选项：ShareOptions（如 passwordEnabled/password、**新增** forceUpdate）。
  - 返回：Promise<ServiceResponse>，包含 code/msg/data。
  - 异常：handleOne 内捕获并记录历史，必要时抛出或由调用方处理。
- 批量分享
  - 入口：createShare 自动根据配置进入批量分支；也可直接调用 batchProcessDocuments。
  - 并发：默认并发10，可通过参数调整。
  - 进度：通过 ProgressManager 获取实时进度与错误列表。
  - **新增** 跳过统计：批量完成后显示跳过文档的数量和分享成功的文档数量。
- 增量分享
  - 入口：IncrementalShareService.detectChangedDocumentsSinglePage() 检测变更。
  - 批量：IncrementalShareService.bulkShareDocuments() 执行批量分享。
  - 配置：AppConfig.incrementalShareConfig 管理增量分享设置。
  - 时间戳：自动更新 lastShareTime 用于下次检测。
  - **更新** 增量检测：使用直接的Date构造函数处理文档修改时间，无需convertSiyuanDateToTimestamp工具函数。
  - **新增** 强制更新：通过options.forceUpdate=true跳过增量检测，直接进行分享。
- 媒体处理
  - 常规媒体：processShareMedia；DataViews媒体：processDataViewMedia。
  - 事件：通过 ResourceEventEmitter 监听资源处理进度与错误。
- 历史记录
  - getHistoryByIds：按 docIds 查询历史；本地历史由 LocalShareHistory 管理。
  - **新增** getLocalShareHistory：直接访问本地历史记录，用于UI组件的分享时间跟踪。
- **新增** 错误状态管理
  - 基于initiatorDocId的文档级别错误隔离，错误banner只显示发起操作的文档的错误
  - 支持文档错误和资源错误的分类管理
  - 增强的错误提示和状态反馈机制
- **新增** ShareUI组件集成
  - 通过getLocalShareHistory获取上次分享时间，实现更准确的分享时间显示
  - 支持格式化的分享时间显示，包括"刚刚"、"X秒前"、"今天"、"昨天"等人性化显示
  - **新增** 强制重新分享功能：通过handleReShare(forceUpdate=true)实现
- **新增** 强制更新功能
  - 在ShareOptions中设置forceUpdate=true，跳过增量检测
  - 适用于文档树深度等设置变更后的重新分享场景
  - UI层面通过handleReShare方法支持强制更新选项

**章节来源**
- [src/service/ShareService.ts:235-258](file://src/service/ShareService.ts#L235-L258)
- [src/service/ShareService.ts:1153-1229](file://src/service/ShareService.ts#L1153-L1229)
- [src/service/ShareService.ts:1032-1076](file://src/service/ShareService.ts#L1032-L1076)
- [src/service/ShareService.ts:554-574](file://src/service/ShareService.ts#L554-L574)
- [src/service/ShareService.ts:228-231](file://src/service/ShareService.ts#L228-L231)
- [src/service/IncrementalShareService.ts:269-351](file://src/service/IncrementalShareService.ts#L269-L351)
- [src/models/SingleDocSetting.ts:18-85](file://src/models/SingleDocSetting.ts#L18-L85)
- [src/models/ShareOptions.ts:16-45](file://src/models/ShareOptions.ts#L16-L45)
- [src/models/AppConfig.ts:68-81](file://src/models/AppConfig.ts#L68-L81)
- [src/api/share-api.ts:46-71](file://src/api/share-api.ts#L46-L71)
- [src/utils/progress/ProgressManager.ts:12-275](file://src/utils/progress/ProgressManager.ts#L12-L275)
- [src/utils/progress/ResourceEventEmitter.ts:1-11](file://src/utils/progress/ResourceEventEmitter.ts#L1-L11)
- [src/libs/pages/ShareUI.svelte:236-284](file://src/libs/pages/ShareUI.svelte#L236-L284)