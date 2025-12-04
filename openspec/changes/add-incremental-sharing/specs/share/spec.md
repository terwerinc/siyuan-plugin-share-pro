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
- **WHEN** 用户点击“分享所选文档”按钮时
- **THEN** 系统 SHALL 并发处理所有选中文档的分享请求（最多5个并发）
- **THEN** 界面 SHALL 显示分享进度和实时状态
- **THEN** 分享完成后 SHALL 提供结果汇总信息

#### Scenario: 智能重试机制
- **WHEN** 分享过程中发生网络错误时
- **THEN** 系统 SHALL 自动重试3次，使用指数退避策略
- **WHEN** 发生服务端5xx错误时
- **THEN** 系统 SHALL 延迟30秒后重试
- **WHEN** 发生4xx错误时
- **THEN** 系统 SHALL 立即失败并记录详细日志

#### Scenario: 分享队列管理
- **WHEN** 执行批量分享时
- **THEN** 系统 SHALL 支持暂停和继续操作
- **THEN** 系统 SHALL 支持仅重试失败项
- **THEN** 系统 SHALL 保存进度到本地，系统重启后可恢复
- **THEN** 界面 SHALL 显示队列状态和预估剩余时间

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

#### Scenario: 快速添加黑名单
- **WHEN** 用户右键点击文档或笔记本时
- **THEN** 系统 SHALL 显示“添加到分享黑名单”选项
- **WHEN** 用户选择该选项时
- **THEN** 系统 SHALL 立即将该项添加到黑名单
- **THEN** 系统 SHALL 显示成功提示

### Requirement: 用户引导体验
系统 SHALL 提供完善的用户引导，帮助用户快速上手增量分享功能。

#### Scenario: 首次使用引导
- **WHEN** 用户首次打开增量分享界面时
- **THEN** 系统 SHALL 展示功能介绍卡片
- **THEN** 卡片 SHALL 支持关闭并记忆“不再提示”
- **THEN** 系统 SHALL 提供快速开始视频教程链接

#### Scenario: 空状态提示
- **WHEN** 增量分享检测没有变更文档时
- **THEN** 系统 SHALL 显示友好的空状态插图
- **THEN** 系统 SHALL 说明原因：“所有文档都已是最新分享状态”
- **THEN** 系统 SHALL 提供建议操作：“修改文档后再来试试”

#### Scenario: 黑名单使用指引
- **WHEN** 用户访问黑名单设置页面时
- **THEN** 系统 SHALL 显示“为什么需要黑名单”说明
- **THEN** 系统 SHALL 提供预设模板（草稿笔记本、个人日记、敏感资料）
- **THEN** 用户 SHALL 能够一键添加预设模板到黑名单

### Requirement: 分享历史查询与统计
系统 SHALL 提供分享历史记录查询和统计分析功能。

#### Scenario: 历史记录查询
- **WHEN** 用户访问分享历史页面时
- **THEN** 系统 SHALL 支持按时间范围筛选（今天、最近7天、最近30天、自定义）
- **THEN** 系统 SHALL 支持按文档名称模糊搜索
- **THEN** 系统 SHALL 支持按分享状态过滤（成功/失败/处理中）
- **THEN** 系统 SHALL 支持导出为CSV文件

#### Scenario: 统计报表
- **WHEN** 用户访问统计页面时
- **THEN** 系统 SHALL 显示分享次数趋势图（最近30天折线图）
- **THEN** 系统 SHALL 显示最常分享的Top 10文档（柱状图）
- **THEN** 系统 SHALL 显示分享成功率统计
- **THEN** 系统 SHALL 显示黑名单命中统计

#### Scenario: 历史记录管理
- **WHEN** 用户需要清理历史记录时
- **THEN** 系统 SHALL 提供“清除30天前的历史记录”功能
- **THEN** 系统 SHALL 提供“清除失败记录”功能
- **THEN** 系统 SHALL 显示历史记录占用的存储空间

### Requirement: 数据一致性保证
系统 SHALL 实现数据一致性检查和同步机制。

#### Scenario: 定期校验
- **WHEN** 系统后台定时任务运行时（每24小时）
- **THEN** 系统 SHALL 校验分享历史与实际状态
- **THEN** 系统 SHALL 清理已删除文档的历史记录
- **THEN** 系统 SHALL 标记状态异常的记录

#### Scenario: 黑名单同步
- **WHEN** 文档被添加到黑名单时
- **THEN** 系统 SHALL 自动标记该文档的分享历史
- **THEN** 系统 SHALL 提供“取消黑名单中文档的分享”一键操作
- **WHEN** 文档从黑名单移除时
- **THEN** 系统 SHALL 提示用户是否重新分享

### Requirement: 性能优化
系统 SHALL 实现性能优化策略，确保大型知识库的流畅体验。

#### Scenario: 变更检测性能
- **WHEN** 系统执行文档变更检测时
- **THEN** 1000文档检测时间 SHALL < 2秒
- **THEN** 5000文档检测时间 SHALL < 5秒
- **THEN** 10000文档检测时间 SHALL < 10秒
- **THEN** 检测期间UI SHALL 保持响应，不阻塞用户操作

#### Scenario: 优化策略应用
- **WHEN** 系统处理大量数据时
- **THEN** 系统 SHALL 使用Web Worker进行变更检测
- **THEN** 系统 SHALL 缓存检测结果5分钟
- **THEN** 批量分享并发数 SHALL 限制为5个
- **THEN** 系统 SHALL 支持虚拟滚动（每页100条）
- **THEN** 黑名单过滤 SHALL 使用HashSet数据结构

### Requirement: 移动端适配
系统 SHALL 提供移动端友好的用户体验。

#### Scenario: 移动端界面适配
- **WHEN** 用户在移动端打开增量分享界面时
- **THEN** 界面 SHALL 自动切换为单列布局
- **THEN** 按钮点击区域 SHALL 增大至最小44x44px
- **THEN** 系统 SHALL 支持手势操作（左滑显示操作菜单）
- **THEN** 界面 SHALL 隐藏次要信息，保留核心功能

### Requirement: 异常场景处理
系统 SHALL 实现完善的异常处理机制。

#### Scenario: 网络异常处理
- **WHEN** 发生网络异常时
- **THEN** 系统 SHALL 显示离线提示
- **THEN** 系统 SHALL 保存操作队列
- **THEN** 网络恢复后 SHALL 自动继续

#### Scenario: 服务端异常处理
- **WHEN** 发生服务端异常时
- **THEN** 系统 SHALL 显示友好的错误提示
- **THEN** 系统 SHALL 提供重试按钮

#### Scenario: 数据损坏处理
- **WHEN** 检测到数据损坏时
- **THEN** 系统 SHALL 自动备份配置
- **THEN** 系统 SHALL 提供恢复默认设置选项

### Requirement: 国际化支持
系统 SHALL 提供完整的国际化支持。

#### Scenario: 文案翻译
- **WHEN** 系统显示增量分享相关文案时
- **THEN** 所有文案 SHALL 使用 incrementalShare.xxx 命名空间
- **THEN** 系统 SHALL 支持中文和英文
- **THEN** 关键文案 SHALL 提供详细的上下文说明