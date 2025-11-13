## MODIFIED Requirements

### Requirement: ShareService 扩展
ShareService SHALL 扩展以支持增量分享功能，包括变更检测和批量分享能力。

#### Scenario: 检测变更文档
- **WHEN** 调用 detectChangedDocuments 方法时
- **THEN** 系统 SHALL 根据上次分享时间戳识别所有发生变更的文档
- **THEN** 返回的文档列表 SHALL 包含变更时间和状态信息

## ADDED Requirements

### Requirement: IncrementalShareService 接口
系统 SHALL 创建 IncrementalShareService 接口，定义增量分享相关的核心功能。

#### Scenario: 初始化增量分享服务
- **WHEN** 系统启动时
- **THEN** 系统 SHALL 初始化 IncrementalShareService 实例
- **THEN** 服务 SHALL 加载和维护分享历史记录

### Requirement: 分享历史记录管理
系统 SHALL 实现分享历史记录管理功能，用于追踪每次分享操作的时间和内容。

#### Scenario: 记录分享操作
- **WHEN** 完成分享操作后
- **THEN** 系统 SHALL 记录分享的文档ID、时间戳和用户信息
- **THEN** 记录 SHALL 存储在本地配置中

#### Scenario: 获取上次分享时间
- **WHEN** 需要检测增量变更时
- **THEN** 系统 SHALL 能够查询指定文档或整个知识库的上次分享时间
- **THEN** 如无历史记录， SHALL 默认使用当前时间作为基准

### Requirement: 文档变更检测
系统 SHALL 实现高效的文档变更检测算法，识别自上次分享后修改的文档。

#### Scenario: 批量检测变更
- **WHEN** 用户请求增量分享时
- **THEN** 系统 SHALL 比对文档修改时间与历史分享时间
- **THEN** 返回的结果 SHALL 以文档树结构组织
- **THEN** 系统 SHALL 标识每个文档的变更状态（新增/修改）

### Requirement: 增量分享UI组件
系统 SHALL 开发增量分享专用UI组件，包括文档树展示、选择和操作界面，采用分组展示设计。

#### Scenario: 分组展示变更文档
- **WHEN** 用户打开增量分享页面时
- **THEN** 系统 SHALL 以分组方式展示变更文档
- **THEN** 第一分组 SHALL 显示「已分享文档的更新」，包含之前分享过但有修改的文档
- **THEN** 第二分组 SHALL 显示「新增文档」，包含上次操作后未分享过的文档
- **THEN** 「新增文档」分组 SHALL 默认处于折叠状态
- **THEN** 每个分组 SHALL 提供独立的全选/反选功能

#### Scenario: 文档树展示与交互
- **WHEN** 用户查看特定分组时
- **THEN** 系统 SHALL 以分层树状结构展示该分组下的所有文档
- **THEN** 界面 SHALL 提供清晰的视觉提示标识变更类型
- **THEN** 每个文档节点 SHALL 显示文档名称、变更状态、最后修改时间和分享历史

#### Scenario: 文档选择操作
- **WHEN** 用户在文档树中选择文档时
- **THEN** 系统 SHALL 支持单选、多选和全选操作
- **THEN** 界面 SHALL 实时显示已选择文档的数量
- **THEN** 系统 SHALL 记住用户的选择偏好

### Requirement: 批量分享功能
系统 SHALL 实现批量分享功能，支持同时处理多个文档的分享操作。

#### Scenario: 执行批量分享
- **WHEN** 用户点击"分享所选文档"按钮时
- **THEN** 系统 SHALL 并发处理所有选中文档的分享请求
- **THEN** 界面 SHALL 显示分享进度和实时状态
- **THEN** 分享完成后 SHALL 提供结果汇总信息

### Requirement: 新UI模式集成
增量分享功能 SHALL 与新UI模式无缝集成，提供一致的用户体验。

#### Scenario: 在新UI中访问增量分享
- **WHEN** 用户在新UI模式下打开分享管理
- **THEN** 系统 SHALL 在适当位置提供增量分享入口
- **THEN** 增量分享界面 SHALL 遵循新UI的设计规范
- **THEN** 操作流程 SHALL 与新UI的交互模式保持一致

### Requirement: 配置与偏好设置
系统 SHALL 提供增量分享相关的配置选项，允许用户自定义行为，包括黑名单配置。

#### Scenario: 配置增量分享选项
- **WHEN** 用户访问分享设置时
- **THEN** 系统 SHALL 提供增量分享相关的配置选项
- **THEN** 可配置项 SHALL 包括默认选择行为、缓存策略等
- **THEN** 用户的设置 SHALL 持久化保存并在下次使用时应用

#### Scenario: 管理分享黑名单
- **WHEN** 用户访问增量分享设置时
- **THEN** 系统 SHALL 提供笔记本级别和文档级别黑名单配置界面
- **THEN** 用户 SHALL 能够添加、移除和查看黑名单项目
- **THEN** 黑名单设置 SHALL 自动保存并应用于后续的增量分享检测

### Requirement: 黑名单过滤机制
系统 SHALL 实现基于黑名单的文档过滤机制，确保被排除的文档不会被包含在增量分享中。

#### Scenario: 黑名单过滤
- **WHEN** 系统执行文档变更检测时
- **THEN** SHALL 自动过滤掉位于黑名单中的笔记本和文档
- **THEN** 黑名单过滤 SHALL 应用于所有增量分享相关操作
- **THEN** 黑名单项目的状态 SHALL 在UI中明确标识

#### Scenario: 黑名单继承关系
- **WHEN** 笔记本被添加到黑名单时
- **THEN** 其包含的所有子文档 SHALL 默认被排除在增量分享之外
- **THEN** 用户 SHALL 能够查看和管理笔记本黑名单及其包含的文档
- **THEN** 系统 SHALL 提供黑名单继承关系的可视化展示